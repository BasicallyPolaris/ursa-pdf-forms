import { H_PADDING, PAGE_GAP, TOP_PADDING } from "@/lib/coordinates";
import { lockCursor, unlockCursor } from "@/lib/cursor";
import { useEditorStore } from "@/stores/editor-store";
import { useCallback, type RefObject } from "react";
import { useTranslation } from "react-i18next";

const RULER_SIZE = 36;
const MAJOR_INTERVAL = 50;
const MINOR_INTERVAL = 10;
const SUB_INTERVAL = 5;

function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

interface HorizontalRulerProps {
  overlayWidth: number;
  containerRef: RefObject<HTMLDivElement | null>;
}

export function HorizontalRuler({
  overlayWidth,
  containerRef,
}: HorizontalRulerProps) {
  const { t } = useTranslation();
  const { pages, zoom, pdfBytes } = useEditorStore();
  const addGuide = useEditorStore((s) => s.addGuide);
  const removeGuide = useEditorStore((s) => s.removeGuide);
  const setPreviewGuide = useEditorStore((s) => s.setPreviewGuide);
  const guides = useEditorStore((s) => s.guides);

  const maxScreenWidth =
    pages.length > 0 ? Math.max(...pages.map((p) => p.width * zoom)) : 0;
  const contentWidth = Math.max(maxScreenWidth + 2 * H_PADDING, overlayWidth);

  const ticks: Array<{ x: number; level: number; label?: string }> = [];

  for (const page of pages) {
    const screenWidth = page.width * zoom;
    const xOffset = (contentWidth - screenWidth) / 2;
    const screenSubInterval = SUB_INTERVAL * zoom;

    if (screenSubInterval >= 2.5) {
      for (let px = 0; px <= screenWidth; px += screenSubInterval) {
        const screenX = xOffset + px;
        const pdfVal = Math.round(px / zoom);
        const isMajor = pdfVal % MAJOR_INTERVAL === 0;
        const isMinor = pdfVal % MINOR_INTERVAL === 0;
        ticks.push({
          x: screenX,
          level: isMajor ? 0 : isMinor ? 1 : 2,
          label: isMajor ? String(pdfVal) : undefined,
        });
      }
    } else {
      const screenMinorInterval = MINOR_INTERVAL * zoom;
      if (screenMinorInterval >= 3) {
        for (let px = 0; px <= screenWidth; px += screenMinorInterval) {
          const screenX = xOffset + px;
          const isMajor = Math.abs(Math.round(px / zoom) % MAJOR_INTERVAL) < 1;
          ticks.push({
            x: screenX,
            level: isMajor ? 0 : 1,
            label: isMajor ? String(Math.round(px / zoom)) : undefined,
          });
        }
      }
    }
  }

  const getPdfXFromClientX = useCallback(
    (clientX: number): number | null => {
      if (pages.length === 0) return null;
      const page = pages[0];
      const screenWidth = page.width * zoom;
      const xOff = (contentWidth - screenWidth) / 2;
      const rulerEl = containerRef.current;
      if (!rulerEl) return null;
      const rulerLeft = rulerEl.getBoundingClientRect().left;
      const currentScrollLeft = rulerEl.scrollLeft;
      const relX = clientX - rulerLeft + currentScrollLeft;
      const pdfX = (relX - xOff) / zoom;
      return Math.max(0, Math.min(page.width, pdfX));
    },
    [pages, zoom, contentWidth, containerRef],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const rulerEl = containerRef.current;
      if (!rulerEl || pages.length === 0) return;
      const rulerLeft = rulerEl.getBoundingClientRect().left;
      const currentScrollLeft = rulerEl.scrollLeft;

      const existingGuideHit = guides.find((g) => {
        if (g.orientation !== "vertical") return false;
        const page = pages[0];
        if (!page) return false;
        const screenWidth = page.width * zoom;
        const xOff = (contentWidth - screenWidth) / 2;
        const contentGuideX = xOff + g.position * zoom;
        const visibleGuideX = contentGuideX - currentScrollLeft;
        return Math.abs(e.clientX - rulerLeft - visibleGuideX) < 6;
      });

      if (existingGuideHit) {
        removeGuide(existingGuideHit.id);
        return;
      }

      const pdfX = getPdfXFromClientX(e.clientX);
      if (pdfX !== null) {
        const pos = e.shiftKey ? snapToGrid(pdfX, SUB_INTERVAL) : pdfX;
        setPreviewGuide({ orientation: "vertical", position: pos });
      }
      lockCursor("ew");

      const shiftHeld = e.shiftKey;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const rawPos = getPdfXFromClientX(moveEvent.clientX);
        if (rawPos !== null) {
          const pos =
            shiftHeld || moveEvent.shiftKey
              ? snapToGrid(rawPos, SUB_INTERVAL)
              : rawPos;
          setPreviewGuide({ orientation: "vertical", position: pos });
        }
      };

      const onMouseUp = (upEvent: MouseEvent) => {
        unlockCursor();
        setPreviewGuide(null);
        const rawPos = getPdfXFromClientX(upEvent.clientX);
        if (rawPos !== null) {
          const pos =
            shiftHeld || upEvent.shiftKey
              ? snapToGrid(rawPos, SUB_INTERVAL)
              : rawPos;
          addGuide("vertical", Math.round(pos * 10) / 10);
        }
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [
      addGuide,
      removeGuide,
      setPreviewGuide,
      guides,
      pages,
      zoom,
      contentWidth,
      containerRef,
      getPdfXFromClientX,
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
      <svg width={contentWidth} height={RULER_SIZE} className="block">
        {ticks.map((tick, i) => {
          const startY =
            tick.level === 0
              ? 0
              : tick.level === 1
                ? RULER_SIZE * 0.5
                : RULER_SIZE * 0.65;
          const stroke =
            tick.level === 0
              ? "var(--ruler-tick-major)"
              : tick.level === 1
                ? "var(--ruler-tick-minor)"
                : "var(--ruler-tick-sub)";
          return (
            <g key={i}>
              <line
                x1={tick.x}
                y1={startY}
                x2={tick.x}
                y2={RULER_SIZE}
                stroke={stroke}
                strokeWidth={tick.level === 0 ? 1 : 0.5}
              />
              {tick.label && (
                <text
                  x={Math.round(tick.x) + 4}
                  y={12}
                  fill="var(--ruler-label)"
                  fontSize={10}
                  fontFamily="monospace"
                  textAnchor="start"
                >
                  {tick.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

interface VerticalRulerProps {
  canvasHeight: number;
  containerRef: RefObject<HTMLDivElement | null>;
}

export function VerticalRuler({
  canvasHeight,
  containerRef,
}: VerticalRulerProps) {
  const { t } = useTranslation();
  const { pages, zoom, pdfBytes } = useEditorStore();
  const addGuide = useEditorStore((s) => s.addGuide);
  const removeGuide = useEditorStore((s) => s.removeGuide);
  const setPreviewGuide = useEditorStore((s) => s.setPreviewGuide);
  const guides = useEditorStore((s) => s.guides);

  let contentHeight = TOP_PADDING;
  for (let i = 0; i < pages.length; i++) {
    contentHeight += pages[i].height * zoom;
    if (i < pages.length - 1) contentHeight += PAGE_GAP;
  }
  contentHeight += TOP_PADDING;
  contentHeight = Math.max(contentHeight, canvasHeight);

  const ticks: Array<{ y: number; level: number; label?: string }> = [];
  let currentY = TOP_PADDING;

  for (const page of pages) {
    const screenHeight = page.height * zoom;
    const screenSubInterval = SUB_INTERVAL * zoom;

    if (screenSubInterval >= 2.5) {
      for (let py = 0; py <= screenHeight; py += screenSubInterval) {
        const screenY = currentY + py;
        const pdfVal = Math.round(py / zoom);
        const isMajor = pdfVal % MAJOR_INTERVAL === 0;
        const isMinor = pdfVal % MINOR_INTERVAL === 0;
        ticks.push({
          y: screenY,
          level: isMajor ? 0 : isMinor ? 1 : 2,
          label: isMajor ? String(pdfVal) : undefined,
        });
      }
    } else {
      const screenMinorInterval = MINOR_INTERVAL * zoom;
      if (screenMinorInterval >= 3) {
        for (let py = 0; py <= screenHeight; py += screenMinorInterval) {
          const screenY = currentY + py;
          const isMajor = Math.abs(Math.round(py / zoom) % MAJOR_INTERVAL) < 1;
          ticks.push({
            y: screenY,
            level: isMajor ? 0 : 1,
            label: isMajor ? String(Math.round(py / zoom)) : undefined,
          });
        }
      }
    }

    currentY += screenHeight + PAGE_GAP;
  }

  const getPdfYFromClientY = useCallback(
    (clientY: number): number | null => {
      if (pages.length === 0) return null;
      const rulerEl = containerRef.current;
      if (!rulerEl) return null;
      const rulerTop = rulerEl.getBoundingClientRect().top;
      const currentScrollTop = rulerEl.scrollTop;
      const relY = clientY - rulerTop + currentScrollTop;
      let pageYOffset = TOP_PADDING;
      for (const page of pages) {
        const pageScreenHeight = page.height * zoom;
        if (relY >= pageYOffset && relY < pageYOffset + pageScreenHeight) {
          const pdfY = (relY - pageYOffset) / zoom;
          return Math.max(0, Math.min(page.height, pdfY));
        }
        pageYOffset += pageScreenHeight + PAGE_GAP;
      }
      const lastPage = pages[pages.length - 1];
      return Math.max(
        0,
        Math.min(
          lastPage.height,
          (relY - pageYOffset + lastPage.height * zoom + PAGE_GAP) / zoom,
        ),
      );
    },
    [pages, zoom, containerRef],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const rulerEl = containerRef.current;
      if (!rulerEl || pages.length === 0) return;
      const rulerTop = rulerEl.getBoundingClientRect().top;
      const currentScrollTop = rulerEl.scrollTop;

      const existingGuideHit = guides.find((g) => {
        if (g.orientation !== "horizontal") return false;
        let pageYOffset = TOP_PADDING;
        for (const page of pages) {
          const pageScreenHeight = page.height * zoom;
          const contentGuideY = pageYOffset + g.position * zoom;
          const visibleGuideY = contentGuideY - currentScrollTop;
          if (Math.abs(e.clientY - rulerTop - visibleGuideY) < 6) return true;
          pageYOffset += pageScreenHeight + PAGE_GAP;
        }
        return false;
      });

      if (existingGuideHit) {
        removeGuide(existingGuideHit.id);
        return;
      }

      const pdfY = getPdfYFromClientY(e.clientY);
      if (pdfY !== null) {
        const pos = e.shiftKey ? snapToGrid(pdfY, SUB_INTERVAL) : pdfY;
        setPreviewGuide({ orientation: "horizontal", position: pos });
      }
      lockCursor("ns");

      const shiftHeld = e.shiftKey;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const rawPos = getPdfYFromClientY(moveEvent.clientY);
        if (rawPos !== null) {
          const pos =
            shiftHeld || moveEvent.shiftKey
              ? snapToGrid(rawPos, SUB_INTERVAL)
              : rawPos;
          setPreviewGuide({ orientation: "horizontal", position: pos });
        }
      };

      const onMouseUp = (upEvent: MouseEvent) => {
        unlockCursor();
        setPreviewGuide(null);
        const rawPos = getPdfYFromClientY(upEvent.clientY);
        if (rawPos !== null) {
          const pos =
            shiftHeld || upEvent.shiftKey
              ? snapToGrid(rawPos, SUB_INTERVAL)
              : rawPos;
          addGuide("horizontal", Math.round(pos * 10) / 10);
        }
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [
      addGuide,
      removeGuide,
      setPreviewGuide,
      guides,
      pages,
      zoom,
      containerRef,
      getPdfYFromClientY,
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
      <svg width={RULER_SIZE} height={contentHeight} className="block">
        {ticks.map((tick, i) => {
          const startX =
            tick.level === 0
              ? 0
              : tick.level === 1
                ? RULER_SIZE * 0.5
                : RULER_SIZE * 0.65;
          const stroke =
            tick.level === 0
              ? "var(--ruler-tick-major)"
              : tick.level === 1
                ? "var(--ruler-tick-minor)"
                : "var(--ruler-tick-sub)";
          return (
            <g key={i}>
              <line
                y1={tick.y}
                x1={startX}
                y2={tick.y}
                x2={RULER_SIZE}
                stroke={stroke}
                strokeWidth={tick.level === 0 ? 1 : 0.5}
              />
              {tick.label && (
                <text
                  x={RULER_SIZE / 2}
                  y={Math.round(tick.y) - 4}
                  fill="var(--ruler-label)"
                  fontSize={10}
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {tick.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
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
