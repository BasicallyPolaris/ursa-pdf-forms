import type { ZoomOrigin } from "@/lib/use-zoom-animation";

/**
 * Top-left of the scroll container's client area (where scrollLeft/Top apply).
 */
export function getScrollClientAreaOrigin(scrollEl: HTMLElement): {
  left: number;
  top: number;
} {
  const r = scrollEl.getBoundingClientRect();
  const s = getComputedStyle(scrollEl);
  const bl = parseFloat(s.borderLeftWidth) || 0;
  const bt = parseFloat(s.borderTopWidth) || 0;
  const pl = parseFloat(s.paddingLeft) || 0;
  const pt = parseFloat(s.paddingTop) || 0;
  return {
    left: r.left + bl + pl,
    top: r.top + bt + pt,
  };
}

/**
 * Transform-origin for `scale(live/committed)` on the page stack: viewport center in
 * wrapper-local px (layout offsets only — never getBoundingClientRect on the scaled node).
 */
export function getPdfScaleTransformOrigin(
  scrollEl: HTMLElement,
  outerEl: HTMLElement,
  scaleWrapperEl: HTMLElement,
  _origin: ZoomOrigin | null,
): string {
  void _origin;
  const clientX = scrollEl.clientWidth / 2;
  const clientY = scrollEl.clientHeight / 2;
  const clientOrigin = getScrollClientAreaOrigin(scrollEl);
  const outerRect = outerEl.getBoundingClientRect();

  const outerLeftInScroll =
    scrollEl.scrollLeft + (outerRect.left - clientOrigin.left);
  const outerTopInScroll =
    scrollEl.scrollTop + (outerRect.top - clientOrigin.top);

  let wrapperLeftInScroll = outerLeftInScroll + scaleWrapperEl.offsetLeft;
  let wrapperTopInScroll = outerTopInScroll + scaleWrapperEl.offsetTop;
  if (scaleWrapperEl.offsetParent !== outerEl) {
    let left = 0;
    let top = 0;
    let node: HTMLElement | null = scaleWrapperEl;
    while (node && node !== outerEl) {
      left += node.offsetLeft;
      top += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    if (node === outerEl) {
      wrapperLeftInScroll = outerLeftInScroll + left;
      wrapperTopInScroll = outerTopInScroll + top;
    }
  }

  const focalContentX = scrollEl.scrollLeft + clientX;
  const focalContentY = scrollEl.scrollTop + clientY;
  const relativeX = focalContentX - wrapperLeftInScroll;
  const relativeY = focalContentY - wrapperTopInScroll;
  return `${relativeX}px ${relativeY}px`;
}

/**
 * Synthetic origin for toolbar / keyboard / wheel zoom: top center of the PDF scroll viewport.
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
