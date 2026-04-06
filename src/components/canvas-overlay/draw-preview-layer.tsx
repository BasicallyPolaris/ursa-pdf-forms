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

const TOOL_STYLE_MAP: Record<string, string> = {
  input: "text",
  textarea: "multiline",
  dropdown: "dropdown",
  optionlist: "optionlist",
};

export function DrawPreviewLayer({ drawRectStyle, activeTool }: DrawPreviewLayerProps) {
  if (!drawRectStyle || drawRectStyle.width <= 0) return null;

  const styleType = TOOL_STYLE_MAP[activeTool] ?? "text";
  const config = getElementStyleConfigByType(styleType);

  return (
    <div
      className={`pointer-events-none absolute ${config?.drawPreviewClass ?? ""}`}
      style={{
        left: drawRectStyle.left,
        top: drawRectStyle.top,
        width: drawRectStyle.width,
        height: drawRectStyle.height,
      }}
    />
  );
}
