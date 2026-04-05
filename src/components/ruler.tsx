/**
 * Rulers — imperative <canvas> drawing.
 * Redraws on committedZoom change (via useLayoutEffect) and on scroll.
 */

import { H_PADDING, PAGE_GAP, TOP_PADDING } from "@/lib/coordinates";
import type { PageInfo } from "@/lib/pdf-loader";
import { getLayoutContentWidth, getTotalContentHeight } from "@/lib/page-layout";
import { lockCursor, unlockCursor } from "@/lib/cursor";
import { snapToGrid } from "@/lib/snap-engine";
import { getScrollContainer } from "@/lib/dom-utils";
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

function verticalRulerContentHeight(
  pages: Array<{ height: number }>,
  zoom: number,
  canvasHeight: number,
): number {
  if (pages.length === 0) return canvasHeight;
  const docH = getTotalContentHeight(pages as PageInfo[], zoom);
  return Math.max(docH, canvasHeight);
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

  const bg =
    getComputedStyle(canvas).getPropertyValue("--ruler-bg").trim() || "#1e1e1e";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  if (pages.length === 0) return;

  const widestPage = pages.reduce(
    (a, b) => (b.width > a.width ? b : a),
    pages[0],
  );
  const screenWidth = widestPage.width * zoom;
  const xOffset = Math.max(H_PADDING, (contentWidth - screenWidth) / 2);

  const majorColor =
    getComputedStyle(canvas).getPropertyValue("--ruler-tick-major").trim() ||
    "#555";
  const minorColor =
    getComputedStyle(canvas).getPropertyValue("--ruler-tick-minor").trim() ||
    "#444";
  const subColor =
    getComputedStyle(canvas).getPropertyValue("--ruler-tick-sub").trim() ||
    "#333";
  const labelColor =
    getComputedStyle(canvas).getPropertyValue("--ruler-label").trim() || "#888";

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
    ctx.strokeStyle = isMajor ? majorColor : isMinor ? minorColor : subColor;
    ctx.lineWidth = isMajor ? 1 : 0.5;
    ctx.beginPath();
    ctx.moveTo(screenX, startY);
    ctx.lineTo(screenX, H);
    ctx.stroke();

    if (isMajor && screenX > 2) {
      ctx.fillStyle = labelColor;
      ctx.fillText(String(px), screenX + 3, 3);
    }
  }
}

function drawVerticalRuler(
  canvas: HTMLCanvasElement,
  zoom: number,
  pages: Array<{ width: number; height: number }>,
  contentHeight: number,
  devicePixelRatio = window.devicePixelRatio || 1,
) {
  const W = RULER_SIZE;
  const H = contentHeight;
  canvas.width = Math.round(W * devicePixelRatio);
  canvas.height = Math.round(H * devicePixelRatio);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(devicePixelRatio, devicePixelRatio);

  const bg =
    getComputedStyle(canvas).getPropertyValue("--ruler-bg").trim() || "#1e1e1e";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  if (pages.length === 0) return;

  const majorColor =
    getComputedStyle(canvas).getPropertyValue("--ruler-tick-major").trim() ||
    "#555";
  const minorColor =
    getComputedStyle(canvas).getPropertyValue("--ruler-tick-minor").trim() ||
    "#444";
  const subColor =
    getComputedStyle(canvas).getPropertyValue("--ruler-tick-sub").trim() ||
    "#333";
  const labelColor =
    getComputedStyle(canvas).getPropertyValue("--ruler-label").trim() || "#888";

  ctx.font = "10px monospace";
  ctx.textBaseline = "bottom";

  let currentY = TOP_PADDING;
  for (const page of pages) {
    const screenHeight = page.height * zoom;
    let lastScreenY = -Infinity;

    for (let py = 0; py <= page.height; py += SUB_INTERVAL) {
      const screenY = currentY + py * zoom;
      const isMajor = py % MAJOR_INTERVAL === 0;
      if (!isMajor && screenY - lastScreenY < MIN_VERTICAL_TICK_PX) continue;
      lastScreenY = screenY;
      if (screenY < 0 || screenY > H) continue;
      const isMinor = py % MINOR_INTERVAL === 0;

      const startX = isMajor ? 0 : isMinor ? W * 0.5 : W * 0.65;
      ctx.strokeStyle = isMajor ? majorColor : isMinor ? minorColor : subColor;
      ctx.lineWidth = isMajor ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(startX, screenY);
      ctx.lineTo(W, screenY);
      ctx.stroke();

      if (isMajor && py > 0) {
        ctx.save();
        ctx.fillStyle = labelColor;
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
      const scrollEl = getScrollContainer();
      const sl = scrollEl?.scrollLeft ?? 0;
      const cw = getLayoutContentWidth(pages, zoom, overlayWidth);
      drawHorizontalRuler(canvasRef.current, zoom, pages, cw, sl);
    },
    [pages, overlayWidth],
  );

  useLayoutEffect(() => {
    committedZoomRef.current = committedZoom;
    drawHorizontalAt(committedZoom);
  }, [committedZoom, drawHorizontalAt]);

  useEffect(() => {
    const scrollEl = getScrollContainer();
    if (!scrollEl) return;
    const onScroll = () => drawHorizontalAt(committedZoomRef.current);
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, [drawHorizontalAt]);

  const getPdfXFromClientX = useCallback(
    (clientX: number, zoom = committedZoomRef.current): number | null => {
      if (pages.length === 0) return null;
      const page = pages[0];
      const screenWidth = page.width * zoom;
      const cw = getLayoutContentWidth(pages, zoom, overlayWidth);
      const xOff = Math.max(H_PADDING, (cw - screenWidth) / 2);
      const rulerEl = containerRef.current;
      if (!rulerEl) return null;
      const scrollEl = getScrollContainer();
      const sl = scrollEl?.scrollLeft ?? rulerEl.scrollLeft;
      const rulerLeft = rulerEl.getBoundingClientRect().left;
      const relX = clientX - rulerLeft + sl;
      return Math.max(0, Math.min(page.width, (relX - xOff) / zoom));
    },
    [pages, overlayWidth, containerRef],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!pdfBytes || pages.length === 0) return;

      const existingGuideHit = guides.find((g) => {
        if (g.orientation !== "vertical") return false;
        const rulerEl = containerRef.current;
        if (!rulerEl) return false;
        const scrollEl = getScrollContainer();
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
    ],
  );

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label={t("ruler.horizontal")}
      className={`shrink-0 bg-ruler-bg border-b border-border relative overflow-hidden select-none ${pdfBytes ? "cursor-ew-resize" : "cursor-default"}`}
      style={{ height: RULER_SIZE, width: overlayWidth }}
      onMouseDown={handleMouseDown}
    >
      <canvas
        ref={canvasRef}
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
  const pages = useEditorStore((s) => s.pages);
  const committedZoom = useEditorStore((s) => s.zoom);
  const pdfBytes = useEditorStore((s) => s.pdfBytes);
  const guides = useEditorStore((s) => s.guides);
  const addGuide = useEditorStore((s) => s.addGuide);
  const removeGuide = useEditorStore((s) => s.removeGuide);
  const setPreviewGuide = useEditorStore((s) => s.setPreviewGuide);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const committedZoomRef = useRef(committedZoom);

  const syncVerticalRulerScroll = useCallback(
    () => {
      const scrollEl = getScrollContainer();
      const container = containerRef.current;
      if (!container || !scrollEl) return;

      container.scrollTop = scrollEl.scrollTop;
    },
    [containerRef],
  );

  const drawVerticalAt = useCallback(
    (zoom: number) => {
      if (!canvasRef.current) return;
      const ch = verticalRulerContentHeight(pages, zoom, canvasHeight);
      canvasRef.current.style.height = `${ch}px`;
      drawVerticalRuler(canvasRef.current, zoom, pages, ch);
      syncVerticalRulerScroll();
    },
    [pages, canvasHeight, syncVerticalRulerScroll],
  );

  useLayoutEffect(() => {
    committedZoomRef.current = committedZoom;
    queueMicrotask(() => {
      drawVerticalAt(committedZoom);
    });
  }, [committedZoom, canvasHeight, drawVerticalAt]);

  useEffect(() => {
    const scrollEl = getScrollContainer();
    if (!scrollEl) return;
    const onScroll = () => syncVerticalRulerScroll();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, [syncVerticalRulerScroll]);

  const getPdfYFromClientY = useCallback(
    (clientY: number, zoom = committedZoomRef.current): number | null => {
      if (pages.length === 0) return null;
      const rulerEl = containerRef.current;
      if (!rulerEl) return null;
      const rulerTop = rulerEl.getBoundingClientRect().top;
      const relY = clientY - rulerTop + rulerEl.scrollTop;
      let yOff = TOP_PADDING;
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
    [pages, containerRef],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!pdfBytes || pages.length === 0) return;

      const existingGuideHit = guides.find((g) => {
        if (g.orientation !== "horizontal") return false;
        const rulerEl = containerRef.current;
        if (!rulerEl) return false;
        const zoom = committedZoomRef.current;
        const rulerTop = rulerEl.getBoundingClientRect().top;
        let yOff = TOP_PADDING;
        for (const page of pages) {
          const gy = yOff + g.position * zoom - rulerEl.scrollTop;
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
    ],
  );

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label={t("ruler.vertical")}
      className={`shrink-0 bg-ruler-bg border-r border-border relative select-none ${pdfBytes ? "cursor-ns-resize" : "cursor-default"}`}
      style={{ width: RULER_SIZE, height: canvasHeight, overflow: "hidden" }}
      onMouseDown={handleMouseDown}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: RULER_SIZE }}
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
