import { H_PADDING, PAGE_GAP, V_PADDING } from "./coordinates";
import type { PageInfo } from "./pdf-loader";

export { H_PADDING, PAGE_GAP, V_PADDING };
export type { PageLayout };

interface PageLayout {
  xOffset: number;
  yOffset: number;
  screenWidth: number;
  screenHeight: number;
}

/**
 * Horizontal layout width used by rulers, overlay, and page centering.
 * At least viewport wide; expands when the scaled page + padding exceeds the viewport.
 */
export function getLayoutContentWidth(
  pages: PageInfo[],
  zoom: number,
  viewportWidth: number,
): number {
  if (pages.length === 0 || viewportWidth <= 0) return viewportWidth;
  const maxPageW = Math.max(...pages.map((p) => p.width * zoom));
  return Math.max(maxPageW + 2 * H_PADDING, viewportWidth);
}

export function computePageLayouts(
  pages: PageInfo[],
  zoom: number,
  containerWidth: number,
): Map<number, PageLayout> {
  const safeZoom =
    Number.isFinite(zoom) && zoom > 0 ? Math.min(zoom, 10) : 1;
  const layouts = new Map<number, PageLayout>();
  const cw = getLayoutContentWidth(pages, safeZoom, containerWidth);
  let currentY = V_PADDING;
  for (const page of pages) {
    const screenWidth = page.width * safeZoom;
    const screenHeight = page.height * safeZoom;
    const xOffset = Math.max(H_PADDING, (cw - screenWidth) / 2);
    layouts.set(page.pageNumber, {
      xOffset,
      yOffset: currentY,
      screenWidth,
      screenHeight,
    });
    currentY += screenHeight + PAGE_GAP;
  }
  return layouts;
}

export function getVisiblePageNumbers(
  layouts: Map<number, PageLayout>,
  scrollTop: number,
  viewportHeight: number,
  bufferPx?: number,
): Set<number> {
  const buffer = bufferPx ?? Math.max(800, Math.floor(viewportHeight * 2));
  const visible = new Set<number>();
  const viewTop = scrollTop - buffer;
  const viewBottom = scrollTop + viewportHeight + buffer;
  for (const [pageNumber, layout] of layouts) {
    if (layout.yOffset > viewBottom) break;
    const pageBottom = layout.yOffset + layout.screenHeight;
    if (pageBottom >= viewTop) {
      visible.add(pageNumber);
    }
  }
  return visible;
}

export function getTotalContentHeight(pages: PageInfo[], zoom: number): number {
  const safeZoom =
    Number.isFinite(zoom) && zoom > 0 ? Math.min(zoom, 10) : 1;
  if (pages.length === 0) return 0;
  return (
    pages.reduce((acc, p) => acc + p.height * safeZoom, 0) +
    V_PADDING +
    PAGE_GAP * (pages.length - 1) +
    V_PADDING
  );
}

export function findPageAtScreenPoint(
  screenX: number,
  screenY: number,
  layouts: Map<number, PageLayout>,
): number | null {
  for (const [pageNumber, layout] of layouts) {
    if (
      screenX >= layout.xOffset &&
      screenX < layout.xOffset + layout.screenWidth &&
      screenY >= layout.yOffset &&
      screenY < layout.yOffset + layout.screenHeight
    ) {
      return pageNumber;
    }
  }
  return null;
}

const SCROLL_EDGE_PX = 8;
const TOP_ANCHOR_FRAC = 0.15;
/**
 * After zoom settles, keep the same PDF point under the viewport vertical center
 * and center horizontally when the content is wider than the viewport.
 *
 * Purely mathematical — no DOM hit-testing — so the correction is deterministic
 * and never drifts across rapid zoom frames.
 *
 * @param scrollTopForAnchor — scrollTop captured **before** layout height updates
 *   (e.g. in `onZoomSettle`). If omitted, uses current `scrollEl.scrollTop`.
 * @param oldVpH — viewport height captured alongside scrollTopForAnchor so the
 *   anchor position matches the pre-update visual state.
 */
export function preserveViewportScrollAfterZoomChange(
  scrollEl: HTMLElement,
  pages: PageInfo[],
  oldZoom: number,
  newZoom: number,
  scrollTopForAnchor?: number,
  oldVpH?: number,
): void {
  if (pages.length === 0 || oldZoom === newZoom) return;

  const vpW = scrollEl.clientWidth;
  const vpH = scrollEl.clientHeight;
  const anchorVpH = oldVpH ?? vpH;
  const oldLayouts = computePageLayouts(pages, oldZoom, vpW);
  const st =
    scrollTopForAnchor !== undefined ? scrollTopForAnchor : scrollEl.scrollTop;

  const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);

  const totalOldH = getTotalContentHeight(pages, oldZoom);
  let anchorY: number;
  if (st <= SCROLL_EDGE_PX) {
    anchorY = st + anchorVpH * TOP_ANCHOR_FRAC;
  } else if (st + anchorVpH >= totalOldH - SCROLL_EDGE_PX) {
    anchorY = st + anchorVpH * (1 - TOP_ANCHOR_FRAC);
  } else {
    anchorY = st + anchorVpH / 2;
  }

  let pageNum: number | null = null;
  for (const p of sorted) {
    const L = oldLayouts.get(p.pageNumber);
    if (!L) continue;
    if (anchorY >= L.yOffset && anchorY < L.yOffset + L.screenHeight) {
      pageNum = p.pageNumber;
      break;
    }
  }

  if (pageNum === null) {
    let best: number | null = null;
    for (const p of sorted) {
      const L = oldLayouts.get(p.pageNumber);
      if (!L) continue;
      if (L.yOffset <= anchorY) best = p.pageNumber;
    }
    pageNum = best ?? sorted[0]?.pageNumber ?? null;
  }
  if (pageNum === null) return;

  const LO = oldLayouts.get(pageNum);
  if (!LO) return;

  const pdfY = Math.max(
    0,
    Math.min(anchorY - LO.yOffset, LO.screenHeight) / oldZoom,
  );

  const newLayouts = computePageLayouts(pages, newZoom, vpW);
  const LN = newLayouts.get(pageNum);
  if (!LN) return;

  const newScreenY = LN.yOffset + pdfY * newZoom;
  let scrollTop = newScreenY - anchorVpH / 2;
  const totalH = getTotalContentHeight(pages, newZoom);
  const maxTop = Math.max(0, totalH - vpH);
  scrollTop = Math.max(0, Math.min(maxTop, scrollTop));

  const sw = scrollEl.scrollWidth;
  const cw = scrollEl.clientWidth;
  scrollEl.scrollLeft = sw > cw ? (sw - cw) / 2 : 0;
  scrollEl.scrollTop = scrollTop;
}
