interface Positionable {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function alignLeft<T extends Positionable>(
  elements: T[],
  selectedIds: Set<string>,
): Array<{ id: string; x: number; y: number }> {
  const selected = elements.filter((e) => selectedIds.has(e.id));
  if (selected.length < 2) return [];
  const minX = Math.min(...selected.map((e) => e.x));
  return selected.map((e) => ({ id: e.id, x: minX, y: e.y }));
}

export function alignRight<T extends Positionable>(
  elements: T[],
  selectedIds: Set<string>,
): Array<{ id: string; x: number; y: number }> {
  const selected = elements.filter((e) => selectedIds.has(e.id));
  if (selected.length < 2) return [];
  const maxRight = Math.max(...selected.map((e) => e.x + e.width));
  return selected.map((e) => ({ id: e.id, x: maxRight - e.width, y: e.y }));
}

export function alignTop<T extends Positionable>(
  elements: T[],
  selectedIds: Set<string>,
): Array<{ id: string; x: number; y: number }> {
  const selected = elements.filter((e) => selectedIds.has(e.id));
  if (selected.length < 2) return [];
  const minY = Math.min(...selected.map((e) => e.y));
  return selected.map((e) => ({ id: e.id, x: e.x, y: minY }));
}

export function alignBottom<T extends Positionable>(
  elements: T[],
  selectedIds: Set<string>,
): Array<{ id: string; x: number; y: number }> {
  const selected = elements.filter((e) => selectedIds.has(e.id));
  if (selected.length < 2) return [];
  const maxBottom = Math.max(...selected.map((e) => e.y + e.height));
  return selected.map((e) => ({ id: e.id, x: e.x, y: maxBottom - e.height }));
}

export function alignCenterH<T extends Positionable>(
  elements: T[],
  selectedIds: Set<string>,
): Array<{ id: string; x: number; y: number }> {
  const selected = elements.filter((e) => selectedIds.has(e.id));
  if (selected.length < 2) return [];
  const centers = selected.map((e) => e.x + e.width / 2);
  const targetCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
  return selected.map((e) => ({ id: e.id, x: targetCenter - e.width / 2, y: e.y }));
}

export function alignCenterV<T extends Positionable>(
  elements: T[],
  selectedIds: Set<string>,
): Array<{ id: string; x: number; y: number }> {
  const selected = elements.filter((e) => selectedIds.has(e.id));
  if (selected.length < 2) return [];
  const centers = selected.map((e) => e.y + e.height / 2);
  const targetCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
  return selected.map((e) => ({ id: e.id, x: e.x, y: targetCenter - e.height / 2 }));
}

export function distributeH<T extends Positionable>(
  elements: T[],
  selectedIds: Set<string>,
): Array<{ id: string; x: number; y: number }> {
  const selected = elements.filter((e) => selectedIds.has(e.id));
  if (selected.length < 3) return [];
  const sorted = [...selected].sort((a, b) => a.x - b.x);
  const leftEdge = sorted[0].x;
  const rightEdge = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width;
  const totalWidth = sorted.reduce((sum, e) => sum + e.width, 0);
  const availableSpace = rightEdge - leftEdge - totalWidth;
  const gap = availableSpace / (sorted.length - 1);

  let currentX = leftEdge;
  return sorted.map((e) => {
    const result = { id: e.id, x: currentX, y: e.y };
    currentX += e.width + gap;
    return result;
  });
}

export function distributeV<T extends Positionable>(
  elements: T[],
  selectedIds: Set<string>,
): Array<{ id: string; x: number; y: number }> {
  const selected = elements.filter((e) => selectedIds.has(e.id));
  if (selected.length < 3) return [];
  const sorted = [...selected].sort((a, b) => a.y - b.y);
  const topEdge = sorted[0].y;
  const bottomEdge = sorted[sorted.length - 1].y + sorted[sorted.length - 1].height;
  const totalHeight = sorted.reduce((sum, e) => sum + e.height, 0);
  const availableSpace = bottomEdge - topEdge - totalHeight;
  const gap = availableSpace / (sorted.length - 1);

  let currentY = topEdge;
  return sorted.map((e) => {
    const result = { id: e.id, x: e.x, y: currentY };
    currentY += e.height + gap;
    return result;
  });
}

export function centerOnPage<T extends Positionable>(
  elements: T[],
  selectedIds: Set<string>,
  pageWidth: number,
  pageHeight: number,
): Array<{ id: string; x: number; y: number }> {
  const selected = elements.filter((e) => selectedIds.has(e.id));
  if (selected.length === 0) return [];
  const groupLeft = Math.min(...selected.map((e) => e.x));
  const groupTop = Math.min(...selected.map((e) => e.y));
  const groupRight = Math.max(...selected.map((e) => e.x + e.width));
  const groupBottom = Math.max(...selected.map((e) => e.y + e.height));
  const groupWidth = groupRight - groupLeft;
  const groupHeight = groupBottom - groupTop;
  const offsetX = (pageWidth - groupWidth) / 2 - groupLeft;
  const offsetY = (pageHeight - groupHeight) / 2 - groupTop;
  return selected.map((e) => ({ id: e.id, x: e.x + offsetX, y: e.y + offsetY }));
}
