import { Kbd } from "@/components/ui/kbd";
import { loadPdfDocument, type PdfDocument } from "@/lib/pdf-loader";
import {
  computePageLayouts,
  getVisiblePageNumbers,
  getTotalContentHeight,
  TOP_PADDING,
  PAGE_GAP,
} from "@/lib/page-layout";
import { VisiblePagesContext } from "@/contexts/visible-pages";
import { useEditorStore } from "@/stores/editor-store";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";

const RASTERIZE_DELAY = 16;

interface PdfPageProps {
  doc: PdfDocument;
  pageNumber: number;
  zoom: number;
  width: number;
  height: number;
}

function PdfPage({ doc, pageNumber, zoom, width, height }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{
    cancel: () => void;
    promise: Promise<void>;
  } | null>(null);
  const [renderedZoom, setRenderedZoom] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const canvas = canvasRef.current;
      if (!canvas || (renderedZoom === zoom && canvas.width > 0)) return;

      try {
        const page = await doc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: zoom });

        if (!canvasRef.current) return;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;

        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        renderTaskRef.current = page.render({
          canvas,
          canvasContext: ctx,
          viewport,
        });
        await renderTaskRef.current.promise;

        setRenderedZoom(zoom);
      } catch (err: unknown) {
        if (
          !(err instanceof Error && err.name === "RenderingCancelledException")
        ) {
          console.error(`Error rendering page ${pageNumber}:`, err);
        }
      }
    }, RASTERIZE_DELAY);

    return () => {
      clearTimeout(timer);
      if (renderTaskRef.current) renderTaskRef.current.cancel();
    };
  }, [doc, pageNumber, renderedZoom, zoom]);

  const effectiveRenderedZoom = renderedZoom ?? zoom;
  const scaleRatio = renderedZoom ? zoom / renderedZoom : 1;

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 origin-top-left pointer-events-none"
      style={{
        transform: `scale(${scaleRatio})`,
        width: `${width * effectiveRenderedZoom}px`,
        height: `${height * effectiveRenderedZoom}px`,
      }}
    />
  );
}

interface PdfCanvasProps {
  children?: ReactNode;
}

export function PdfCanvas({ children }: PdfCanvasProps) {
  const { t } = useTranslation();
  const pdfBytes = useEditorStore((s) => s.pdfBytes);
  const pages = useEditorStore((s) => s.pages);
  const zoom = useEditorStore((s) => s.zoom);

  const [pdfDoc, setPdfDoc] = useState<PdfDocument | null>(null);
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set());
  const rafRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!pdfBytes) {
      setPdfDoc(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const doc = await loadPdfDocument(pdfBytes);
        if (!cancelled) setPdfDoc(doc);
      } catch (error) {
        console.error("Failed to load PDF:", error);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [pdfBytes]);

  const updateVisiblePages = useCallback(() => {
    const el = containerRef.current;
    if (!el || pages.length === 0) return;

    const layouts = computePageLayouts(pages, zoom, el.clientWidth);
    const next = getVisiblePageNumbers(layouts, el.scrollTop, el.clientHeight);

    setVisiblePages((prev) => {
      if (prev.size === next.size) {
        let same = true;
        for (const p of next) {
          if (!prev.has(p)) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      return next;
    });
  }, [pages, zoom]);

  useEffect(() => {
    const scrollEl = document.querySelector<HTMLElement>(
      "[data-pdf-scroll-container]",
    );
    if (!scrollEl) return;
    containerRef.current = scrollEl;

    updateVisiblePages();

    const onScroll = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        updateVisiblePages();
      });
    };

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    const resizeObserver = new ResizeObserver(() => updateVisiblePages());
    resizeObserver.observe(scrollEl);

    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      resizeObserver.disconnect();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [updateVisiblePages]);

  useEffect(() => {
    updateVisiblePages();
  }, [pages, zoom, updateVisiblePages]);

  const totalHeight = useMemo(
    () => getTotalContentHeight(pages, zoom),
    [pages, zoom],
  );

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

  if (!pdfDoc || pages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center select-none">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="32"
              strokeLinecap="round"
              className="opacity-25"
            />
            <path
              d="M12 2a10 10 0 0 1 10 10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-xs">
            {t("canvas.loading", "Loading PDF...")}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative min-w-full w-fit bg-muted/20"
      style={{ minHeight: totalHeight > 0 ? totalHeight : undefined }}
    >
      <div
        className="flex flex-col items-center"
        style={{ paddingTop: TOP_PADDING }}
        onDragStart={(e) => e.preventDefault()}
      >
        {pages.map((page, i) => {
          const isVisible = visiblePages.has(page.pageNumber);
          const displayWidth = page.width * zoom;
          const displayHeight = page.height * zoom;

          return (
            <div
              key={page.pageNumber}
              className="relative bg-white shadow-md shrink-0"
              style={{
                width: `${displayWidth}px`,
                height: `${displayHeight}px`,
                marginBottom: i < pages.length - 1 ? PAGE_GAP : 0,
              }}
              data-page-wrapper={page.pageNumber}
              data-page-number={page.pageNumber}
            >
              {isVisible && (
                <PdfPage
                  doc={pdfDoc}
                  pageNumber={page.pageNumber}
                  zoom={zoom}
                  width={page.width}
                  height={page.height}
                />
              )}
            </div>
          );
        })}
      </div>
      <VisiblePagesContext.Provider value={visiblePages}>
        {children}
      </VisiblePagesContext.Provider>
    </div>
  );
}
