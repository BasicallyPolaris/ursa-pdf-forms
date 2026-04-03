import { Kbd } from "@/components/ui/kbd";
import { VisiblePagesContext } from "@/contexts/visible-pages";
import {
  computePageLayouts as computeLayouts,
  getTotalContentHeight,
  getVisiblePageNumbers,
  H_PADDING,
  PAGE_GAP,
  TOP_PADDING,
  type PageLayout,
} from "@/lib/page-layout";
import {
  getRenderManager,
  type RenderHandle,
  type RenderResult,
} from "@/lib/render-worker-manager";
import { getZoomEngine, type ZoomListener } from "@/lib/use-zoom-animation";
import { getPdfScaleTransformOrigin } from "@/lib/zoom-visual-transform";
import { useEditorStore } from "@/stores/editor-store";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";

const RASTERIZE_DEBOUNCE_MS = 200;

// ─── PdfPage ────────────────────────────────────────────────────────────────
// Renders one page. Rasterizes at the committed zoom (debounced).
// During animation the parent scale wrapper handles visual zoom — this
// component does nothing extra per frame.

interface PdfPageProps {
  pageNumber: number;
  zoom: number; // committed zoom — drives rasterization
  width: number;
  height: number;
}

const PdfPage = memo(function PdfPage({
  pageNumber,
  zoom,
  width,
  height,
}: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<RenderHandle | null>(null);
  const rasterZoomRef = useRef<number | null>(null);
  const prevZoomRef = useRef<number | null>(null);

  useEffect(() => {
    const isFirst = rasterZoomRef.current === null;
    const zoomChanged = prevZoomRef.current !== null && prevZoomRef.current !== zoom;
    prevZoomRef.current = zoom;
    const delay = isFirst || zoomChanged ? 0 : RASTERIZE_DEBOUNCE_MS;

    const timer = window.setTimeout(() => {
      if (
        rasterZoomRef.current === zoom &&
        canvasRef.current?.width &&
        canvasRef.current.width > 0
      )
        return;

      handleRef.current?.cancel();
      const handle = getRenderManager().renderPage(pageNumber, zoom);
      handleRef.current = handle;

      handle.promise
        .then(({ bitmap, renderedScale }: RenderResult) => {
          const canvas = canvasRef.current;
          if (!canvas) {
            bitmap.close();
            return;
          }
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext("2d", {
            alpha: false,
            willReadFrequently: false,
          });
          if (ctx) ctx.drawImage(bitmap, 0, 0);
          bitmap.close();
          rasterZoomRef.current = renderedScale;
        })
        .catch((err) => {
          if (!(err instanceof Error) || !err.message.includes("cancelled"))
            console.error("[PdfPage] render failed:", err);
        });
    }, delay);

    return () => {
      clearTimeout(timer);
      handleRef.current?.cancel();
      handleRef.current = null;
    };
  }, [pageNumber, zoom]);

  // Canvas is sized to match the committed zoom. The scale wrapper above
  // handles any visual difference during animation.
  return (
    <canvas
      ref={canvasRef}
      className="block pointer-events-none"
      style={{ width: width * zoom, height: height * zoom }}
    />
  );
});

// ─── PdfCanvas ──────────────────────────────────────────────────────────────

interface PdfCanvasProps {
  children?: ReactNode;
}

export function PdfCanvas({ children }: PdfCanvasProps) {
  const { t } = useTranslation();
  const pdfBytes = useEditorStore((s) => s.pdfBytes);
  const pages = useEditorStore((s) => s.pages);
  // committedZoom: the store value, only updates when animation settles.
  // Layout, rasterization, and children (CanvasOverlay) all use this.
  const committedZoom = useEditorStore((s) => s.zoom);

  // ── Scale wrapper ref ──────────────────────────────────────────────────
  // During animation, we apply transform: scale(liveZoom / committedZoom)
  // to this single div. One CSS property change → GPU composite, zero React.
  const scaleWrapperRef = useRef<HTMLDivElement>(null);
  const committedZoomRef = useRef(committedZoom);

  // Keep committedZoomRef in sync
  useLayoutEffect(() => {
    committedZoomRef.current = committedZoom;
    // Reset scale when committed zoom updates (animation settled)
    if (scaleWrapperRef.current) {
      scaleWrapperRef.current.style.transform = "scale(1)";
      scaleWrapperRef.current.style.transformOrigin = "50% 0";
    }
  }, [committedZoom]);

  // ── Zoom engine listener ───────────────────────────────────────────────
  useEffect(() => {
    const listener: ZoomListener = {
      onZoomTick(liveZoom) {
        const wrapper = scaleWrapperRef.current;
        if (!wrapper) return;
        const base = committedZoomRef.current;
        if (base <= 0) return;

        const s = liveZoom / base;

        const scrollEl = document.querySelector<HTMLElement>(
          "[data-pdf-scroll-container]",
        );
        const engine = getZoomEngine();
        const origin = engine.getOrigin();

        wrapper.style.transform = `scale(${s})`;
        wrapper.style.transformOrigin = scrollEl
          ? getPdfScaleTransformOrigin(scrollEl, wrapper, origin)
          : "50% 0";
      },
      onZoomSettle() {
        // committedZoom will update via store, useLayoutEffect resets scale
      },
    };

    getZoomEngine().addListener(listener);
    return () => getZoomEngine().removeListener(listener);
  }, []);

  // ── PDF load ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pdfBytes) return;
    getRenderManager()
      .load(pdfBytes)
      .catch((err) => console.error("[PdfCanvas] load failed:", err));
    return () => getRenderManager().cancelAll();
  }, [pdfBytes]);

  // ── Container width (for layout) ──────────────────────────────────────
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(
      "[data-pdf-scroll-container]",
    );
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Layout (runs only when committed zoom or pages/width change) ───────
  const layouts = useMemo(
    () => computeLayouts(pages, committedZoom, containerWidth),
    [pages, committedZoom, containerWidth],
  );

  // ── Visible pages ──────────────────────────────────────────────────────
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set());
  const layoutsRef = useRef(layouts);
  layoutsRef.current = layouts;
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const scrollRafRef = useRef<number | null>(null);

  const updateVisiblePages = useCallback(() => {
    const el = document.querySelector<HTMLElement>(
      "[data-pdf-scroll-container]",
    );
    if (!el || pagesRef.current.length === 0) return;
    const next = getVisiblePageNumbers(
      layoutsRef.current,
      el.scrollTop,
      el.clientHeight,
    );
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
  }, []);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(
      "[data-pdf-scroll-container]",
    );
    if (!el) return;
    updateVisiblePages();
    const onScroll = () => {
      if (scrollRafRef.current !== null) return;
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null;
        updateVisiblePages();
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (scrollRafRef.current !== null)
        cancelAnimationFrame(scrollRafRef.current);
    };
  }, [updateVisiblePages]);

  useEffect(() => {
    updateVisiblePages();
  }, [committedZoom, pages, updateVisiblePages]);

  // ── Total scroll height (committed zoom — sets scroll container height) ─
  const totalHeight = useMemo(
    () => getTotalContentHeight(pages, committedZoom),
    [pages, committedZoom],
  );

  // ── Visible page items ─────────────────────────────────────────────────
  const visiblePageItems = useMemo(() => {
    const items: Array<{ page: (typeof pages)[number]; layout: PageLayout }> =
      [];
    for (const num of visiblePages) {
      const page = pages[num - 1];
      const layout = layouts.get(num);
      if (page && layout) items.push({ page, layout });
    }
    return items.sort((a, b) => a.page.pageNumber - b.page.pageNumber);
  }, [pages, visiblePages, layouts]);

  // ── Empty / loading states ─────────────────────────────────────────────
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

  if (pages.length === 0) {
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
      style={{
        height: totalHeight > 0 ? totalHeight : undefined,
      }}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Scale wrapper: GPU-composited during animation */}
      <div
        ref={scaleWrapperRef}
        className="relative flex items-center flex-col w-fit mx-auto"
        style={{
          willChange: "transform",
          transformOrigin: "50% 0",
          gap: PAGE_GAP,
          paddingTop: TOP_PADDING,
          paddingLeft: H_PADDING,
          paddingRight: H_PADDING,
        }}
      >
        {visiblePageItems.map(({ page }) => (
          <div
            key={page.pageNumber}
            className="bg-white shadow-md overflow-hidden w-fit mx-auto"
            data-page-wrapper={page.pageNumber}
            data-page-number={page.pageNumber}
          >
            <PdfPage
              pageNumber={page.pageNumber}
              zoom={committedZoom}
              width={page.width}
              height={page.height}
            />
          </div>
        ))}

        {/* CanvasOverlay is inside the scale wrapper so it moves with pages */}
        <VisiblePagesContext.Provider value={visiblePages}>
          {children}
        </VisiblePagesContext.Provider>
      </div>
    </div>
  );
}
