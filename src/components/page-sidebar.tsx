import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useEditorStore } from "@/stores/editor-store";
import {
  getRenderManager,
  type RenderHandle,
} from "@/lib/render-worker-manager";

const THUMB_SCALE = 0.2;
const THUMB_ITEM_HEIGHT = 130;
const THUMB_BUFFER = 5;
const THUMB_MAX_H = 94;
const THUMB_MAX_W = 140;

function getThumbDimensions(pageWidth: number, pageHeight: number) {
  const scaleW = THUMB_MAX_W / pageWidth;
  const scaleH = THUMB_MAX_H / pageHeight;
  const scale = Math.min(scaleW, scaleH, THUMB_SCALE);
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
  const [visibleRange, setVisibleRange] = useState<[number, number]>([0, 20]);

  useEffect(() => {
    renderedPagesRef.current.clear();
    canvasRefs.current.clear();
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

  useEffect(() => {
    if (!pdfBytes || pages.length === 0) return;

    let cancelled = false;
    const handles: RenderHandle[] = [];
    const manager = getRenderManager();

    for (
      let i = visibleRange[0];
      i < visibleRange[1] && i < pages.length;
      i++
    ) {
      const page = pages[i];
      if (renderedPagesRef.current.has(page.pageNumber)) continue;

      const dims = getThumbDimensions(page.width, page.height);
      const handle = manager.renderPage(page.pageNumber, dims.scale);
      handles.push(handle);

      handle.promise
        .then((bitmap) => {
          if (cancelled) {
            bitmap.close();
            return;
          }
          const canvas = canvasRefs.current.get(page.pageNumber);
          if (!canvas) {
            bitmap.close();
            return;
          }
          canvas.width = dims.width;
          canvas.height = dims.height;
          const ctx = canvas.getContext("2d", { alpha: false });
          if (ctx) {
            ctx.drawImage(bitmap, 0, 0);
            renderedPagesRef.current.add(page.pageNumber);
          }
          bitmap.close();
        })
        .catch((err) => {
          if (!(err instanceof Error) || !err.message.includes("cancelled"))
            console.error("[PageSidebar] Thumb render failed:", err);
        });
    }

    return () => {
      cancelled = true;
      for (const h of handles) h.cancel();
    };
  }, [pdfBytes, pages, visibleRange]);

  const scrollToPage = (pageNumber: number) => {
    const scrollContainer = document.querySelector(
      "[data-pdf-scroll-container]",
    );
    if (!scrollContainer) return;

    const pageCanvas = scrollContainer.querySelector(
      `[data-page-number="${pageNumber}"]`,
    );
    if (!pageCanvas) return;

    const containerRect = scrollContainer.getBoundingClientRect();
    const canvasRect = pageCanvas.getBoundingClientRect();
    const offset =
      canvasRect.top - containerRect.top + scrollContainer.scrollTop;

    scrollContainer.scrollTo({ top: offset, behavior: "smooth" });
  };

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
