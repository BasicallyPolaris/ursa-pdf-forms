import type { FormElement } from "./form-element-model";
import type { PageInfo } from "./pdf-loader";

export function clampFieldToPageBounds(field: FormElement, page: PageInfo): FormElement {
  const maxW = page.width;
  const maxH = page.height;
  if (!Number.isFinite(maxW) || !Number.isFinite(maxH) || maxW <= 0 || maxH <= 0) {
    return field;
  }
  const minW = Math.min(1, maxW);
  const minH = Math.min(1, maxH);
  const width = Math.max(minW, Math.min(field.width, maxW));
  const height = Math.max(minH, Math.min(field.height, maxH));
  const x = Math.max(0, Math.min(field.x, maxW - width));
  const y = Math.max(0, Math.min(field.y, maxH - height));
  return { ...field, x, y, width, height };
}

export interface ResolvedPosition {
  pageNumber: number;
  x: number;
  y: number;
}

export function resolveElementPosition(
  pages: PageInfo[],
  pageNumber: number,
  x: number,
  y: number,
): ResolvedPosition {
  if (pages.length === 0) return { pageNumber, x, y };

  const sorted =
    pages[0].pageNumber <= pages[pages.length - 1].pageNumber
      ? pages
      : [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
  const idx = sorted.findIndex((p) => p.pageNumber === pageNumber);
  if (idx === -1) return { pageNumber, x, y };

  let currentIdx = idx;
  let resolvedY = y;

  while (resolvedY < 0 && currentIdx > 0) {
    currentIdx--;
    resolvedY += sorted[currentIdx].height;
  }

  while (
    resolvedY > sorted[currentIdx].height &&
    currentIdx < sorted.length - 1
  ) {
    resolvedY -= sorted[currentIdx].height;
    currentIdx++;
  }

  const finalPage = sorted[currentIdx];
  resolvedY = Math.max(0, Math.min(resolvedY, finalPage.height));
  const resolvedX = Math.max(0, Math.min(x, finalPage.width));

  return {
    pageNumber: finalPage.pageNumber,
    x: resolvedX,
    y: resolvedY,
  };
}
