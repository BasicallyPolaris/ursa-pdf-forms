import { useEditorStore } from "@/stores/editor-store";
import { TOP_PADDING, PAGE_GAP } from "@/lib/coordinates";

export function GridOverlay({ overlayWidth }: { overlayWidth: number }) {
  const showGrid = useEditorStore((s) => s.showGrid);
  const gridSize = useEditorStore((s) => s.gridSize);
  const pages = useEditorStore((s) => s.pages);
  const zoom = useEditorStore((s) => s.zoom);

  if (!showGrid || pages.length === 0) return null;

  const screenGridSize = gridSize * zoom;
  if (screenGridSize < 4) return null;

  let totalHeight = TOP_PADDING;
  for (const page of pages) {
    totalHeight += page.height * zoom + PAGE_GAP;
  }

  const dots: Array<{ cx: number; cy: number }> = [];
  let currentY = TOP_PADDING;

  for (const page of pages) {
    const screenWidth = page.width * zoom;
    const screenHeight = page.height * zoom;
    const xOffset = Math.max(0, (overlayWidth - screenWidth) / 2);

    const startX = xOffset + Math.ceil((xOffset % screenGridSize) / screenGridSize) * screenGridSize;
    const startY = currentY + Math.ceil((currentY % screenGridSize) / screenGridSize) * screenGridSize;

    for (let y = startY; y < currentY + screenHeight; y += screenGridSize) {
      for (let x = startX; x < xOffset + screenWidth; x += screenGridSize) {
        dots.push({ cx: x, cy: y });
      }
    }

    currentY += screenHeight + PAGE_GAP;
  }

  if (dots.length > 5000) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width="100%"
      height={totalHeight}
      style={{ top: 0, left: 0 }}
    >
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.cx}
          cy={d.cy}
          r={1}
          fill="oklch(1 0 0 / 12%)"
        />
      ))}
    </svg>
  );
}
