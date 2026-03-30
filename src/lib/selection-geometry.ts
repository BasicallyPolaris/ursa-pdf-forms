export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeBoundingRect(
  items: Array<{ x: number; y: number; width: number; height: number }>,
): BoundingRect | null {
  if (items.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const item of items) {
    if (item.x < minX) minX = item.x;
    if (item.y < minY) minY = item.y;
    const right = item.x + item.width;
    const bottom = item.y + item.height;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
