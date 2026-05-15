import { Kbd } from "@/components/ui/kbd";
import { useScrollContainerRef } from "@/contexts/scroll-container-context";
import { VisiblePagesContext } from "@/contexts/visible-pages";
import {
  computePageLayouts as computeLayouts,
  getLayoutContentWidth,
  getTotalContentHeight,
  getVisiblePageNumbers,
  preserveViewportScrollAfterZoomChange,
  type PageLayout,
} from "@/lib/page-layout";
import {
  getRenderManager,
  type RenderHandle,
  type RenderResult,
} from "@/lib/render-worker-manager";
import { getZoomEngine, type ZoomListener } from "@/lib/use-zoom-animation";
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
const VIRTUAL_OVERSCAN = 1;

interface PdfPageProps {
  pageNumber: number;
  zoom: number;
}

const PdfPage = memo(function PdfPage({ pageNumber, zoom }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<RenderHandle | null>(null);
  const rasterZoomRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (rasterZoomRef.current === zoom) return;

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    handleRef.current?.cancel();
    handleRef.current = null;

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const handle = getRenderManager().renderPage(pageNumber, zoom);
      handleRef.current = handle;

      handle.promise
        .then(({ bitmap, renderedScale }: RenderResult) => {
          handleRef.current = null;
          // rAF: the first drawImage on a just-mounted canvas can land before
          // WebKit allocates its GPU backing, producing a blank page until
          // something (e.g. zoom change) reallocates the canvas.
          requestAnimationFrame(() => {
            const canvas = canvasRef.current;
            if (!canvas) {
              bitmap.close();
              return;
            }
            if (
              canvas.width !== bitmap.width ||
              canvas.height !== bitmap.height
            ) {
              canvas.width = bitmap.width;
              canvas.height = bitmap.height;
            }
            const displayCtx = canvas.getContext("2d", { alpha: false });
            displayCtx?.drawImage(bitmap, 0, 0);
            bitmap.close();
            rasterZoomRef.current = renderedScale;
          });
        })
        .catch((err) => {
          if (!(err instanceof Error) || !err.message.includes("cancelled"))
            console.error("[PdfPage] render failed:", err);
        });
    }, RASTERIZE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      handleRef.current?.cancel();
      handleRef.current = null;
    };
  }, [pageNumber, zoom]);

  return (
    <canvas
      ref={canvasRef}
      className="block pointer-events-none bg-white w-full h-full"
    />
  );
});

interface PdfCanvasProps {
  children?: ReactNode;
}

export function PdfCanvas({ children }: PdfCanvasProps) {
  const { t } = useTranslation();
  const scrollRef = useScrollContainerRef();
  const pdfBytes = useEditorStore((s) => s.renderPdfBytes ?? s.pdfBytes);
  const pages = useEditorStore((s) => s.pages);
  const committedZoom = useEditorStore((s) => s.zoom);

  const outerRef = useRef<HTMLDivElement>(null);
  const committedZoomRef = useRef(committedZoom);
  const pageWrapperRefs = useRef<Map<number, HTMLElement>>(new Map());

  useEffect(() => {
    if (!pdfBytes) return;
    getRenderManager()
      .load(pdfBytes)
      .catch((err) => console.error("[PdfCanvas] load failed:", err));
    return () => getRenderManager().cancelAll();
  }, [pdfBytes]);

  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const layouts = useMemo(
    () => computeLayouts(pages, committedZoom, containerWidth),
    [pages, committedZoom, containerWidth],
  );
  const totalHeight = useMemo(
    () =>
      getTotalContentHeight(pages, committedZoom, containerHeight || undefined),
    [pages, committedZoom, containerHeight],
  );
  const layoutContentWidth = useMemo(
    () => getLayoutContentWidth(pages, committedZoom, containerWidth),
    [pages, committedZoom, containerWidth],
  );

  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set());
  const layoutsRef = useRef(layouts);
  layoutsRef.current = layouts;
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  const scrollRafRef = useRef<number | null>(null);

  const computeVisibleSet = useCallback((): Set<number> => {
    const el = scrollRef.current;
    if (!el || pagesRef.current.length === 0) return new Set();
    const raw = getVisiblePageNumbers(
      layoutsRef.current,
      el.scrollTop,
      el.clientHeight,
    );
    const arr = [...raw].sort((a, b) => a - b);
    const lo = Math.max(1, (arr[0] ?? 1) - VIRTUAL_OVERSCAN);
    const hi = Math.min(
      pagesRef.current.length,
      (arr[arr.length - 1] ?? 1) + VIRTUAL_OVERSCAN,
    );
    const s = new Set<number>();
    for (let i = lo; i <= hi; i++) s.add(i);
    return s;
  }, []);

  const pendingScrollCorrectionRef = useRef<{
    scrollTop: number;
    oldZoom: number;
    oldVpH: number;
  } | null>(null);

  useEffect(() => {
    const listener: ZoomListener = {
      onZoomSettle(_zoom: number) {
        const scrollEl = scrollRef.current;
        if (scrollEl && pagesRef.current.length > 0) {
          pendingScrollCorrectionRef.current = {
            scrollTop: scrollEl.scrollTop,
            oldZoom: committedZoomRef.current,
            oldVpH: scrollEl.clientHeight,
          };
        }
      },
    };

    getZoomEngine().addListener(listener);
    return () => getZoomEngine().removeListener(listener);
  }, []);

  useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const pending = pendingScrollCorrectionRef.current;
    if (pending && pages.length > 0) {
      preserveViewportScrollAfterZoomChange(
        scrollEl,
        pages,
        pending.oldZoom,
        committedZoom,
        pending.scrollTop,
        pending.oldVpH,
      );
      pendingScrollCorrectionRef.current = null;
    }
    committedZoomRef.current = committedZoom;

    const next = computeVisibleSet();
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

    const w = scrollEl.clientWidth;
    const h = scrollEl.clientHeight;
    if (w !== containerWidth) {
      setContainerWidth(w);
    }
    if (h !== containerHeight) {
      setContainerHeight(h);
    }
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (scrollRafRef.current !== null) return;
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null;
        const next = computeVisibleSet();
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
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (scrollRafRef.current !== null)
        cancelAnimationFrame(scrollRafRef.current);
    };
  }, [computeVisibleSet]);

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
            aria-hidden="true"
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
          <div className="flex flex-col gap-1.5 text-[11px] text-muted-foreground/70">
            <div className="flex items-center gap-2">
              <Kbd>Ctrl</Kbd>+<Kbd>O</Kbd>
              <span>{t("canvas.openPdf")}</span>
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
          <svg
            className="h-6 w-6 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
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
        minWidth: layoutContentWidth > 0 ? layoutContentWidth : undefined,
      }}
      onDragStart={(e) => e.preventDefault()}
    >
      {visiblePageItems.map(({ page, layout }) => (
        <div
          key={page.pageNumber}
          ref={(el) => {
            if (el) pageWrapperRefs.current.set(page.pageNumber, el);
          }}
          className="absolute bg-white shadow-md overflow-hidden"
          style={{
            left: layout.xOffset,
            top: layout.yOffset,
            width: layout.screenWidth,
            height: layout.screenHeight,
          }}
          data-page-wrapper={page.pageNumber}
          data-page-number={page.pageNumber}
        >
          <PdfPage pageNumber={page.pageNumber} zoom={committedZoom} />
        </div>
      ))}

      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: layoutContentWidth > 0 ? layoutContentWidth : undefined,
          height: totalHeight > 0 ? totalHeight : undefined,
        }}
      >
        <VisiblePagesContext.Provider value={visiblePages}>
          {children}
        </VisiblePagesContext.Provider>
      </div>
    </div>
  );
}
