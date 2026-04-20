/**
 * Rulers — imperative <canvas> drawing.
 * Redraws on committedZoom change (via useLayoutEffect) and on scroll.
 */

import { useScrollContainerRef } from "@/contexts/scroll-container-context";
import { H_PADDING, PAGE_GAP, V_PADDING } from "@/lib/coordinates";
import { lockCursor, unlockCursor } from "@/lib/cursor";
import { getLayoutContentWidth } from "@/lib/page-layout";
import { snapToGrid } from "@/lib/snap-engine";
import { useEditorStore } from "@/stores/editor-store";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type RefObject,
} from "react";
import { useTranslation } from "react-i18next";

const RULER_SIZE = 36;
const MAJOR_INTERVAL = 50;
const MINOR_INTERVAL = 10;
const SUB_INTERVAL = 5;
const MIN_VERTICAL_TICK_PX = 2.5;

interface RulerColors {
  bg: string;
  majorColor: string;
  minorColor: string;
  subColor: string;
  labelColor: string;
}

const FALLBACKS: Record<string, string> = {
  "--ruler-bg": "#1e1e1e",
  "--ruler-tick-major": "#555",
  "--ruler-tick-minor": "#444",
  "--ruler-tick-sub": "#333",
  "--ruler-label": "#888",
};

let cachedColors: RulerColors | null = null;

function resolveRulerColors(canvas: HTMLCanvasElement): RulerColors {
  if (cachedColors) return cachedColors;
  const style = getComputedStyle(canvas);
  cachedColors = {
    bg:
      style.getPropertyValue("--ruler-bg").trim() || FALLBACKS["--ruler-bg"],
    majorColor:
      style.getPropertyValue("--ruler-tick-major").trim() ||
      FALLBACKS["--ruler-tick-major"],
    minorColor:
      style.getPropertyValue("--ruler-tick-minor").trim() ||
      FALLBACKS["--ruler-tick-minor"],
    subColor:
      style.getPropertyValue("--ruler-tick-sub").trim() ||
      FALLBACKS["--ruler-tick-sub"],
    labelColor:
      style.getPropertyValue("--ruler-label").trim() ||
      FALLBACKS["--ruler-label"],
  };
  return cachedColors;
}

export function invalidateRulerColorCache(): void {
  cachedColors = null;
}

// ─── Draw helpers ────────────────────────────────────────────────────────────

function drawHorizontalRuler(
  canvas: HTMLCanvasElement,
  zoom: number,
  pages: Array<{ width: number; height: number }>,
  contentWidth: number,
  scrollLeft: number,
  devicePixelRatio = window.devicePixelRatio || 1,
) {
  const W = canvas.clientWidth || contentWidth;
  const H = RULER_SIZE;
  canvas.width = Math.round(W * devicePixelRatio);
  canvas.height = Math.round(H * devicePixelRatio);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(devicePixelRatio, devicePixelRatio);

  const colors = resolveRulerColors(canvas);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, W, H);

  if (pages.length === 0) return;

  const widestPage = pages.reduce(
    (a, b) => (b.width > a.width ? b : a),
    pages[0],
  );
  const screenWidth = widestPage.width * zoom;
  const xOffset = Math.max(H_PADDING, (contentWidth - screenWidth) / 2);

  const screenSub = SUB_INTERVAL * zoom;

  ctx.font = "10px monospace";
  ctx.textBaseline = "top";

  const step =
    screenSub >= 2.5
      ? SUB_INTERVAL
      : screenSub * (MINOR_INTERVAL / SUB_INTERVAL) >= 3
        ? MINOR_INTERVAL
        : MAJOR_INTERVAL;

  for (let px = 0; px <= widestPage.width; px += step) {
    const screenX = xOffset + px * zoom - scrollLeft;
    if (screenX < 0 || screenX > W) continue;
    const isMajor = px % MAJOR_INTERVAL === 0;
    const isMinor = px % MINOR_INTERVAL === 0;

    const startY = isMajor ? 0 : isMinor ? H * 0.5 : H * 0.65;
    ctx.strokeStyle = isMajor ? colors.majorColor : isMinor ? colors.minorColor : colors.subColor;
    ctx.lineWidth = isMajor ? 1 : 0.5;
    ctx.beginPath();
    ctx.moveTo(screenX, startY);
    ctx.lineTo(screenX, H);
    ctx.stroke();

    if (isMajor && screenX > 2) {
      ctx.fillStyle = colors.labelColor;
      ctx.fillText(String(px), screenX + 3, 3);
    }
  }
}

function drawVerticalRuler(
  canvas: HTMLCanvasElement,
  zoom: number,
  pages: Array<{ width: number; height: number }>,
  viewportHeight: number,
  scrollTop: number,
  devicePixelRatio = window.devicePixelRatio || 1,
) {
  const W = RULER_SIZE;
  const H = viewportHeight;
  canvas.width = Math.round(W * devicePixelRatio);
  canvas.height = Math.round(H * devicePixelRatio);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(devicePixelRatio, devicePixelRatio);

  const colors = resolveRulerColors(canvas);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, W, H);

  if (pages.length === 0) return;

  ctx.font = "10px monospace";
  ctx.textBaseline = "bottom";

  let currentY = V_PADDING;
  for (const page of pages) {
    const screenHeight = page.height * zoom;
    let lastScreenY = -Infinity;

    for (let py = 0; py <= page.height; py += SUB_INTERVAL) {
      const docY = currentY + py * zoom;
      const screenY = docY - scrollTop;
      const isMajor = py % MAJOR_INTERVAL === 0;
      if (!isMajor && docY - lastScreenY < MIN_VERTICAL_TICK_PX) continue;
      lastScreenY = docY;
      if (screenY < 0 || screenY > H) continue;
      const isMinor = py % MINOR_INTERVAL === 0;

      const startX = isMajor ? 0 : isMinor ? W * 0.5 : W * 0.65;
      ctx.strokeStyle = isMajor ? colors.majorColor : isMinor ? colors.minorColor : colors.subColor;
      ctx.lineWidth = isMajor ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(startX, screenY);
      ctx.lineTo(W, screenY);
      ctx.stroke();

      if (isMajor && py > 0) {
        ctx.save();
        ctx.fillStyle = colors.labelColor;
        ctx.translate(W / 2, screenY - 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(String(py), 0, 0);
        ctx.restore();
      }
    }
    currentY += screenHeight + PAGE_GAP;
  }
}

// ─── HorizontalRuler ─────────────────────────────────────────────────────────

interface HorizontalRulerProps {
  overlayWidth: number;
  containerRef: RefObject<HTMLDivElement | null>;
}

export function HorizontalRuler({
  overlayWidth,
  containerRef,
}: HorizontalRulerProps) {
  const { t } = useTranslation();
  const scrollRef = useScrollContainerRef();
  const pages = useEditorStore((s) => s.pages);
  const committedZoom = useEditorStore((s) => s.zoom);
  const pdfBytes = useEditorStore((s) => s.pdfBytes);
  const guides = useEditorStore((s) => s.guides);
  const addGuide = useEditorStore((s) => s.addGuide);
  const removeGuide = useEditorStore((s) => s.removeGuide);
  const setPreviewGuide = useEditorStore((s) => s.setPreviewGuide);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const committedZoomRef = useRef(committedZoom);

  const drawHorizontalAt = useCallback(
    (zoom: number) => {
      if (!canvasRef.current) return;
      const scrollEl = scrollRef.current;
      const sl = scrollEl?.scrollLeft ?? 0;
      const cw = getLayoutContentWidth(pages, zoom, overlayWidth);
      drawHorizontalRuler(canvasRef.current, zoom, pages, cw, sl);
    },
    [pages, overlayWidth, scrollRef],
  );

  useLayoutEffect(() => {
    committedZoomRef.current = committedZoom;
    drawHorizontalAt(committedZoom);
  }, [committedZoom, drawHorizontalAt]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        drawHorizontalAt(committedZoomRef.current);
      });
    };
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [drawHorizontalAt, scrollRef]);

  const getPdfXFromClientX = useCallback(
    (clientX: number, zoom = committedZoomRef.current): number | null => {
      if (pages.length === 0) return null;
      const page = pages[0];
      const screenWidth = page.width * zoom;
      const cw = getLayoutContentWidth(pages, zoom, overlayWidth);
      const xOff = Math.max(H_PADDING, (cw - screenWidth) / 2);
      const rulerEl = containerRef.current;
      if (!rulerEl) return null;
      const scrollEl = scrollRef.current;
      const sl = scrollEl?.scrollLeft ?? rulerEl.scrollLeft;
      const rulerLeft = rulerEl.getBoundingClientRect().left;
      const relX = clientX - rulerLeft + sl;
      return Math.max(0, Math.min(page.width, (relX - xOff) / zoom));
    },
    [pages, overlayWidth, containerRef, scrollRef],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!pdfBytes || pages.length === 0) return;

      const existingGuideHit = guides.find((g) => {
        if (g.orientation !== "vertical") return false;
        const rulerEl = containerRef.current;
        if (!rulerEl) return false;
        const scrollEl = scrollRef.current;
        const sl = scrollEl?.scrollLeft ?? rulerEl.scrollLeft;
        const zoom = committedZoomRef.current;
        const cw = getLayoutContentWidth(pages, zoom, overlayWidth);
        const screenWidth = pages[0].width * zoom;
        const xOff = Math.max(H_PADDING, (cw - screenWidth) / 2);
        const gx = xOff + g.position * zoom - sl;
        const rulerLeft = rulerEl.getBoundingClientRect().left;
        return Math.abs(e.clientX - rulerLeft - gx) < 6;
      });

      if (existingGuideHit) {
        removeGuide(existingGuideHit.id);
        return;
      }

      const pdfX = getPdfXFromClientX(e.clientX);
      if (pdfX !== null)
        setPreviewGuide({
          orientation: "vertical",
          position: e.shiftKey ? snapToGrid(pdfX, SUB_INTERVAL) : pdfX,
        });
      lockCursor("ew");
      const shiftHeld = e.shiftKey;

      const onMove = (ev: MouseEvent) => {
        const raw = getPdfXFromClientX(ev.clientX);
        if (raw !== null)
          setPreviewGuide({
            orientation: "vertical",
            position:
              shiftHeld || ev.shiftKey ? snapToGrid(raw, SUB_INTERVAL) : raw,
          });
      };
      const onUp = (ev: MouseEvent) => {
        unlockCursor();
        setPreviewGuide(null);
        const raw = getPdfXFromClientX(ev.clientX);
        if (raw !== null)
          addGuide(
            "vertical",
            Math.round(
              (shiftHeld || ev.shiftKey ? snapToGrid(raw, SUB_INTERVAL) : raw) *
                10,
            ) / 10,
          );
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [
      pdfBytes,
      pages,
      guides,
      overlayWidth,
      containerRef,
      getPdfXFromClientX,
      addGuide,
      removeGuide,
      setPreviewGuide,
      scrollRef,
    ],
  );

  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={0}
      aria-label={t("ruler.horizontal")}
      className={`shrink-0 bg-ruler-bg border-b border-border relative overflow-hidden select-none ${pdfBytes ? "cursor-ew-resize" : "cursor-default"}`}
      style={{ height: RULER_SIZE, width: overlayWidth }}
      onMouseDown={handleMouseDown}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!pdfBytes || pages.length === 0) return;
          const page = pages[0];
          addGuide("vertical", Math.round(page.width / 2 * 10) / 10);
        }
      }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ display: "block", width: overlayWidth, height: RULER_SIZE }}
      />
    </div>
  );
}

// ─── VerticalRuler ───────────────────────────────────────────────────────────

interface VerticalRulerProps {
  canvasHeight: number;
  containerRef: RefObject<HTMLDivElement | null>;
}

export function VerticalRuler({
  canvasHeight,
  containerRef,
}: VerticalRulerProps) {
  const { t } = useTranslation();
  const scrollRef = useScrollContainerRef();
  const pages = useEditorStore((s) => s.pages);
  const committedZoom = useEditorStore((s) => s.zoom);
  const pdfBytes = useEditorStore((s) => s.pdfBytes);
  const guides = useEditorStore((s) => s.guides);
  const addGuide = useEditorStore((s) => s.addGuide);
  const removeGuide = useEditorStore((s) => s.removeGuide);
  const setPreviewGuide = useEditorStore((s) => s.setPreviewGuide);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const committedZoomRef = useRef(committedZoom);

  const drawVerticalAt = useCallback(
    (zoom: number) => {
      if (!canvasRef.current) return;
      const scrollEl = scrollRef.current;
      const st = scrollEl?.scrollTop ?? 0;
      drawVerticalRuler(canvasRef.current, zoom, pages, canvasHeight, st);
    },
    [pages, canvasHeight, scrollRef],
  );

  useLayoutEffect(() => {
    committedZoomRef.current = committedZoom;
    drawVerticalAt(committedZoom);
  }, [committedZoom, canvasHeight, drawVerticalAt]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        drawVerticalAt(committedZoomRef.current);
      });
    };
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [drawVerticalAt, scrollRef]);

  const getPdfYFromClientY = useCallback(
    (clientY: number, zoom = committedZoomRef.current): number | null => {
      if (pages.length === 0) return null;
      const rulerEl = containerRef.current;
      if (!rulerEl) return null;
      const scrollEl = scrollRef.current;
      const st = scrollEl?.scrollTop ?? 0;
      const rulerTop = rulerEl.getBoundingClientRect().top;
      const relY = clientY - rulerTop + st;
      let yOff = V_PADDING;
      for (const page of pages) {
        const ph = page.height * zoom;
        if (relY >= yOff && relY < yOff + ph)
          return Math.max(0, Math.min(page.height, (relY - yOff) / zoom));
        yOff += ph + PAGE_GAP;
      }
      const last = pages[pages.length - 1];
      return Math.max(
        0,
        Math.min(
          last.height,
          (relY - yOff + last.height * zoom + PAGE_GAP) / zoom,
        ),
      );
    },
    [pages, containerRef, scrollRef],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!pdfBytes || pages.length === 0) return;

      const existingGuideHit = guides.find((g) => {
        if (g.orientation !== "horizontal") return false;
        const rulerEl = containerRef.current;
        if (!rulerEl) return false;
        const scrollEl = scrollRef.current;
        const st = scrollEl?.scrollTop ?? 0;
        const zoom = committedZoomRef.current;
        const rulerTop = rulerEl.getBoundingClientRect().top;
        let yOff = V_PADDING;
        for (const page of pages) {
          const gy = yOff + g.position * zoom - st;
          if (Math.abs(e.clientY - rulerTop - gy) < 6) return true;
          yOff += page.height * zoom + PAGE_GAP;
        }
        return false;
      });

      if (existingGuideHit) {
        removeGuide(existingGuideHit.id);
        return;
      }

      const pdfY = getPdfYFromClientY(e.clientY);
      if (pdfY !== null)
        setPreviewGuide({
          orientation: "horizontal",
          position: e.shiftKey ? snapToGrid(pdfY, SUB_INTERVAL) : pdfY,
        });
      lockCursor("ns");
      const shiftHeld = e.shiftKey;

      const onMove = (ev: MouseEvent) => {
        const raw = getPdfYFromClientY(ev.clientY);
        if (raw !== null)
          setPreviewGuide({
            orientation: "horizontal",
            position:
              shiftHeld || ev.shiftKey ? snapToGrid(raw, SUB_INTERVAL) : raw,
          });
      };
      const onUp = (ev: MouseEvent) => {
        unlockCursor();
        setPreviewGuide(null);
        const raw = getPdfYFromClientY(ev.clientY);
        if (raw !== null)
          addGuide(
            "horizontal",
            Math.round(
              (shiftHeld || ev.shiftKey ? snapToGrid(raw, SUB_INTERVAL) : raw) *
                10,
            ) / 10,
          );
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [
      pdfBytes,
      pages,
      guides,
      containerRef,
      getPdfYFromClientY,
      addGuide,
      removeGuide,
      setPreviewGuide,
      scrollRef,
    ],
  );

  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={0}
      aria-label={t("ruler.vertical")}
      className={`shrink-0 bg-ruler-bg border-r border-border relative select-none ${pdfBytes ? "cursor-ns-resize" : "cursor-default"}`}
      style={{ width: RULER_SIZE, height: canvasHeight, overflow: "hidden" }}
      onMouseDown={handleMouseDown}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!pdfBytes || pages.length === 0) return;
          const page = pages[0];
          addGuide("horizontal", Math.round(page.height / 2 * 10) / 10);
        }
      }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ display: "block", width: RULER_SIZE, height: canvasHeight }}
      />
    </div>
  );
}

export function RulerCorner() {
  return (
    <div
      className="shrink-0 bg-ruler-bg border-b border-r border-border select-none"
      style={{ width: RULER_SIZE, height: RULER_SIZE }}
    />
  );
}

export { RULER_SIZE };
