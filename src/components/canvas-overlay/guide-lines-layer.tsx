import { memo, useState } from "react";
import type { PageInfo } from "@/lib/pdf-loader";
import type { PageLayout } from "@/lib/page-layout";
import type { GuideLine } from "@/stores/editor-store";
import { V_PADDING, H_PADDING } from "@/lib/coordinates";
import { lockCursor, unlockCursor } from "@/lib/cursor";
import { useTranslation } from "react-i18next";

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
  activeTool: string;
  selectGuide: (id: string) => void;
  updateGuidePosition: (id: string, position: number) => void;
  setPreviewGuide: (
    guide: { orientation: "horizontal" | "vertical"; position: number } | null,
  ) => void;
  removeGuide: (id: string) => void;
}

export const GuideLinesLayer = memo(function GuideLinesLayer({
  guides,
  selectedGuideId,
  layouts,
  pages,
  zoom,
  gridSize,
  overlayWidth,
  totalContentHeight,
  overlayRef,
  activeTool,
  selectGuide,
  updateGuidePosition,
  setPreviewGuide,
  removeGuide,
}: GuideLinesLayerProps) {
  const { t } = useTranslation();
  const [draggingGuideId, setDraggingGuideId] = useState<string | null>(null);

  return (
    <>
      {guides.flatMap((guide) => {
        const isSelected = selectedGuideId === guide.id;
        const isBeingDragged = draggingGuideId === guide.id;
        if (isBeingDragged) return [];

        const handleGuideMouseDown = (
          e: React.MouseEvent,
          clickedPageNumber: number,
        ) => {
          if (activeTool !== "select") return;
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          selectGuide(guide.id);
          lockCursor(guide.orientation === "horizontal" ? "ns" : "ew");

          const overlayEl = overlayRef.current;
          if (!overlayEl) return;

          const clickedPage = pages.find(
            (p) => p.pageNumber === clickedPageNumber,
          );
          const clickedLayout = layouts.get(clickedPageNumber);

          let dragPageOffset = clickedLayout?.yOffset ?? V_PADDING;
          let dragPageHeight = clickedPage?.height ?? pages[0]?.height ?? 792;
          let dragPageWidth = clickedPage?.width ?? pages[0]?.width ?? 612;
          let dragPageXOffset =
            clickedLayout?.xOffset ??
            layouts.get(1)?.xOffset ??
            Math.max(
              H_PADDING,
              (overlayWidth - (pages[0]?.width ?? 612) * zoom) / 2,
            );

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
            setDraggingGuideId(null);
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
          };

          document.addEventListener("mousemove", onMouseMove);
          document.addEventListener("mouseup", onMouseUp);
          setDraggingGuideId(guide.id);
        };

        const handleGuideKeyDown = (e: React.KeyboardEvent) => {
          if (activeTool !== "select") return;
          const NUDGE = 1;
          if (guide.orientation === "horizontal") {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              e.stopPropagation();
              const maxY = pages[0]?.height ?? 792;
              const delta = e.key === "ArrowUp" ? -NUDGE : NUDGE;
              updateGuidePosition(
                guide.id,
                Math.max(0, Math.min(maxY, guide.position + delta)),
              );
            }
          } else {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              e.stopPropagation();
              const maxX = pages[0]?.width ?? 612;
              const delta = e.key === "ArrowLeft" ? -NUDGE : NUDGE;
              updateGuidePosition(
                guide.id,
                Math.max(0, Math.min(maxX, guide.position + delta)),
              );
            }
          }
          if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            e.stopPropagation();
            removeGuide(guide.id);
          }
        };

        const lineStyle: React.CSSProperties = {
          position: "absolute",
          backgroundColor: "var(--guide-ruler)",
          opacity: isSelected ? 1 : 0.6,
        };

        const isInteractive = activeTool === "select";

        if (guide.orientation === "horizontal") {
          return pages.map((page, pi) => {
            const layout = layouts.get(page.pageNumber);
            const screenY =
              (layout?.yOffset ?? V_PADDING) + guide.position * zoom;
            return (
              <div
                key={`${guide.id}-page-${pi}`}
                data-guide-line
                data-guide-id={guide.id}
                className={`absolute z-40 group ${isInteractive ? "cursor-ns-resize" : "pointer-events-none"}`}
                style={{
                  left: 0,
                  top: screenY - 4,
                  width: overlayWidth,
                  height: 9,
                }}
                onMouseDown={
                  isInteractive
                    ? (e) => handleGuideMouseDown(e, page.pageNumber)
                    : undefined
                }
                {...(pi === 0 && isInteractive
                  ? {
                      role: "slider" as const,
                      tabIndex: 0,
                      onKeyDown: handleGuideKeyDown,
                      onFocus: () => selectGuide(guide.id),
                      "aria-label": t("announcements.guideHorizontal", {
                        position: Math.round(guide.position),
                      }),
                      "aria-valuenow": Math.round(guide.position),
                      "aria-valuemin": 0,
                      "aria-valuemax": Math.round(page.height ?? 792),
                      "aria-orientation": "horizontal" as const,
                    }
                  : {})}
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
              className={`absolute z-40 group ${isInteractive ? "cursor-ew-resize" : "pointer-events-none"}`}
              style={{
                left: screenX - 4,
                top: 0,
                width: 9,
                height: totalContentHeight,
              }}
              onMouseDown={
                isInteractive ? (e) => handleGuideMouseDown(e, 1) : undefined
              }
              {...(isInteractive
                ? {
                    role: "slider" as const,
                    tabIndex: 0,
                    onKeyDown: handleGuideKeyDown,
                    onFocus: () => selectGuide(guide.id),
                    "aria-label": t("announcements.guideVertical", {
                      position: Math.round(guide.position),
                    }),
                    "aria-valuenow": Math.round(guide.position),
                    "aria-valuemin": 0,
                    "aria-valuemax": Math.round(pages[0]?.width ?? 612),
                    "aria-orientation": "vertical" as const,
                  }
                : {})}
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
});
