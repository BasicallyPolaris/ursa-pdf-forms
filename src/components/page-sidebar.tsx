import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useEditorStore } from "@/stores/editor-store";
import { loadPdfDocument, type PdfDocument } from "@/lib/pdf-loader";
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
  const docRef = useRef<PdfDocument | null>(null);
  const bitmapCache = useRef<Map<number, ImageBitmap>>(new Map());
  const renderGeneration = useRef(0);
  const idleGeneration = useRef(0);
  const [visibleRange, setVisibleRange] = useState<[number, number]>([0, 20]);
  const [preRenderProgress, setPreRenderProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    for (const [, bmp] of bitmapCache.current) bmp.close();
    bitmapCache.current.clear();
    canvasRefs.current.clear();
    docRef.current = null;
    renderGeneration.current++;
    idleGeneration.current++;
    setPreRenderProgress(null);

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

  useEffect(() => {
    if (!pdfBytes || pages.length === 0) return;
    const doc = docRef.current;
    if (!doc) return;

    const gen = ++renderGeneration.current;
    let active = 0;
    const pending = new Map<number, ReturnType<typeof doc.startRender>>();

    const needed: number[] = [];
    for (
      let i = visibleRange[0];
      i < visibleRange[1] && i < pages.length;
      i++
    ) {
      const pageNum = pages[i].pageNumber;
      if (!bitmapCache.current.has(pageNum)) {
        needed.push(pageNum);
      }
    }

    const drain = () => {
      if (gen !== renderGeneration.current) return;

      while (needed.length > 0 && active < MAX_THUMB_CONCURRENT) {
        const pageNum = needed.shift()!;
        if (bitmapCache.current.has(pageNum)) continue;

        const page = pages[pageNum - 1];
        if (!page) continue;

        const dims = getThumbDimensions(page.width, page.height);
        active++;

        const render = doc.startRender(pageNum, dims.scale);
        pending.set(pageNum, render);

        render.promise
          .then((result) => {
            if (gen !== renderGeneration.current) {
              result.bitmap.close();
              return;
            }
            pending.delete(pageNum);

            bitmapCache.current.set(pageNum, result.bitmap);

            const canvas = canvasRefs.current.get(pageNum);
            if (canvas) {
              canvas.width = dims.width;
              canvas.height = dims.height;
              const ctx = canvas.getContext("2d", { alpha: false });
              if (ctx) ctx.drawImage(result.bitmap, 0, 0);
            }
          })
          .catch((err) => {
            if (gen !== renderGeneration.current) return;
            pending.delete(pageNum);
            if (
              !(err instanceof Error) ||
              (!err.message.includes("cancelled") &&
                !err.message.includes("RenderingCancelled"))
            )
              console.error("[PageSidebar] Thumb render failed:", err);
          })
          .finally(() => {
            if (gen !== renderGeneration.current) return;
            active--;
            setTimeout(drain, 0);
          });
      }
    };

    drain();

    return () => {
      renderGeneration.current++;
      for (const [, r] of pending) r.cancel();
    };
  }, [pdfBytes, pages, visibleRange]);

  useEffect(() => {
    if (!pdfBytes || pages.length === 0) return;
    const doc = docRef.current;
    if (!doc) return;

    const gen = ++idleGeneration.current;
    const pending = new Map<number, ReturnType<typeof doc.startRender>>();
    let active = 0;
    let completed = 0;

    const center = Math.floor((visibleRange[0] + visibleRange[1]) / 2);
    const queue: number[] = [];
    for (let offset = 0; offset < pages.length; offset++) {
      const before = center - offset;
      const after = center + offset + 1;
      if (before >= 0 && before < pages.length)
        queue.push(pages[before].pageNumber);
      if (after >= 0 && after < pages.length)
        queue.push(pages[after].pageNumber);
    }
    const needed = queue.filter((pn) => !bitmapCache.current.has(pn));
    const total = needed.length;

    if (total === 0) return;

    const MAX_IDLE_CONCURRENT = 3;

    const drain = () => {
      if (gen !== idleGeneration.current) return;

      while (needed.length > 0 && active < MAX_IDLE_CONCURRENT) {
        const pageNum = needed.shift()!;
        if (bitmapCache.current.has(pageNum)) {
          completed++;
          continue;
        }

        const page = pages[pageNum - 1];
        if (!page) continue;

        const dims = getThumbDimensions(page.width, page.height);
        active++;

        const render = doc.startRender(pageNum, dims.scale);
        pending.set(pageNum, render);

        render.promise
          .then((result) => {
            if (gen !== idleGeneration.current) {
              result.bitmap.close();
              return;
            }
            pending.delete(pageNum);
            bitmapCache.current.set(pageNum, result.bitmap);

            const canvas = canvasRefs.current.get(pageNum);
            if (canvas) {
              canvas.width = dims.width;
              canvas.height = dims.height;
              const ctx = canvas.getContext("2d", { alpha: false });
              if (ctx) ctx.drawImage(result.bitmap, 0, 0);
            }
            completed++;
            setPreRenderProgress(
              needed.length > 0 ? { done: completed, total } : null,
            );
          })
          .catch((err) => {
            if (gen !== idleGeneration.current) return;
            pending.delete(pageNum);
            completed++;
            if (
              !(err instanceof Error) ||
              (!err.message.includes("cancelled") &&
                !err.message.includes("RenderingCancelled"))
            )
              console.error("[PageSidebar] Idle thumb render failed:", err);
          })
          .finally(() => {
            if (gen !== idleGeneration.current) return;
            active--;
            if (needed.length > 0) {
              setTimeout(() => drain(), 50);
            }
          });
      }
    };

    const timerId = setTimeout(() => drain(), 200);

    return () => {
      idleGeneration.current++;
      clearTimeout(timerId);
      for (const [, r] of pending) r.cancel();
      setPreRenderProgress(null);
    };
  }, [pdfBytes, pages, visibleRange]);

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
      <div className="px-2.5 py-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">
          {t("sidebar.pages")}
        </span>
        {preRenderProgress && (
          <span className="text-[10px] tabular-nums text-muted-foreground/60">
            {preRenderProgress.done}/{preRenderProgress.total}
          </span>
        )}
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
                            const cached = bitmapCache.current.get(
                              page.pageNumber,
                            );
                            if (cached) {
                              el.width = dims.width;
                              el.height = dims.height;
                              const ctx = el.getContext("2d", {
                                alpha: false,
                              });
                              if (ctx) ctx.drawImage(cached, 0, 0);
                            } else {
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
