import { lockCursor, unlockCursor } from "@/lib/cursor";
import { useEditorStore } from "@/stores/editor-store";
import { useEffect, type RefObject } from "react";

export function useMiddleClickPan(
  scrollRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let panning = false;
    let lastClientX = 0;
    let lastClientY = 0;

    const endPan = () => {
      if (!panning) return;
      panning = false;
      unlockCursor();
      window.removeEventListener("mousemove", onWindowMouseMove);
      window.removeEventListener("mouseup", onWindowMouseUp);
    };

    const onWindowMouseMove = (e: MouseEvent) => {
      if (!panning) return;
      const dx = e.clientX - lastClientX;
      const dy = e.clientY - lastClientY;
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      const allowHorizontal = el.scrollWidth > el.clientWidth;
      if (allowHorizontal) {
        el.scrollLeft -= dx;
      }
      el.scrollTop -= dy;
    };

    const onWindowMouseUp = (e: MouseEvent) => {
      if (e.button === 1) endPan();
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 1) return;
      if (!useEditorStore.getState().pdfBytes) return;
      e.preventDefault();
      panning = true;
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      lockCursor("grab");
      window.addEventListener("mousemove", onWindowMouseMove);
      window.addEventListener("mouseup", onWindowMouseUp);
    };

    const onAuxClick = (e: MouseEvent) => {
      if (e.button !== 1) return;
      if (!useEditorStore.getState().pdfBytes) return;
      e.preventDefault();
    };

    el.addEventListener("mousedown", onMouseDown, { capture: true });
    el.addEventListener("auxclick", onAuxClick, { capture: true });

    return () => {
      el.removeEventListener("mousedown", onMouseDown, { capture: true });
      el.removeEventListener("auxclick", onAuxClick, { capture: true });
      endPan();
    };
  }, [scrollRef]);
}
