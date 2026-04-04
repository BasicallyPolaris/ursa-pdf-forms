import { getZoomEngine } from "@/lib/use-zoom-animation";
import { getScrollViewportTopCenterOrigin } from "@/lib/zoom-visual-transform";
import { useEditorStore } from "@/stores/editor-store";
import { useEffect } from "react";

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 4;
export const ZOOM_STEP = 0.1;
export const ZOOM_PRESETS = [0.5, 0.75, 1, 1.5, 2, 4];

export function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

function getScrollEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-pdf-scroll-container]");
}

export function useZoom() {
  useEffect(() => {
    const store = useEditorStore.getState();
    getZoomEngine().init(store.zoom, (zoom) =>
      useEditorStore.getState().setZoom(zoom),
    );
  }, []);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();

      const store = useEditorStore.getState();
      if (!store.pdfBytes) return;

      const scrollEl = getScrollEl();
      if (!scrollEl) return;

      const engine = getZoomEngine();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;

      // ✅ Accumulate against the QUEUED TARGET, not the current lerped value.
      // This is the fix for "only 1 step at a time": rapid wheel events now
      // stack correctly — each adds on top of where the animation is heading,
      // not where it currently is.
      const newTarget = clampZoom(engine.getTargetZoom() + delta);

      // Viewport top-center only: keeps zoom stable vs rulers; scroll is corrected on settle.
      engine.setTarget(newTarget, getScrollViewportTopCenterOrigin());
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)
      )
        return;

      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const store = useEditorStore.getState();
      if (!store.pdfBytes) return;

      const engine = getZoomEngine();

      const topCenter = getScrollViewportTopCenterOrigin();

      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        engine.setTarget(
          clampZoom(engine.getTargetZoom() + ZOOM_STEP),
          topCenter,
        );
      } else if (e.key === "-") {
        e.preventDefault();
        engine.setTarget(
          clampZoom(engine.getTargetZoom() - ZOOM_STEP),
          topCenter,
        );
      } else if (e.key === "0") {
        e.preventDefault();
        const container = document.querySelector('[data-testid="canvas-area"]');
        if (container && store.pages.length > 0) {
          const viewportWidth = container.clientWidth - 32;
          const fitZoom = clampZoom(viewportWidth / store.pages[0].width);
          engine.snapTo(fitZoom);
        }
      } else if (e.key === "1") {
        e.preventDefault();
        engine.setTarget(1, topCenter);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
