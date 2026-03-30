import { useCallback, useRef } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { TOP_PADDING, PAGE_GAP } from "@/lib/coordinates";

const RULER_SIZE = 24;
const MAJOR_INTERVAL = 50;
const MINOR_INTERVAL = 10;

interface RulerProps {
  scrollLeft: number;
  scrollTop: number;
  overlayWidth: number;
  canvasHeight: number;
}

export function HorizontalRuler({ scrollLeft, overlayWidth }: RulerProps) {
  const { pages, zoom } = useEditorStore();
  const addGuide = useEditorStore((s) => s.addGuide);
  const removeGuide = useEditorStore((s) => s.removeGuide);
  const setPreviewGuide = useEditorStore((s) => s.setPreviewGuide);
  const guides = useEditorStore((s) => s.guides);
  const rulerRef = useRef<HTMLDivElement>(null);

  const ticks: Array<{ x: number; isMajor: boolean; label?: string }> = [];

  for (const page of pages) {
    const screenWidth = page.width * zoom;
    const xOffset = Math.max(0, (overlayWidth - screenWidth) / 2);
    const screenMinorInterval = MINOR_INTERVAL * zoom;

    if (screenMinorInterval >= 3) {
      for (let px = 0; px <= screenWidth; px += screenMinorInterval) {
        const screenX = xOffset + px - scrollLeft;
        if (screenX < -RULER_SIZE || screenX > overlayWidth + RULER_SIZE) continue;
        const isMajor = Math.abs(Math.round(px / zoom) % MAJOR_INTERVAL) < 1;
        ticks.push({
          x: screenX,
          isMajor,
          label: isMajor ? String(Math.round(px / zoom)) : undefined,
        });
      }
    }
  }

  const getPdfXFromClientX = useCallback(
    (clientX: number): number | null => {
      if (pages.length === 0) return null;
      const page = pages[0];
      const screenWidth = page.width * zoom;
      const xOffset = Math.max(0, (overlayWidth - screenWidth) / 2);
      const rulerLeft = rulerRef.current?.getBoundingClientRect().left ?? 0;
      const relX = clientX - rulerLeft + scrollLeft;
      const pdfX = (relX - xOffset) / zoom;
      if (pdfX < 0 || pdfX > page.width) return null;
      return pdfX;
    },
    [pages, zoom, overlayWidth, scrollLeft],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const rulerLeft = rulerRef.current?.getBoundingClientRect().left ?? 0;
      const existingGuideHit = guides.find((g) => {
        if (g.orientation !== "vertical") return false;
        const page = pages[0];
        if (!page) return false;
        const screenWidth = page.width * zoom;
        const xOffset = Math.max(0, (overlayWidth - screenWidth) / 2);
        const screenGuideX = xOffset + g.position * zoom - scrollLeft;
        return Math.abs(e.clientX - rulerLeft - screenGuideX) < 6;
      });

      if (existingGuideHit) {
        removeGuide(existingGuideHit.id);
        return;
      }

      const pdfX = getPdfXFromClientX(e.clientX);
      if (pdfX !== null) {
        setPreviewGuide({ orientation: "vertical", position: pdfX });
      }

      const onMouseMove = (moveEvent: MouseEvent) => {
        const pos = getPdfXFromClientX(moveEvent.clientX);
        if (pos !== null) {
          setPreviewGuide({ orientation: "vertical", position: pos });
        }
      };

      const onMouseUp = (upEvent: MouseEvent) => {
        setPreviewGuide(null);
        const pos = getPdfXFromClientX(upEvent.clientX);
        if (pos !== null) {
          addGuide("vertical", Math.round(pos * 10) / 10);
        }
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [addGuide, removeGuide, setPreviewGuide, guides, pages, zoom, overlayWidth, scrollLeft, getPdfXFromClientX],
  );

  return (
    <div
      ref={rulerRef}
      className="flex-shrink-0 bg-neutral-900 border-b border-border relative overflow-hidden cursor-ew-resize"
      style={{ height: RULER_SIZE, width: overlayWidth }}
      onMouseDown={handleMouseDown}
    >
      <svg width={overlayWidth} height={RULER_SIZE} className="block">
        {ticks.map((tick, i) => (
          <g key={i}>
            <line
              x1={tick.x}
              y1={tick.isMajor ? 0 : RULER_SIZE * 0.6}
              x2={tick.x}
              y2={RULER_SIZE}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={tick.isMajor ? 1 : 0.5}
            />
            {tick.label && (
              <text
                x={tick.x + 2}
                y={9}
                fill="rgba(255,255,255,0.4)"
                fontSize={8}
                fontFamily="monospace"
              >
                {tick.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function VerticalRuler({ scrollTop, canvasHeight }: RulerProps) {
  const { pages, zoom } = useEditorStore();
  const addGuide = useEditorStore((s) => s.addGuide);
  const removeGuide = useEditorStore((s) => s.removeGuide);
  const setPreviewGuide = useEditorStore((s) => s.setPreviewGuide);
  const guides = useEditorStore((s) => s.guides);
  const rulerRef = useRef<HTMLDivElement>(null);

  const ticks: Array<{ y: number; isMajor: boolean; label?: string }> = [];
  let currentY = TOP_PADDING;

  for (const page of pages) {
    const screenHeight = page.height * zoom;
    const screenMinorInterval = MINOR_INTERVAL * zoom;

    if (screenMinorInterval >= 3) {
      for (let py = 0; py <= screenHeight; py += screenMinorInterval) {
        const screenY = currentY + py - scrollTop;
        if (screenY < -RULER_SIZE || screenY > canvasHeight + RULER_SIZE) continue;
        const isMajor = Math.abs(Math.round(py / zoom) % MAJOR_INTERVAL) < 1;
        ticks.push({
          y: screenY,
          isMajor,
          label: isMajor ? String(Math.round(py / zoom)) : undefined,
        });
      }
    }

    currentY += screenHeight + PAGE_GAP;
  }

  const getPdfYFromClientY = useCallback(
    (clientY: number): number | null => {
      if (pages.length === 0) return null;
      const page = pages[0];
      const rulerTop = rulerRef.current?.getBoundingClientRect().top ?? 0;
      const relY = clientY - rulerTop + scrollTop;
      const pdfY = (relY - TOP_PADDING) / zoom;
      if (pdfY < 0 || pdfY > page.height) return null;
      return pdfY;
    },
    [pages, zoom, scrollTop],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const rulerTop = rulerRef.current?.getBoundingClientRect().top ?? 0;

      const existingGuideHit = guides.find((g) => {
        if (g.orientation !== "horizontal") return false;
        const screenGuideY = TOP_PADDING + g.position * zoom - scrollTop;
        return Math.abs(e.clientY - rulerTop - screenGuideY) < 6;
      });

      if (existingGuideHit) {
        removeGuide(existingGuideHit.id);
        return;
      }

      const pdfY = getPdfYFromClientY(e.clientY);
      if (pdfY !== null) {
        setPreviewGuide({ orientation: "horizontal", position: pdfY });
      }

      const onMouseMove = (moveEvent: MouseEvent) => {
        const pos = getPdfYFromClientY(moveEvent.clientY);
        if (pos !== null) {
          setPreviewGuide({ orientation: "horizontal", position: pos });
        }
      };

      const onMouseUp = (upEvent: MouseEvent) => {
        setPreviewGuide(null);
        const pos = getPdfYFromClientY(upEvent.clientY);
        if (pos !== null) {
          addGuide("horizontal", Math.round(pos * 10) / 10);
        }
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [addGuide, removeGuide, setPreviewGuide, guides, pages, zoom, scrollTop, getPdfYFromClientY],
  );

  return (
    <div
      ref={rulerRef}
      className="flex-shrink-0 bg-neutral-900 border-r border-border relative overflow-hidden cursor-ns-resize"
      style={{ width: RULER_SIZE, height: canvasHeight }}
      onMouseDown={handleMouseDown}
    >
      <svg width={RULER_SIZE} height={canvasHeight}>
        {ticks.map((tick, i) => (
          <g key={i}>
            <line
              y1={tick.y}
              x1={tick.isMajor ? 0 : RULER_SIZE * 0.6}
              y2={tick.y}
              x2={RULER_SIZE}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={tick.isMajor ? 1 : 0.5}
            />
            {tick.label && (
              <text
                x={2}
                y={tick.y + 3}
                fill="rgba(255,255,255,0.4)"
                fontSize={7}
                fontFamily="monospace"
                transform={`rotate(-90, 2, ${tick.y + 3})`}
              >
                {tick.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function RulerCorner() {
  return (
    <div
      className="flex-shrink-0 bg-neutral-900 border-b border-r border-border"
      style={{ width: RULER_SIZE, height: RULER_SIZE }}
    />
  );
}

export { RULER_SIZE };
