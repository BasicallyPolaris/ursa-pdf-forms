import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useEditorStore } from "@/stores/editor-store";
import {
  loadPdfDocument,
  type PdfDocument,
  type CancellableRender,
} from "@/lib/pdf-loader";
import { computePageLayouts } from "@/lib/page-layout";

const THUMB_ITEM_HEIGHT = 130;
const THUMB_BUFFER = 8;
const THUMB_MAX_H = 94;
const THUMB_MAX_W = 140;
const THUMB_MAX_SCALE = 0.18;
const MAX_THUMB_CONCURRENT = 4;

function getThumbDimensions(pageWidth: number, pageHeight: number) {
  const scaleW = THUMB_MAX_W / pageWidth;
  const scaleH = THUMB_MAX_H / pageHeight;
  const scale = Math.min(scaleW, scaleH, THUMB_MAX_SCALE);
  return {
    width: Math.max(1, Math.round(pageWidth * scale)),
    height: Math.max(1, Math.round(pageHeight * scale)),
    scale,
  };
}

export function PageSidebar() {
  const { t } = useTranslation();
  const pdfBytes = useEditorStore((s) => s.pdfBytes);
  const pages = useEditorStore((s) => s.pages);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderedPagesRef = useRef<Set<number>>(new Set());
  const docRef = useRef<PdfDocument | null>(null);
  const activeRenders = useRef<Map<number, CancellableRender>>(new Map());
  const thumbQueue = useRef<number[]>([]);
  const thumbActive = useRef(0);
  const [visibleRange, setVisibleRange] = useState<[number, number]>([0, 20]);

  useEffect(() => {
    renderedPagesRef.current.clear();
    canvasRefs.current.clear();
    docRef.current = null;
    for (const [, r] of activeRenders.current) r.cancel();
    activeRenders.current.clear();
    thumbQueue.current = [];
    thumbActive.current = 0;

    if (!pdfBytes) return;
    let cancelled = false;
    loadPdfDocument(pdfBytes)
      .then((doc) => {
        if (!cancelled) docRef.current = doc;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pdfBytes]);

  const updateVisibleRange = useCallback(() => {
    const el = containerRef.current;
    if (!el || pages.length === 0) return;

    const scrollTop = el.scrollTop;
    const viewportH = el.clientHeight;
    const startIdx = Math.max(
      0,
      Math.floor(scrollTop / THUMB_ITEM_HEIGHT) - THUMB_BUFFER,
    );
    const endIdx = Math.min(
      pages.length,
      Math.ceil((scrollTop + viewportH) / THUMB_ITEM_HEIGHT) + THUMB_BUFFER,
    );

    setVisibleRange((prev) => {
      if (prev[0] === startIdx && prev[1] === endIdx) return prev;
      return [startIdx, endIdx];
    });
  }, [pages.length]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    updateVisibleRange();

    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateVisibleRange();
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => updateVisibleRange());
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [updateVisibleRange]);

  useEffect(() => {
    updateVisibleRange();
  }, [pages.length, updateVisibleRange]);

  const drainThumbQueue = useCallback(() => {
    const doc = docRef.current;
    if (!doc) return;

    while (
      thumbQueue.current.length > 0 &&
      thumbActive.current < MAX_THUMB_CONCURRENT
    ) {
      const pageNum = thumbQueue.current.pop()!;
      if (renderedPagesRef.current.has(pageNum)) continue;

      const page = pages[pageNum - 1];
      if (!page) continue;

      const dims = getThumbDimensions(page.width, page.height);
      thumbActive.current++;

      const render = doc.startRender(pageNum, dims.scale);
      activeRenders.current.set(pageNum, render);

      render.promise
        .then((result) => {
          activeRenders.current.delete(pageNum);
          const canvas = canvasRefs.current.get(pageNum);
          if (!canvas) {
            result.bitmap.close();
            return;
          }
          canvas.width = dims.width;
          canvas.height = dims.height;
          const ctx = canvas.getContext("2d", { alpha: false });
          if (ctx) {
            ctx.drawImage(result.bitmap, 0, 0);
            renderedPagesRef.current.add(pageNum);
          }
          result.bitmap.close();
        })
        .catch((err) => {
          activeRenders.current.delete(pageNum);
          if (
            !(err instanceof Error) ||
            (!err.message.includes("cancelled") &&
              !err.message.includes("RenderingCancelled"))
          )
            console.error("[PageSidebar] Thumb render failed:", err);
        })
        .finally(() => {
          thumbActive.current--;
          drainThumbQueue();
        });
    }
  }, [pages]);

  useEffect(() => {
    if (!pdfBytes || pages.length === 0) return;

    for (const [pageNum, r] of activeRenders.current) {
      const inRange =
        pageNum > 0 &&
        pages[pageNum - 1] &&
        pageNum - 1 >= visibleRange[0] &&
        pageNum - 1 < visibleRange[1];
      if (!inRange) {
        r.cancel();
        activeRenders.current.delete(pageNum);
      }
    }

    const needed: number[] = [];
    for (
      let i = visibleRange[0];
      i < visibleRange[1] && i < pages.length;
      i++
    ) {
      const pageNum = pages[i].pageNumber;
      if (
        !renderedPagesRef.current.has(pageNum) &&
        !activeRenders.current.has(pageNum)
      ) {
        needed.push(pageNum);
      }
    }
    thumbQueue.current = needed;
    drainThumbQueue();

    return () => {
      for (const [, r] of activeRenders.current) r.cancel();
      activeRenders.current.clear();
      thumbQueue.current = [];
      thumbActive.current = 0;
    };
  }, [pdfBytes, pages, visibleRange, drainThumbQueue]);

  const scrollToPage = useCallback(
    (pageNumber: number) => {
      const scrollContainer = document.querySelector(
        "[data-pdf-scroll-container]",
      );
      if (!scrollContainer) return;

      const zoom = useEditorStore.getState().zoom;
      const layouts = computePageLayouts(
        pages,
        zoom,
        scrollContainer.clientWidth,
      );
      const layout = layouts.get(pageNumber);
      if (!layout) return;

      scrollContainer.scrollTo({ top: layout.yOffset, behavior: "smooth" });
    },
    [pages],
  );

  const totalHeight = pages.length * THUMB_ITEM_HEIGHT;

  const visibleItems = useMemo(() => {
    const items: Array<{ page: (typeof pages)[0]; index: number }> = [];
    for (
      let i = visibleRange[0];
      i < visibleRange[1] && i < pages.length;
      i++
    ) {
      items.push({ page: pages[i], index: i });
    }
    return items;
  }, [pages, visibleRange]);

  return (
    <aside
      data-testid="left-sidebar"
      className="flex w-44 flex-col border-r border-border bg-card select-none"
    >
      <div className="px-2.5 py-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">
          {t("sidebar.pages")}
        </span>
      </div>
      {pdfBytes && (
        <div ref={containerRef} className="flex-1 overflow-auto px-2 pb-2 pt-1">
          <div style={{ height: totalHeight, position: "relative" }}>
            {visibleItems.map(({ page, index }) => {
              const dims = getThumbDimensions(page.width, page.height);
              return (
                <div
                  key={page.pageNumber}
                  style={{
                    position: "absolute",
                    top: index * THUMB_ITEM_HEIGHT,
                    left: 0,
                    right: 0,
                    height: THUMB_ITEM_HEIGHT,
                  }}
                >
                  <button
                    onClick={() => scrollToPage(page.pageNumber)}
                    className="group flex flex-col items-center gap-1 rounded-md border border-transparent p-1.5 hover:border-border hover:bg-accent/40 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-card w-full"
                  >
                    <div
                      data-thumb-wrapper
                      data-page-num={page.pageNumber}
                      className="flex items-center justify-center overflow-hidden rounded-sm border border-border/50"
                      style={{
                        width: `${dims.width}px`,
                        height: `${dims.height}px`,
                      }}
                    >
                      <canvas
                        ref={(el) => {
                          if (el) {
                            canvasRefs.current.set(page.pageNumber, el);
                            if (
                              !renderedPagesRef.current.has(page.pageNumber)
                            ) {
                              el.width = dims.width;
                              el.height = dims.height;
                            }
                          } else {
                            canvasRefs.current.delete(page.pageNumber);
                          }
                        }}
                        style={{
                          width: `${dims.width}px`,
                          height: `${dims.height}px`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums text-muted-foreground group-hover:text-foreground">
                      {page.pageNumber}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
