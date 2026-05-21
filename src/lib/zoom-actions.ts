import {
  CANVAS_AREA_FIT_WIDTH_INSET_PX,
  clampZoom,
  ZOOM_STEP,
} from "@/hooks/use-zoom";
import { getZoomEngine } from "@/lib/use-zoom-animation";
import { useEditorStore } from "@/stores/editor-store";

export function zoomIn(): void {
  const store = useEditorStore.getState();
  if (!store.pdfBytes) return;
  const engine = getZoomEngine();
  engine.setTarget(clampZoom(engine.getTargetZoom() + ZOOM_STEP));
}

export function zoomOut(): void {
  const store = useEditorStore.getState();
  if (!store.pdfBytes) return;
  const engine = getZoomEngine();
  engine.setTarget(clampZoom(engine.getTargetZoom() - ZOOM_STEP));
}

export function zoomTo100(): void {
  const store = useEditorStore.getState();
  if (!store.pdfBytes) return;
  getZoomEngine().setTarget(1);
}

export function zoomFitWidth(): void {
  const store = useEditorStore.getState();
  if (!store.pdfBytes || store.pages.length === 0) return;
  const container = document.querySelector('[data-testid="canvas-area"]');
  if (!container) return;
  const viewportWidth =
    container.clientWidth - CANVAS_AREA_FIT_WIDTH_INSET_PX;
  const fitZoom = clampZoom(viewportWidth / store.pages[0].width);
  getZoomEngine().snapTo(fitZoom);
}
