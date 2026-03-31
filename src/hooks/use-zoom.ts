import { useEffect } from "react";
import { useEditorStore } from "@/stores/editor-store";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.1;
const ZOOM_PRESETS = [0.5, 0.75, 1, 1.5, 2, 4];

export { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, ZOOM_PRESETS };

function clampZoom(z: number): number {
  return Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)) * 100) / 100;
}

export function useZoom() {
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      const store = useEditorStore.getState();
      if (!store.pdfBytes) return;
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      store.setZoom(clampZoom(store.zoom + delta));
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", handleWheel);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)
      ) {
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const store = useEditorStore.getState();
      if (!store.pdfBytes) return;

      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        store.setZoom(clampZoom(store.zoom + ZOOM_STEP));
      }

      if (e.key === "-") {
        e.preventDefault();
        store.setZoom(clampZoom(store.zoom - ZOOM_STEP));
      }

      if (e.key === "0") {
        e.preventDefault();
        const container = document.querySelector(
          '[data-testid="canvas-area"]',
        );
        if (container && store.pages.length > 0) {
          const viewportWidth = container.clientWidth - 32;
          const firstPage = store.pages[0];
          const fitZoom = viewportWidth / firstPage.width;
          store.setZoom(clampZoom(fitZoom));
        }
      }

      if (e.key === "1") {
        e.preventDefault();
        store.setZoom(1);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
