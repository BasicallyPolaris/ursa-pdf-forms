import type { ZoomOrigin } from "@/lib/use-zoom-animation";

/**
 * Left edge of `el` in scroll-content coordinates (layout only; ignores CSS transform).
 * Walks offsetParent chain until `scrollEl` — `el.offsetLeft` alone is wrong when the
 * wrapper is nested (e.g. mx-auto inside an outer div).
 */
function offsetLeftInScrollContent(
  scrollEl: HTMLElement,
  el: HTMLElement,
): number {
  let left = 0;
  let node: HTMLElement | null = el;
  while (node && node !== scrollEl) {
    left += node.offsetLeft;
    node = node.offsetParent as HTMLElement | null;
  }
  if (node !== scrollEl) {
    return el.offsetLeft;
  }
  return left;
}

/**
 * PDF scale wrapper: transform-origin X in wrapper-local px (Y = top).
 */
export function getPdfScaleTransformOrigin(
  scrollEl: HTMLElement,
  scaleWrapperEl: HTMLElement,
  origin: ZoomOrigin | null,
): string {
  const clientX = origin ? origin.clientX : scrollEl.clientWidth / 2;
  const wrapperLeft = offsetLeftInScrollContent(scrollEl, scaleWrapperEl);
  const relativeX = scrollEl.scrollLeft + clientX - wrapperLeft;
  return `${relativeX}px 0`;
}

/**
 * Synthetic origin for toolbar / keyboard zoom: top center of the PDF scroll viewport.
 */
export function getScrollViewportTopCenterOrigin(): ZoomOrigin {
  const scrollEl = document.querySelector<HTMLElement>(
    "[data-pdf-scroll-container]",
  );
  if (!scrollEl) {
    return { clientX: 0, clientY: 0 };
  }
  return {
    clientX: scrollEl.clientWidth / 2,
    clientY: 0,
  };
}
