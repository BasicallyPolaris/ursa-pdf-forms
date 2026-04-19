/**
 * Zoom engine — batches rapid input, commits immediately on next rAF.
 *
 * Wheel events accumulate against the target zoom. On the next animation
 * frame the target is committed to the store, triggering a single React
 * re-render. No interpolation — every frame reflects input directly.
 * PDF rasterization is debounced separately in PdfCanvas.
 */

import { prefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

export interface ZoomListener {
  /**
   * Called once immediately before the zoom is committed to the store.
   * Use to capture DOM state (e.g. scroll position) before React re-renders.
   */
  onZoomSettle(zoom: number): void;
}

class ZoomEngine {
  private target = 1;
  private rafId: number | null = null;
  private listeners = new Set<ZoomListener>();
  private commitFn: ((zoom: number) => void) | null = null;

  init(zoom: number, commitZoom: (zoom: number) => void) {
    this.target = zoom;
    this.commitFn = commitZoom;
  }

  addListener(l: ZoomListener): void {
    this.listeners.add(l);
  }
  removeListener(l: ZoomListener): void {
    this.listeners.delete(l);
  }

  /**
   * The queued target zoom.
   * Use this when accumulating rapid scroll events so each wheel tick
   * adds on top of the already-queued destination.
   */
  getTargetZoom(): number {
    return this.target;
  }

  setTarget(target: number): void {
    this.target = target;
    if (prefersReducedMotion()) {
      this.notifyAndCommit(target);
    } else {
      this.scheduleRaf();
    }
  }

  /** Instant jump without batching (e.g. Ctrl+0 fit-page). */
  snapTo(zoom: number): void {
    this.stop();
    this.target = zoom;
    this.notifyAndCommit(zoom);
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
    this.notifyAndCommit(this.target);
  };

  private notifyAndCommit(zoom: number) {
    for (const l of this.listeners) l.onZoomSettle(zoom);
    this.commitFn?.(zoom);
  }
}

let instance: ZoomEngine | null = null;

export function getZoomEngine(): ZoomEngine {
  if (!instance) instance = new ZoomEngine();
  return instance;
}
