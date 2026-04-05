export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  const aLeft = a.x;
  const aRight = a.x + a.width;
  const aTop = a.y;
  const aBottom = a.y + a.height;

  const bLeft = b.x;
  const bRight = b.x + b.width;
  const bTop = b.y;
  const bBottom = b.y + b.height;

  return aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop;
}

export function computeBoundingRect(
  items: Array<{ x: number; y: number; width: number; height: number }>,
): Rect | null {
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
