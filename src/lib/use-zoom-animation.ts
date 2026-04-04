/**
 * Zoom animation engine — zero React renders during animation.
 *
 * Architecture:
 *   DURING animation → notify ZoomListeners which update DOM directly
 *     (PDF canvas applies CSS transform: scale(live/committed) on the page stack wrapper)
 *   ON settle        → call commitZoom() once → one React render; wrapper scale reset to 1
 */

export interface ZoomOrigin {
  /** Cursor X relative to the scroll container's client area (inside border), origin top-left */
  clientX: number;
  /** Cursor Y relative to the scroll container's client area (inside border), origin top-left */
  clientY: number;
}

export interface ZoomListener {
  /**
   * Called on every rAF tick (~60fps).
   * Must only touch the DOM — no setState, no store writes.
   */
  onZoomTick(zoom: number, prevZoom: number): void;
  /**
   * Called once when animation settles.
   * React state/store updates are safe here.
   */
  onZoomSettle(zoom: number): void;
}

// Exponential decay lerp. 0.16 ≈ Firefox/Figma feel.
const LERP_FACTOR = 0.16;
const SETTLE_THRESHOLD = 0.0003;

class ZoomAnimationEngine {
  private current = 1;
  private target = 1;
  private origin: ZoomOrigin | null = null;
  private rafId: number | null = null;
  private listeners = new Set<ZoomListener>();
  private commitFn: ((zoom: number) => void) | null = null;

  init(zoom: number, commitZoom: (zoom: number) => void) {
    this.current = zoom;
    this.target = zoom;
    this.commitFn = commitZoom;
  }

  getOrigin(): ZoomOrigin | null {
    return this.origin;
  }

  addListener(l: ZoomListener): void {
    this.listeners.add(l);
  }
  removeListener(l: ZoomListener): void {
    this.listeners.delete(l);
  }

  /** Current lerped zoom — use for display only */
  getLiveZoom(): number {
    return this.current;
  }

  /**
   * The queued target zoom.
   * Use this (not getLiveZoom) when accumulating rapid scroll events so
   * each wheel tick adds on top of the already-queued destination.
   */
  getTargetZoom(): number {
    return this.target;
  }

  setTarget(target: number, origin?: ZoomOrigin): void {
    this.target = target;
    if (origin) this.origin = origin;
    this.scheduleRaf();
  }

  /** Instant jump without animation (e.g. Ctrl+0 fit-page) */
  snapTo(zoom: number): void {
    this.stop();
    this.current = zoom;
    this.target = zoom;
    this.origin = null;
    for (const l of this.listeners) l.onZoomSettle(zoom);
    this.commitFn?.(zoom);
  }

  private scheduleRaf() {
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.tick);
    }
  }

  private stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = () => {
    this.rafId = null;
    const prev = this.current;
    const diff = this.target - this.current;
    const settled = Math.abs(diff) < SETTLE_THRESHOLD;
    this.current = settled ? this.target : this.current + diff * LERP_FACTOR;

    // Layout + scroll stay at committed zoom during lerp; PdfCanvas CSS-scales the stack.

    for (const l of this.listeners) l.onZoomTick(this.current, prev);

    if (settled) {
      this.origin = null;
      // Listeners first while DOM still reflects pre-commit zoom/layout (e.g. sample viewport for scroll).
      for (const l of this.listeners) l.onZoomSettle(this.current);
      this.commitFn?.(this.current);
    } else {
      this.rafId = requestAnimationFrame(this.tick);
    }
  };
}

let instance: ZoomAnimationEngine | null = null;

export function getZoomEngine(): ZoomAnimationEngine {
  if (!instance) instance = new ZoomAnimationEngine();
  return instance;
}
