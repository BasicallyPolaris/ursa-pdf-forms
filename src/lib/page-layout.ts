import type { PageInfo } from "./pdf-loader";
import { TOP_PADDING, PAGE_GAP, H_PADDING } from "./coordinates";

export { TOP_PADDING, PAGE_GAP, H_PADDING };
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
  const layouts = new Map<number, PageLayout>();
  const cw = getLayoutContentWidth(pages, zoom, containerWidth);
  let currentY = TOP_PADDING;
  for (const page of pages) {
    const screenWidth = page.width * zoom;
    const screenHeight = page.height * zoom;
    const xOffset = Math.max(H_PADDING, (cw - screenWidth) / 2);
    layouts.set(page.pageNumber, { xOffset, yOffset: currentY, screenWidth, screenHeight });
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
  if (pages.length === 0) return 0;
  return (
    pages.reduce((acc, p) => acc + p.height * zoom, 0) +
    TOP_PADDING +
    PAGE_GAP * (pages.length - 1)
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
 * Sample which PDF point is at the viewport center using hit-testing (matches the scaled
 * visual during CSS zoom lerp). Call from `onZoomSettle` before the store commits.
 */
export function sampleViewportPdfAnchor(
  scrollEl: HTMLElement,
  pages: PageInfo[],
): { pageNum: number; pdfY: number } | null {
  const r = scrollEl.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const stack = document.elementsFromPoint(cx, cy);
  for (const node of stack) {
    if (!(node instanceof HTMLElement)) continue;
    const wrapper = node.closest<HTMLElement>("[data-page-wrapper]");
    if (!wrapper) continue;
    const raw = wrapper.getAttribute("data-page-wrapper");
    if (!raw) continue;
    const pageNum = parseInt(raw, 10);
    const page = pages.find((p) => p.pageNumber === pageNum);
    if (!page) continue;
    const br = wrapper.getBoundingClientRect();
    const relY = cy - br.top;
    if (relY < 0 || relY > br.height) continue;
    const pdfY = Math.max(
      0,
      Math.min(page.height, (relY / br.height) * page.height),
    );
    return { pageNum, pdfY };
  }
  return null;
}

/**
 * After zoom settles, keep the same PDF point under the viewport vertical center
 * and center horizontally when the content is wider than the viewport (matches ruler strip).
 *
 * @param scrollTopForAnchor — scrollTop **before** layout height updates (e.g. captured in
 *   `onZoomSettle`). If omitted, uses current `scrollEl.scrollTop` (can be wrong after the
 *   browser clamps scroll when content shrinks).
 * @param visualAnchor — PDF point at viewport center from {@link sampleViewportPdfAnchor}
 *   (preferred; matches CSS scale animation endpoint).
 */
export function preserveViewportScrollAfterZoomChange(
  scrollEl: HTMLElement,
  pages: PageInfo[],
  oldZoom: number,
  newZoom: number,
  scrollTopForAnchor?: number,
  visualAnchor?: { pageNum: number; pdfY: number } | null,
): void {
  if (pages.length === 0 || oldZoom === newZoom) return;

  const vpW = scrollEl.clientWidth;
  const vpH = scrollEl.clientHeight;
  const oldLayouts = computePageLayouts(pages, oldZoom, vpW);
  const st =
    scrollTopForAnchor !== undefined ? scrollTopForAnchor : scrollEl.scrollTop;

  const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);

  let pageNum: number | null = null;
  let pdfY: number;

  if (
    visualAnchor &&
    sorted.some((p) => p.pageNumber === visualAnchor.pageNum)
  ) {
    pageNum = visualAnchor.pageNum;
    pdfY = Math.max(
      0,
      Math.min(
        pages.find((p) => p.pageNumber === pageNum)!.height - 1e-6,
        visualAnchor.pdfY,
      ),
    );
  } else {
    const totalOldH = getTotalContentHeight(pages, oldZoom);
    let anchorY: number;
    if (st <= SCROLL_EDGE_PX) {
      anchorY = st + vpH * TOP_ANCHOR_FRAC;
    } else if (st + vpH >= totalOldH - SCROLL_EDGE_PX) {
      anchorY = st + vpH * (1 - TOP_ANCHOR_FRAC);
    } else {
      anchorY = st + vpH / 2;
    }

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

    const yWithinPage = Math.max(
      0,
      Math.min(anchorY - LO.yOffset, LO.screenHeight - 1e-6),
    );
    pdfY = yWithinPage / oldZoom;
  }

  const newLayouts = computePageLayouts(pages, newZoom, vpW);
  const LN = newLayouts.get(pageNum!);
  if (!LN) return;

  const newScreenY = LN.yOffset + pdfY * newZoom;
  let scrollTop = newScreenY - vpH / 2;
  const totalH = getTotalContentHeight(pages, newZoom);
  const maxTop = Math.max(0, totalH - vpH);
  scrollTop = Math.max(0, Math.min(maxTop, scrollTop));

  const apply = () => {
    const sw = scrollEl.scrollWidth;
    const cw = scrollEl.clientWidth;
    const scrollLeft = sw > cw ? (sw - cw) / 2 : 0;
    scrollEl.scrollLeft = scrollLeft;
    scrollEl.scrollTop = scrollTop;
  };

  apply();
  requestAnimationFrame(apply);
}
