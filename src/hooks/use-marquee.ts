import { useCallback, useRef, useState } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { type FormElement } from "@/lib/form-element-model";
import { rectsOverlap, type Rect } from "@/lib/geometry";
import { pdfToScreen } from "@/lib/coordinates";

interface MarqueeState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function useMarquee() {
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  const selectElements = useEditorStore((s) => s.selectElements);
  const addToSelection = useEditorStore((s) => s.addToSelection);
  const clearSelection = useEditorStore((s) => s.clearSelection);

  const startMarquee = useCallback(
    (screenX: number, screenY: number, shiftKey: boolean) => {
      if (!shiftKey) {
        clearSelection();
      }
      marqueeStartRef.current = { x: screenX, y: screenY };
      isDraggingRef.current = false;
      setMarquee(null);
    },
    [clearSelection],
  );

  const updateMarquee = useCallback(
    (currentX: number, currentY: number) => {
      if (!marqueeStartRef.current) return;
      isDraggingRef.current = true;
      setMarquee({
        startX: marqueeStartRef.current.x,
        startY: marqueeStartRef.current.y,
        currentX,
        currentY,
      });
    },
    [],
  );

  const finishMarquee = useCallback(
    (
      shiftKey: boolean,
      elements: FormElement[],
      zoom: number,
      layouts: Map<
        number,
        {
          xOffset: number;
          yOffset: number;
          screenWidth: number;
          screenHeight: number;
        }
      >,
    ) => {
      if (marqueeStartRef.current && isDraggingRef.current && marquee) {
        const left = Math.min(marquee.startX, marquee.currentX);
        const top = Math.min(marquee.startY, marquee.currentY);
        const width = Math.abs(marquee.currentX - marquee.startX);
        const height = Math.abs(marquee.currentY - marquee.startY);

        if (width > 3 && height > 3) {
          const marqueeRect: Rect = { x: left, y: top, width, height };
          const hitIds: string[] = [];

          for (const el of elements) {
            const layout = layouts.get(el.pageNumber);
            if (!layout) continue;
            const screen = pdfToScreen(
              { x: el.x, y: el.y },
              { zoom, pageX: layout.xOffset, pageY: layout.yOffset },
            );
            const elRect: Rect = {
              x: screen.x,
              y: screen.y,
              width: el.width * zoom,
              height: el.height * zoom,
            };
            if (rectsOverlap(marqueeRect, elRect)) {
              hitIds.push(el.id);
            }
          }

          if (shiftKey) {
            addToSelection(hitIds);
          } else {
            selectElements(new Set(hitIds));
          }
        }
      }
      marqueeStartRef.current = null;
      isDraggingRef.current = false;
      setMarquee(null);
    },
    [marquee, selectElements, addToSelection],
  );

  const marqueeRect = marquee
    ? {
        left: Math.min(marquee.startX, marquee.currentX),
        top: Math.min(marquee.startY, marquee.currentY),
        width: Math.abs(marquee.currentX - marquee.startX),
        height: Math.abs(marquee.currentY - marquee.startY),
      }
    : null;

  return {
    marqueeRect,
    startMarquee,
    updateMarquee,
    finishMarquee,
  };
}
