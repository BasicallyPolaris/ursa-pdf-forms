import { pdfToScreen } from "@/lib/coordinates";
import { rectsOverlap, type Rect } from "@/lib/geometry";
import type { PageLayout } from "@/lib/page-layout";
import { useEditorStore } from "@/stores/editor-store";
import { useCallback, useRef, useState } from "react";

interface MarqueeRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function useMarqueeSelection(deps: {
  zoom: number;
  getPageLayouts: () => Map<number, PageLayout>;
}) {
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  const startMarquee = useCallback((screenX: number, screenY: number) => {
    marqueeStartRef.current = { x: screenX, y: screenY };
    isDraggingRef.current = false;
    setMarquee(null);
  }, []);

  const updateMarquee = useCallback((currentX: number, currentY: number) => {
    if (!marqueeStartRef.current) return;
    isDraggingRef.current = true;
    setMarquee({
      startX: marqueeStartRef.current.x,
      startY: marqueeStartRef.current.y,
      currentX,
      currentY,
    });
  }, []);

  const endMarquee = useCallback((): { hitIds: string[]; wasDrag: boolean } => {
    const wasDrag = isDraggingRef.current && marquee !== null;
    let hitIds: string[] = [];

    if (wasDrag && marquee) {
      const layouts = deps.getPageLayouts();
      const left = Math.min(marquee.startX, marquee.currentX);
      const top = Math.min(marquee.startY, marquee.currentY);
      const width = Math.abs(marquee.currentX - marquee.startX);
      const height = Math.abs(marquee.currentY - marquee.startY);

      if (width > 3 && height > 3) {
        const marqueeRect: Rect = { x: left, y: top, width, height };
        const state = useEditorStore.getState();

        for (const el of state.elements) {
          const layout = layouts.get(el.pageNumber);
          if (!layout) continue;
          const screen = pdfToScreen(
            { x: el.x, y: el.y },
            {
              zoom: deps.zoom,
              pageX: layout.xOffset,
              pageY: layout.yOffset,
            },
          );
          const elRect: Rect = {
            x: screen.x,
            y: screen.y,
            width: el.width * deps.zoom,
            height: el.height * deps.zoom,
          };
          if (rectsOverlap(marqueeRect, elRect)) {
            hitIds.push(el.id);
          }
        }
      }
    }

    marqueeStartRef.current = null;
    isDraggingRef.current = false;
    setMarquee(null);
    return { hitIds, wasDrag };
  }, [marquee, deps]);

  const marqueeRect = marquee
    ? {
        left: Math.min(marquee.startX, marquee.currentX),
        top: Math.min(marquee.startY, marquee.currentY),
        width: Math.abs(marquee.currentX - marquee.startX),
        height: Math.abs(marquee.currentY - marquee.startY),
      }
    : null;

  return { marqueeRect, startMarquee, updateMarquee, endMarquee };
}
