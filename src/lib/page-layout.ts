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

export function computePageLayouts(
  pages: PageInfo[],
  zoom: number,
  containerWidth: number,
): Map<number, PageLayout> {
  const layouts = new Map<number, PageLayout>();
  let currentY = TOP_PADDING;
  for (const page of pages) {
    const screenWidth = page.width * zoom;
    const screenHeight = page.height * zoom;
    const xOffset = Math.max(H_PADDING, (containerWidth - screenWidth) / 2);
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
