import { useCallback, useRef, useState } from "react";
import { useEditorStore } from "@/stores/editor-store";
import {
  createTextField,
  heightFromFontSize,
  type FormElement,
} from "@/lib/form-element-model";
import { screenToPdf } from "@/lib/coordinates";
import { snapPosition, type SnapGuide, type SnapContext } from "@/lib/snap-engine";
import { HORIZONTAL_DRAW_TOOLS, RECT_DRAW_TOOLS } from "@/components/canvas-overlay/shared-constants";

interface DrawRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface DrawStart {
  x: number;
  y: number;
  pageX: number;
  pageY: number;
  pageNumber: number;
}

export function useDrawingTool(deps: {
  zoom: number;
  buildSnapContext: (
    excludedIds: Set<string>,
    pageNumber: number,
    modifiers: { shiftKey: boolean; ctrlKey: boolean },
  ) => SnapContext;
  setActiveGuides: (guides: SnapGuide[]) => void;
}) {
  const [drawRect, setDrawRect] = useState<DrawRect | null>(null);
  const drawStartRef = useRef<DrawStart | null>(null);
  const isDrawingRef = useRef(false);

  const startDraw = useCallback(
    (
      screenX: number,
      screenY: number,
      pageNumber: number,
      pageX: number,
      pageY: number,
      pdfX: number,
      pdfY: number,
      modifiers: { shiftKey: boolean; ctrlKey: boolean },
    ) => {
      const snapCtx = deps.buildSnapContext(new Set(), pageNumber, modifiers);
      let startX = screenX;
      let startY = screenY;
      if (snapCtx.hasAnySnap) {
        const snap = snapPosition(pdfX, pdfY, 0, 0, snapCtx);
        const snapped = {
          x: pdfX * deps.zoom + pageX + (snap.x - pdfX) * deps.zoom,
          y: pdfY * deps.zoom + pageY + (snap.y - pdfY) * deps.zoom,
        };
        startX = snapped.x;
        startY = snapped.y;
      }
      drawStartRef.current = {
        x: startX,
        y: startY,
        pageX,
        pageY,
        pageNumber,
      };
      isDrawingRef.current = false;
      setDrawRect(null);
    },
    [deps],
  );

  const updateDraw = useCallback(
    (
      currentX: number,
      currentY: number,
      modifiers: { shiftKey: boolean; ctrlKey: boolean },
    ) => {
      if (!drawStartRef.current) return;
      isDrawingRef.current = true;
      const start = drawStartRef.current;
      const pdfCurrent = screenToPdf(
        { x: currentX, y: currentY },
        { zoom: deps.zoom, pageX: start.pageX, pageY: start.pageY },
      );
      const snapCtx = deps.buildSnapContext(new Set(), start.pageNumber, modifiers);
      let snappedCurrentX = currentX;
      let snappedCurrentY = currentY;
      if (snapCtx.hasAnySnap) {
        const snap = snapPosition(pdfCurrent.x, pdfCurrent.y, 0, 0, snapCtx);
        const snappedScreen = {
          x: pdfCurrent.x * deps.zoom + start.pageX + (snap.x - pdfCurrent.x) * deps.zoom,
          y: pdfCurrent.y * deps.zoom + start.pageY + (snap.y - pdfCurrent.y) * deps.zoom,
        };
        snappedCurrentX = snappedScreen.x;
        snappedCurrentY = snappedScreen.y;
        deps.setActiveGuides(
          snapCtx.snapToGrid
            ? snap.guides.filter((g) => g.type !== "grid")
            : snap.guides,
        );
      } else {
        deps.setActiveGuides([]);
      }
      setDrawRect({
        startX: start.x,
        startY: start.y,
        currentX: snappedCurrentX,
        currentY: snappedCurrentY,
      });
    },
    [deps],
  );

  const finalizeDraw = useCallback(
    (
      activeTool: string,
    ): { element: FormElement; guides: SnapGuide[] } | null => {
      if (!drawStartRef.current || !isDrawingRef.current || !drawRect) {
        drawStartRef.current = null;
        isDrawingRef.current = false;
        setDrawRect(null);
        deps.setActiveGuides([]);
        return null;
      }

      const start = drawStartRef.current;
      const left = Math.min(drawRect.startX, drawRect.currentX);
      const top = Math.min(drawRect.startY, drawRect.currentY);
      const width = Math.abs(drawRect.currentX - drawRect.startX);

      const state = useEditorStore.getState();
      let newEl: FormElement | null = null;

      if (HORIZONTAL_DRAW_TOOLS.has(activeTool) && width > 5) {
        const pdfTopLeft = screenToPdf(
          { x: left, y: start.y },
          { zoom: deps.zoom, pageX: start.pageX, pageY: start.pageY },
        );
        const pdfWidth = width / deps.zoom;

        newEl = createTextField({
          x: pdfTopLeft.x,
          y: pdfTopLeft.y,
          pageNumber: start.pageNumber,
          name: `text_${state.elements.length + 1}`,
          multiline: false,
          width: pdfWidth,
        });
      } else if (RECT_DRAW_TOOLS.has(activeTool)) {
        const height = Math.abs(drawRect.currentY - drawRect.startY);
        if (width > 5 && height > 5) {
          const pdfTopLeft = screenToPdf(
            { x: left, y: top },
            { zoom: deps.zoom, pageX: start.pageX, pageY: start.pageY },
          );
          const pdfWidth = width / deps.zoom;
          const pdfHeight = height / deps.zoom;

          newEl = createTextField({
            x: pdfTopLeft.x,
            y: pdfTopLeft.y,
            pageNumber: start.pageNumber,
            name: `text_${state.elements.length + 1}`,
            multiline: true,
            width: pdfWidth,
            height: pdfHeight,
          });
        }
      }

      drawStartRef.current = null;
      isDrawingRef.current = false;
      setDrawRect(null);
      deps.setActiveGuides([]);

      return newEl ? { element: newEl, guides: [] } : null;
    },
    [drawRect, deps],
  );

  const computeDrawRectStyle = useCallback(
    (activeTool: string) => {
      if (!drawRect) return null;
      const left = Math.min(drawRect.startX, drawRect.currentX);
      const top = Math.min(drawRect.startY, drawRect.currentY);
      const width = Math.abs(drawRect.currentX - drawRect.startX);
      const height = Math.abs(drawRect.currentY - drawRect.startY);

      if (HORIZONTAL_DRAW_TOOLS.has(activeTool)) {
        const fontSize = 12;
        const autoHeight = heightFromFontSize(fontSize) * deps.zoom;
        const start = drawStartRef.current;
        const startY = start ? start.y : top;
        return { left, top: startY, width, height: autoHeight };
      }
      return { left, top, width, height };
    },
    [drawRect, deps.zoom],
  );

  return {
    drawRect,
    drawStartRef,
    isDrawingRef,
    startDraw,
    updateDraw,
    finalizeDraw,
    computeDrawRectStyle,
  };
}
