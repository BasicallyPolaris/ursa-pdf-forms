import { useEffect, useRef, useCallback, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useEditorStore } from "@/stores/editor-store";
import { loadPdfDocument, type PdfDocument } from "@/lib/pdf-loader";
import { computePageLayouts, getVisiblePageNumbers, type PageLayout } from "@/lib/page-layout";
import { VisiblePagesContext } from "@/contexts/visible-pages";
import { Kbd } from "@/components/ui/kbd";

const RASTERIZE_DELAY = 200;

interface PdfCanvasProps {
  children?: ReactNode;
}

export function PdfCanvas({ children }: PdfCanvasProps) {
  const { t } = useTranslation();
  const pdfBytes = useEditorStore((s) => s.pdfBytes);
  const zoom = useEditorStore((s) => s.zoom);
  const pages = useEditorStore((s) => s.pages);

  const pagesRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PdfDocument | null>(null);
  const canvasMap = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pendingRenders = useRef<Set<number>>(new Set());
  const renderedZoomRef = useRef(zoom);
  const zoomRef = useRef(zoom);
  const rasterizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set());
  const visiblePagesRef = useRef<Set<number>>(visiblePages);
  const layoutCacheRef = useRef<{ zoom: number; width: number; layouts: Map<number, PageLayout> } | null>(null);

  zoomRef.current = zoom;
  visiblePagesRef.current = visiblePages;

  const getScrollContainer = useCallback(() => {
    const el = pagesRef.current?.parentElement?.parentElement;
    return el ?? null;
  }, []);

  const syncVisiblePages = useCallback(() => {
    const scrollEl = getScrollContainer();
    if (!scrollEl || pages.length === 0) return;

    const currentZoom = zoomRef.current;
    const containerWidth = scrollEl.clientWidth;

    let layouts: Map<number, PageLayout>;
    const cache = layoutCacheRef.current;
    if (cache && cache.zoom === currentZoom && cache.width === containerWidth) {
      layouts = cache.layouts;
    } else {
      layouts = computePageLayouts(pages, currentZoom, containerWidth);
      layoutCacheRef.current = { zoom: currentZoom, width: containerWidth, layouts };
    }

    const next = getVisiblePageNumbers(layouts, scrollEl.scrollTop, scrollEl.clientHeight);

    setVisiblePages((prev) => {
      if (prev.size === next.size) {
        let same = true;
        for (const p of next) {
          if (!prev.has(p)) { same = false; break; }
        }
        if (same) return prev;
      }
      return next;
    });
  }, [pages, getScrollContainer]);

  useEffect(() => {
    if (!pdfBytes) {
      docRef.current = null;
      return;
    }

    let cancelled = false;
    loadPdfDocument(pdfBytes).then((doc) => {
      if (cancelled) return;
      docRef.current = doc;
      renderedZoomRef.current = zoomRef.current;
      syncVisiblePages();
    });

    return () => {
      cancelled = true;
    };
  }, [pdfBytes, syncVisiblePages]);

  useEffect(() => {
    const scrollEl = getScrollContainer();
    if (!scrollEl) return;

    scrollEl.addEventListener("scroll", syncVisiblePages, { passive: true });
    const ro = new ResizeObserver(syncVisiblePages);
    ro.observe(scrollEl);

    return () => {
      scrollEl.removeEventListener("scroll", syncVisiblePages);
      ro.disconnect();
    };
  }, [syncVisiblePages]);

  const renderPageToCanvas = useCallback(
    (pageNum: number, targetZoom: number) => {
      const doc = docRef.current;
      if (!doc) return;
      if (pendingRenders.current.has(pageNum)) return;

      pendingRenders.current.add(pageNum);
      doc
        .renderPage(pageNum, targetZoom)
        .then((result) => {
          pendingRenders.current.delete(pageNum);
          const canvas = canvasMap.current.get(pageNum);
          if (!canvas) {
            result.bitmap.close();
            return;
          }
          canvas.width = result.width;
          canvas.height = result.height;
          canvas.style.width = `${result.width}px`;
          canvas.style.height = `${result.height}px`;
          const ctx = canvas.getContext("2d");
          if (ctx) ctx.drawImage(result.bitmap, 0, 0);
          result.bitmap.close();
        })
        .catch(() => {
          pendingRenders.current.delete(pageNum);
        });
    },
    [],
  );

  useEffect(() => {
    const container = pagesRef.current;
    if (!container) return;

    for (const [pageNum, canvas] of canvasMap.current) {
      if (!visiblePages.has(pageNum) && canvas.parentElement) {
        canvas.remove();
      }
    }

    for (const pageNum of visiblePages) {
      const existing = canvasMap.current.get(pageNum);
      const wrapper = container.querySelector<HTMLElement>(
        `[data-page-wrapper="${pageNum}"]`,
      );
      if (!wrapper) continue;

      if (existing) {
        if (!existing.parentElement) {
          wrapper.appendChild(existing);
        }
        continue;
      }

      const canvas = document.createElement("canvas");
      canvas.draggable = false;
      canvas.style.display = "block";
      canvas.style.margin = "0 auto";
      (canvas.style as unknown as Record<string, string>).webkitUserDrag = "none";
      canvas.dataset.pageNumber = String(pageNum);
      wrapper.appendChild(canvas);
      canvasMap.current.set(pageNum, canvas);

      renderPageToCanvas(pageNum, zoomRef.current);
    }

    const MAX_CACHED = visiblePages.size * 3 + 10;
    if (canvasMap.current.size > MAX_CACHED) {
      const toEvict: number[] = [];
      for (const [pageNum] of canvasMap.current) {
        if (!visiblePages.has(pageNum)) toEvict.push(pageNum);
        if (toEvict.length >= canvasMap.current.size - MAX_CACHED) break;
      }
      for (const pageNum of toEvict) {
        const canvas = canvasMap.current.get(pageNum);
        if (canvas) canvas.remove();
        canvasMap.current.delete(pageNum);
      }
    }
  }, [visiblePages, renderPageToCanvas]);

  useEffect(() => {
    const container = pagesRef.current;
    if (!container || !docRef.current) return;

    const renderedZoom = renderedZoomRef.current;
    const scaleRatio = zoom / renderedZoom;

    const wrappers = container.querySelectorAll<HTMLElement>("[data-page-wrapper]");
    for (let i = 0; i < wrappers.length; i++) {
      const wrapper = wrappers[i];
      const canvas = wrapper.querySelector("canvas");
      if (!canvas) continue;

      const canvasW = canvas.width;
      const canvasH = canvas.height;
      canvas.style.width = `${canvasW * scaleRatio}px`;
      canvas.style.height = `${canvasH * scaleRatio}px`;
      wrapper.style.height = `${canvasH * scaleRatio}px`;
    }

    if (rasterizeTimerRef.current) {
      clearTimeout(rasterizeTimerRef.current);
    }

    rasterizeTimerRef.current = setTimeout(() => {
      if (!docRef.current) return;
      renderedZoomRef.current = zoomRef.current;
      for (const pageNum of visiblePagesRef.current) {
        renderPageToCanvas(pageNum, zoomRef.current);
      }
    }, RASTERIZE_DELAY);

    return () => {
      if (rasterizeTimerRef.current) {
        clearTimeout(rasterizeTimerRef.current);
      }
    };
  }, [zoom, renderPageToCanvas]);

  useEffect(() => {
    return () => {
      for (const [, canvas] of canvasMap.current) {
        canvas.remove();
      }
      canvasMap.current.clear();
      pendingRenders.current.clear();
    };
  }, []);

  if (!pdfBytes) {
    return (
      <div className="flex h-full items-center justify-center select-none">
        <div className="flex flex-col items-center gap-5 text-muted-foreground">
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            className="text-border"
          >
            <rect
              x="8"
              y="4"
              width="32"
              height="40"
              rx="3"
              stroke="currentColor"
              strokeWidth="2"
            />
            <line
              x1="14"
              y1="14"
              x2="34"
              y2="14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="14"
              y1="20"
              x2="34"
              y2="20"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="14"
              y1="26"
              x2="28"
              y2="26"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <rect
              x="14"
              y="32"
              width="10"
              height="6"
              rx="1"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-sm text-center font-medium text-foreground">
              {t("canvas.emptyTitle")}
            </p>
            <p className="text-xs text-center text-muted-foreground">
              {t("canvas.emptyDescription")}
            </p>
          </div>
          <div className="mt-2 flex flex-col gap-1.5 text-[11px] text-muted-foreground/70">
            <div className="flex items-center gap-2">
              <Kbd>Ctrl+O</Kbd>
              <span>{t("canvas.openPdf")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Kbd>Ctrl+Scroll</Kbd>
              <span>{t("canvas.zoom")}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-w-full w-fit">
      <div
        ref={pagesRef}
        className="flex flex-col items-center gap-2 p-4"
        onDragStart={(e) => e.preventDefault()}
      >
        {pages.map((page) => (
          <div
            key={page.pageNumber}
            data-page-wrapper={page.pageNumber}
            className="flex justify-center"
            style={{ height: page.height * zoom }}
          />
        ))}
      </div>
      <VisiblePagesContext.Provider value={visiblePages}>
        {children}
      </VisiblePagesContext.Provider>
    </div>
  );
}
