import { Kbd } from "@/components/ui/kbd";
import { VisiblePagesContext } from "@/contexts/visible-pages";
import {
  computePageLayouts as computeLayouts,
  getLayoutContentWidth,
  getTotalContentHeight,
  getVisiblePageNumbers,
  preserveViewportScrollAfterZoomChange,
  sampleViewportPdfAnchor,
  PAGE_GAP,
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
  Fragment,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { flushSync } from "react-dom";

const RASTERIZE_DEBOUNCE_MS = 200;
/** Must match SETTLE_THRESHOLD in use-zoom-animation (live vs committed during lerp). */
const ZOOM_LERP_ACTIVE_THRESHOLD = 0.0003;

// ─── PdfPage ────────────────────────────────────────────────────────────────
// Renders one page. Rasterizes at the committed zoom (debounced).
// During lerp the scale wrapper uses transform: scale(live/committed); layout stays at committed zoom.

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
  /** CSS size matches last drawn bitmap zoom — avoids stretched flash before raster completes. */
  const [displayedRasterZoom, setDisplayedRasterZoom] = useState(zoom);

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
      ) {
        const c = canvasRef.current;
        c.style.width = `${width * zoom}px`;
        c.style.height = `${height * zoom}px`;
        flushSync(() => {
          setDisplayedRasterZoom(zoom);
        });
        return;
      }

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
          if (ctx) {
            ctx.drawImage(bitmap, 0, 0);
          }
          bitmap.close();
          rasterZoomRef.current = renderedScale;
          const sw = `${width * zoom}px`;
          const sh = `${height * zoom}px`;
          canvas.style.width = sw;
          canvas.style.height = sh;
          flushSync(() => {
            setDisplayedRasterZoom(zoom);
          });
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

  return (
    <canvas
      ref={canvasRef}
      className="block pointer-events-none bg-white"
      style={{
        width: width * displayedRasterZoom,
        height: height * displayedRasterZoom,
      }}
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
  const outerRef = useRef<HTMLDivElement>(null);
  const scaleWrapperRef = useRef<HTMLDivElement>(null);
  const committedZoomRef = useRef(committedZoom);
  /** Captured in engine onZoomSettle (before React relayout) for stable anchor math. */
  const pendingScrollAnchorRef = useRef<{
    scrollTop: number;
    oldZoom: number;
    visualAnchor: { pageNum: number; pdfY: number } | null;
  } | null>(null);

  useLayoutEffect(() => {
    committedZoomRef.current = committedZoom;
    if (scaleWrapperRef.current) {
      scaleWrapperRef.current.style.transform = "scale(1)";
      scaleWrapperRef.current.style.transformOrigin = "50% 0";
      scaleWrapperRef.current.style.setProperty("--zoom-inv", "1");
    }

    const pending = pendingScrollAnchorRef.current;
    if (pending && pages.length > 0) {
      const scrollEl = document.querySelector<HTMLElement>(
        "[data-pdf-scroll-container]",
      );
      if (scrollEl) {
        preserveViewportScrollAfterZoomChange(
          scrollEl,
          pages,
          pending.oldZoom,
          committedZoom,
          pending.scrollTop,
          pending.visualAnchor,
        );
      }
      pendingScrollAnchorRef.current = null;
    }
  }, [committedZoom, pages]);

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
  /** While true, zoom CSS lerp is active — show all pages (virtualization bypass). */
  const zoomVirtualizeAllRef = useRef(false);
  const scrollRafRef = useRef<number | null>(null);

  const updateVisiblePages = useCallback(() => {
    const el = document.querySelector<HTMLElement>(
      "[data-pdf-scroll-container]",
    );
    if (!el || pagesRef.current.length === 0) return;
    if (zoomVirtualizeAllRef.current) {
      const all = new Set(pagesRef.current.map((p) => p.pageNumber));
      setVisiblePages((prev) => {
        if (prev.size === all.size) {
          let same = true;
          for (const p of all) {
            if (!prev.has(p)) {
              same = false;
              break;
            }
          }
          if (same) return prev;
        }
        return all;
      });
      return;
    }
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

  // ── Zoom engine listener (CSS scale lerp + virtualization widen)
  useEffect(() => {
    const listener: ZoomListener = {
      onZoomTick(liveZoom) {
        const wrapper = scaleWrapperRef.current;
        const outer = outerRef.current;
        if (!wrapper) return;
        const base = committedZoomRef.current;
        if (base <= 0) return;

        if (
          Math.abs(liveZoom - base) > ZOOM_LERP_ACTIVE_THRESHOLD &&
          !zoomVirtualizeAllRef.current
        ) {
          zoomVirtualizeAllRef.current = true;
          setVisiblePages(
            new Set(pagesRef.current.map((p) => p.pageNumber)),
          );
        }

        const s = liveZoom / base;
        const scrollEl = document.querySelector<HTMLElement>(
          "[data-pdf-scroll-container]",
        );
        const engine = getZoomEngine();
        const origin = engine.getOrigin();

        wrapper.style.transform = `scale(${s})`;
        wrapper.style.setProperty("--zoom-inv", String(1 / s));
        if (scrollEl && outer) {
          wrapper.style.transformOrigin = getPdfScaleTransformOrigin(
            scrollEl,
            outer,
            wrapper,
            origin,
          );
        } else {
          wrapper.style.transformOrigin = "50% 0";
        }
      },
      onZoomSettle() {
        zoomVirtualizeAllRef.current = false;
        const scrollEl = document.querySelector<HTMLElement>(
          "[data-pdf-scroll-container]",
        );
        if (scrollEl && pagesRef.current.length > 0) {
          pendingScrollAnchorRef.current = {
            scrollTop: scrollEl.scrollTop,
            oldZoom: committedZoomRef.current,
            visualAnchor: sampleViewportPdfAnchor(scrollEl, pagesRef.current),
          };
        }
      },
    };

    getZoomEngine().addListener(listener);
    return () => getZoomEngine().removeListener(listener);
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

  /** Min width so the outer does not collapse when children are position:absolute. */
  const layoutContentWidth = useMemo(
    () => getLayoutContentWidth(pages, committedZoom, containerWidth),
    [pages, committedZoom, containerWidth],
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
      ref={outerRef}
      className="relative min-w-full bg-muted/20"
      style={{
        height: totalHeight > 0 ? totalHeight : undefined,
        minWidth:
          layoutContentWidth > 0 ? layoutContentWidth : undefined,
      }}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Scale wrapper: full document box; pages are absolutely placed at layout offsets */}
      <div
        ref={scaleWrapperRef}
        className="relative w-full min-w-0"
        style={
          {
            willChange: "transform",
            transformOrigin: "50% 0",
            height: totalHeight > 0 ? totalHeight : undefined,
            minWidth:
              layoutContentWidth > 0 ? layoutContentWidth : undefined,
            "--zoom-inv": 1,
          } as CSSProperties
        }
      >
        {visiblePageItems.map(({ page, layout }, idx) => (
          <Fragment key={page.pageNumber}>
            <div
              className="absolute bg-white shadow-md overflow-hidden"
              style={{
                left: layout.xOffset,
                top: layout.yOffset,
                width: layout.screenWidth,
              }}
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
            {idx < visiblePageItems.length - 1 &&
              visiblePageItems[idx + 1]!.page.pageNumber ===
                page.pageNumber + 1 && (
                <div
                  aria-hidden
                  data-zoom-gap
                  className="absolute left-0 right-0 overflow-hidden pointer-events-none"
                  style={{
                    top: layout.yOffset + layout.screenHeight,
                    height: PAGE_GAP,
                    transformOrigin: "top center",
                    transform: "scale(var(--zoom-inv, 1))",
                  }}
                />
              )}
          </Fragment>
        ))}

        {/* CanvasOverlay is inside the scale wrapper so it moves with pages */}
        <VisiblePagesContext.Provider value={visiblePages}>
          {children}
        </VisiblePagesContext.Provider>
      </div>
    </div>
  );
}
