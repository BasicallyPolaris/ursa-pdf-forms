import { heightFromFontSize } from "@/lib/form-element-model";
import { getElementStyleConfigByType } from "@/lib/element-style-map";

interface DrawStart {
  x: number;
  y: number;
  pageX: number;
  pageY: number;
  pageNumber: number;
}

interface DrawPreviewProps {
  drawRect: {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null;
  drawStartRef: React.RefObject<DrawStart | null>;
  activeTool: string;
  zoom: number;
  HORIZONTAL_DRAW_TOOLS: Set<string>;
}

export function DrawPreview({
  drawRect,
  drawStartRef,
  activeTool,
  zoom,
  HORIZONTAL_DRAW_TOOLS,
}: DrawPreviewProps) {
  if (!drawRect) return null;

  const left = Math.min(drawRect.startX, drawRect.currentX);
  const top = Math.min(drawRect.startY, drawRect.currentY);
  const width = Math.abs(drawRect.currentX - drawRect.startX);
  const height = Math.abs(drawRect.currentY - drawRect.startY);

  if (width <= 0) return null;

  const style =
    HORIZONTAL_DRAW_TOOLS.has(activeTool)
      ? (() => {
          const fontSize = 12;
          const autoHeight = heightFromFontSize(fontSize) * zoom;
          const start = drawStartRef.current;
          const startY = start ? start.y : top;
          return { left, top: startY, width, height: autoHeight };
        })()
      : { left, top, width, height };

  if (style.width <= 0) return null;

  return (
    <div
      className={`pointer-events-none absolute ${
        HORIZONTAL_DRAW_TOOLS.has(activeTool)
          ? getElementStyleConfigByType("text")!.drawPreviewClass
          : getElementStyleConfigByType("multiline")!.drawPreviewClass
      }`}
      style={{
        left: style.left,
        top: style.top,
        width: style.width,
        height: style.height,
      }}
    />
  );
}
