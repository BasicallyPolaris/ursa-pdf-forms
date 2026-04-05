import { useRef } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { lockCursor, unlockCursor } from "@/lib/cursor";
import { TOP_PADDING, PAGE_GAP, H_PADDING } from "@/lib/page-layout";
import type { PageInfo } from "@/lib/pdf-loader";

interface PageLayout {
  xOffset: number;
  yOffset: number;
  screenWidth: number;
  screenHeight: number;
}

interface Guide {
  id: string;
  orientation: "horizontal" | "vertical";
  position: number;
}

interface GuidesLayerProps {
  guides: Guide[];
  selectedGuideId: string | null;
  previewGuide: {
    orientation: "horizontal" | "vertical";
    position: number;
  } | null;
  pages: PageInfo[];
  layouts: Map<number, PageLayout>;
  zoom: number;
  gridSize: number;
  overlayWidth: number;
  overlayRef: React.RefObject<HTMLDivElement | null>;
  totalContentHeight: number;
}

export function GuidesLayer({
  guides,
  selectedGuideId,
  previewGuide,
  pages,
  layouts,
  zoom,
  gridSize,
  overlayWidth,
  overlayRef,
  totalContentHeight,
}: GuidesLayerProps) {
  const draggingGuideIdRef = useRef<string | null>(null);

  const selectGuide = useEditorStore((s) => s.selectGuide);
  const updateGuidePosition = useEditorStore((s) => s.updateGuidePosition);
  const setPreviewGuide = useEditorStore((s) => s.setPreviewGuide);
  const removeGuide = useEditorStore((s) => s.removeGuide);

  const persistentGuideElements = guides.flatMap((guide) => {
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
      let lastValidPosition = initialPosition;

      const overlayEl = overlayRef.current;
      if (!overlayEl) return;

      const computeGuidePosition = (
        moveEvent: MouseEvent,
      ): { position: number; valid: boolean } => {
        const overlayRect = overlayEl.getBoundingClientRect();

        if (guide.orientation === "horizontal") {
          const relY = moveEvent.clientY - overlayRect.top;
          let foundPage = false;
          let pageYOffset = TOP_PADDING;
          for (const p of pages) {
            const pH = p.height * zoom;
            if (relY >= pageYOffset && relY < pageYOffset + pH) {
              foundPage = true;
              break;
            }
            pageYOffset += pH + PAGE_GAP;
          }
          if (!foundPage)
            return { position: lastValidPosition, valid: false };
          let pdfY = (relY - pageYOffset) / zoom;
          pdfY = Math.max(0, Math.min(pdfY, pages[0]?.height ?? 792));
          if (moveEvent.shiftKey) {
            pdfY = Math.round(pdfY / gridSize) * gridSize;
          }
          return { position: Math.round(pdfY * 10) / 10, valid: true };
        } else {
          const relX = moveEvent.clientX - overlayRect.left;
          const page = pages[0];
          if (!page)
            return { position: lastValidPosition, valid: false };
          const xOff =
            layouts.get(page.pageNumber)?.xOffset ??
            Math.max(H_PADDING, (overlayWidth - page.width * zoom) / 2);
          let pdfX = (relX - xOff) / zoom;
          pdfX = Math.max(0, Math.min(pdfX, page.width));
          if (moveEvent.shiftKey) {
            pdfX = Math.round(pdfX / gridSize) * gridSize;
          }
          return { position: Math.round(pdfX * 10) / 10, valid: true };
        }
      };

      const onMouseMove = (moveEvent: MouseEvent) => {
        const { position, valid } = computeGuidePosition(moveEvent);
        if (valid) {
          lastValidPosition = position;
        }
        setPreviewGuide({
          orientation: guide.orientation,
          position: lastValidPosition,
        });
      };

      const onMouseUp = (moveEvent: MouseEvent) => {
        setPreviewGuide(null);
        const { position, valid } = computeGuidePosition(moveEvent);
        const finalPos = valid ? position : lastValidPosition;

        if (moveEvent.metaKey || moveEvent.ctrlKey) {
          removeGuide(guide.id);
        } else {
          updateGuidePosition(guide.id, finalPos);
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
            style={{
              left: 0,
              top: screenY - 4,
              width: overlayWidth,
              height: 9,
            }}
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
          style={{
            left: screenX - 4,
            top: 0,
            width: 9,
            height: totalContentHeight,
          }}
          onMouseDown={handleGuideMouseDown}
        >
          <div
            className="h-full group-hover:opacity-100"
            style={{ ...lineStyle, left: 4, width: 1 }}
          />
        </div>,
      ];
    }
  });

  const previewGuideElements = previewGuide
    ? (() => {
        if (previewGuide.orientation === "horizontal") {
          return pages.map((page, pi) => {
            const layout = layouts.get(page.pageNumber);
            const screenY =
              (layout?.yOffset ?? TOP_PADDING) +
              previewGuide.position * zoom;
            return (
              <div
                key={`preview-guide-page-${pi}`}
                className="pointer-events-none absolute z-50"
                style={{
                  left: 0,
                  top: screenY,
                  width: overlayWidth,
                  height: 1,
                  backgroundColor: "var(--guide-ruler)",
                }}
              />
            );
          });
        } else {
          const firstLayout = layouts.get(1);
          const screenX = firstLayout
            ? firstLayout.xOffset + previewGuide.position * zoom
            : previewGuide.position * zoom;
          return [
            <div
              key="preview-guide"
              className="pointer-events-none absolute z-50"
              style={{
                left: screenX,
                top: 0,
                width: 1,
                height: totalContentHeight,
                backgroundColor: "var(--guide-ruler)",
              }}
            />,
          ];
        }
      })()
    : [];

  return (
    <>
      {persistentGuideElements}
      {previewGuideElements}
    </>
  );
}
