import { HORIZONTAL_DRAW_TOOLS } from "./shared-constants";
import { getElementStyleConfigByType } from "@/lib/element-style-map";

interface DrawPreviewLayerProps {
  drawRectStyle: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null;
  activeTool: string;
}

export function DrawPreviewLayer({ drawRectStyle, activeTool }: DrawPreviewLayerProps) {
  if (!drawRectStyle || drawRectStyle.width <= 0) return null;

  return (
    <div
      className={`pointer-events-none absolute ${
        HORIZONTAL_DRAW_TOOLS.has(activeTool)
          ? getElementStyleConfigByType("text")!.drawPreviewClass
          : getElementStyleConfigByType("multiline")!.drawPreviewClass
      }`}
      style={{
        left: drawRectStyle.left,
        top: drawRectStyle.top,
        width: drawRectStyle.width,
        height: drawRectStyle.height,
      }}
    />
  );
}
