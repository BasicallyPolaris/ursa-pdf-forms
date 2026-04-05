import { useRef } from "react";
import type { PageInfo } from "@/lib/pdf-loader";
import type { PageLayout } from "@/lib/page-layout";
import type { GuideLine } from "@/stores/editor-store";
import { TOP_PADDING, PAGE_GAP, H_PADDING } from "@/lib/coordinates";
import { lockCursor, unlockCursor } from "@/lib/cursor";

interface GuideLinesLayerProps {
  guides: GuideLine[];
  selectedGuideId: string | null;
  layouts: Map<number, PageLayout>;
  pages: PageInfo[];
  zoom: number;
  gridSize: number;
  overlayWidth: number;
  totalContentHeight: number;
  overlayRef: React.RefObject<HTMLDivElement | null>;
  selectGuide: (id: string) => void;
  updateGuidePosition: (id: string, position: number) => void;
  setPreviewGuide: (
    guide: { orientation: "horizontal" | "vertical"; position: number } | null,
  ) => void;
  removeGuide: (id: string) => void;
}

export function GuideLinesLayer({
  guides,
  selectedGuideId,
  layouts,
  pages,
  zoom,
  gridSize,
  overlayWidth,
  totalContentHeight,
  overlayRef,
  selectGuide,
  updateGuidePosition,
  setPreviewGuide,
  removeGuide,
}: GuideLinesLayerProps) {
  const draggingGuideIdRef = useRef<string | null>(null);

  return (
    <>
      {guides.flatMap((guide) => {
        const isSelected = selectedGuideId === guide.id;
        const isBeingDragged = draggingGuideIdRef.current === guide.id;
        if (isBeingDragged) return [];

        const handleGuideMouseDown = (e: React.MouseEvent) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          selectGuide(guide.id);
          lockCursor(guide.orientation === "horizontal" ? "ns" : "ew");

          const initialPosition = guide.position;
          const overlayEl = overlayRef.current;
          if (!overlayEl) return;

          let dragPageOffset = TOP_PADDING;
          let dragPageHeight = pages[0]?.height ?? 792;
          let dragPageWidth = pages[0]?.width ?? 612;
          let dragPageXOffset =
            layouts.get(1)?.xOffset ??
            Math.max(
              H_PADDING,
              (overlayWidth - (pages[0]?.width ?? 612) * zoom) / 2,
            );
          if (guide.orientation === "horizontal") {
            let yOff = TOP_PADDING;
            for (const p of pages) {
              const pH = p.height * zoom;
              if (initialPosition * zoom >= 0 && initialPosition * zoom <= pH) {
                dragPageOffset = yOff;
                dragPageHeight = p.height;
                dragPageWidth = p.width;
                break;
              }
              yOff += pH + PAGE_GAP;
            }
          }

          const computeGuidePosition = (
            moveEvent: MouseEvent,
          ): { position: number; valid: boolean } => {
            const overlayRect = overlayEl.getBoundingClientRect();
            if (guide.orientation === "horizontal") {
              const relY = moveEvent.clientY - overlayRect.top;
              let pdfY = (relY - dragPageOffset) / zoom;
              pdfY = Math.max(0, Math.min(pdfY, dragPageHeight));
              if (moveEvent.shiftKey) {
                pdfY = Math.round(pdfY / gridSize) * gridSize;
              }
              return { position: Math.round(pdfY * 10) / 10, valid: true };
            } else {
              const relX = moveEvent.clientX - overlayRect.left;
              let pdfX = (relX - dragPageXOffset) / zoom;
              pdfX = Math.max(0, Math.min(pdfX, dragPageWidth));
              if (moveEvent.shiftKey) {
                pdfX = Math.round(pdfX / gridSize) * gridSize;
              }
              return { position: Math.round(pdfX * 10) / 10, valid: true };
            }
          };

          const onMouseMove = (moveEvent: MouseEvent) => {
            const { position } = computeGuidePosition(moveEvent);
            setPreviewGuide({ orientation: guide.orientation, position });
          };

          const onMouseUp = (moveEvent: MouseEvent) => {
            setPreviewGuide(null);
            const { position } = computeGuidePosition(moveEvent);
            if (moveEvent.metaKey || moveEvent.ctrlKey) {
              removeGuide(guide.id);
            } else {
              updateGuidePosition(guide.id, position);
            }
            unlockCursor();
            draggingGuideIdRef.current = null;
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
          };

          document.addEventListener("mousemove", onMouseMove);
          document.addEventListener("mouseup", onMouseUp);
          draggingGuideIdRef.current = guide.id;
        };

        const lineStyle: React.CSSProperties = {
          position: "absolute",
          backgroundColor: "var(--guide-ruler)",
          opacity: isSelected ? 1 : 0.6,
        };

        if (guide.orientation === "horizontal") {
          return pages.map((page, pi) => {
            const layout = layouts.get(page.pageNumber);
            const screenY =
              (layout?.yOffset ?? TOP_PADDING) + guide.position * zoom;
            return (
              <div
                key={`${guide.id}-page-${pi}`}
                data-guide-line
                data-guide-id={guide.id}
                className="absolute z-40 cursor-ns-resize group"
                style={{ left: 0, top: screenY - 4, width: overlayWidth, height: 9 }}
                onMouseDown={handleGuideMouseDown}
              >
                <div
                  className="w-full group-hover:opacity-100"
                  style={{ ...lineStyle, top: 4, height: 1 }}
                />
              </div>
            );
          });
        } else {
          const firstLayout = layouts.get(1);
          const screenX = firstLayout
            ? firstLayout.xOffset + guide.position * zoom
            : guide.position * zoom;
          return [
            <div
              key={guide.id}
              data-guide-line
              data-guide-id={guide.id}
              className="absolute z-40 cursor-ew-resize group"
              style={{ left: screenX - 4, top: 0, width: 9, height: totalContentHeight }}
              onMouseDown={handleGuideMouseDown}
            >
              <div
                className="h-full group-hover:opacity-100"
                style={{ ...lineStyle, left: 4, width: 1 }}
              />
            </div>,
          ];
        }
      })}
    </>
  );
}
