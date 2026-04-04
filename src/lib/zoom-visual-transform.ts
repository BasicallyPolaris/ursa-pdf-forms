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
