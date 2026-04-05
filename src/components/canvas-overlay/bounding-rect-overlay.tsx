import { pdfToScreen } from "@/lib/coordinates";
import { computeBoundingRect } from "@/lib/selection-geometry";
import type { FormElement } from "@/lib/form-element-model";

interface PageLayout {
  xOffset: number;
  yOffset: number;
  screenWidth: number;
  screenHeight: number;
}

interface BoundingRectOverlayProps {
  selectedIds: Set<string>;
  elements: FormElement[];
  layouts: Map<number, PageLayout>;
  zoom: number;
  dragOffset: { dx: number; dy: number } | null;
  dragLivePositions:
    | Map<string, { x: number; y: number; width: number; height: number }>
    | null;
}

export function BoundingRectOverlay({
  selectedIds,
  elements,
  layouts,
  zoom,
  dragOffset,
  dragLivePositions,
}: BoundingRectOverlayProps) {
  if (selectedIds.size < 2) return null;

  const byPage = new Map<
    number,
    Array<{ x: number; y: number; width: number; height: number }>
  >();
  for (const el of elements) {
    if (!selectedIds.has(el.id)) continue;
    if (!byPage.has(el.pageNumber)) byPage.set(el.pageNumber, []);
    const live = dragLivePositions?.get(el.id);
    byPage.get(el.pageNumber)!.push({
      x: live?.x ?? el.x,
      y: live?.y ?? el.y,
      width: live?.width ?? el.width,
      height: live?.height ?? el.height,
    });
  }

  const rects: Array<{
    screenX: number;
    screenY: number;
    screenWidth: number;
    screenHeight: number;
  }> = [];
  for (const [page, items] of byPage) {
    if (items.length < 2) continue;
    const rect = computeBoundingRect(items);
    if (!rect) continue;
    const layout = layouts.get(page);
    if (!layout) continue;
    const topLeft = pdfToScreen(
      { x: rect.x, y: rect.y },
      { zoom, pageX: layout.xOffset, pageY: layout.yOffset },
    );
    const bottomRight = pdfToScreen(
      { x: rect.x + rect.width, y: rect.y + rect.height },
      { zoom, pageX: layout.xOffset, pageY: layout.yOffset },
    );
    rects.push({
      screenX: topLeft.x,
      screenY: topLeft.y,
      screenWidth: bottomRight.x - topLeft.x,
      screenHeight: bottomRight.y - topLeft.y,
    });
  }

  return (
    <>
      {rects.map((rect, i) => (
        <div
          key={`bounding-rect-${i}`}
          className="pointer-events-none absolute"
          style={{
            left: rect.screenX,
            top: rect.screenY,
            width: rect.screenWidth,
            height: rect.screenHeight,
            border:
              dragOffset !== null
                ? "1px dashed var(--bounding-rect)"
                : "1px dotted var(--bounding-rect)",
            opacity: dragOffset !== null ? 0.6 : 0.4,
          }}
        />
      ))}
    </>
  );
}
