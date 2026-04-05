import { useCallback, useRef, useState } from "react";
import { useEditorStore } from "@/stores/editor-store";
import {
  createTextField,
  createCheckbox,
  createRadioButton,
  type FormElement,
} from "@/lib/form-element-model";
import { screenToPdf, pdfToScreen } from "@/lib/coordinates";
import {
  snapPosition,
  hasAnySnap,
  type SnapGuide,
  type SnapContext,
} from "@/lib/snap-engine";

const MIN_DRAW_SIZE = 5;

const CLICK_TOOLS = new Set(["checkbox", "radio"]);
const HORIZONTAL_DRAW_TOOLS = new Set(["input"]);
const RECT_DRAW_TOOLS = new Set(["textarea"]);

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

export function useElementCreation() {
  const [drawRect, setDrawRect] = useState<DrawRect | null>(null);
  const drawStartRef = useRef<DrawStart | null>(null);
  const isDrawingRef = useRef(false);
  const [drawGuides, setDrawGuides] = useState<SnapGuide[]>([]);

  const addElement = useEditorStore((s) => s.addElement);
  const selectElements = useEditorStore((s) => s.selectElements);

  const handleClickCreate = useCallback(
    (
      screenX: number,
      screenY: number,
      pageNumber: number,
      activeTool: string,
      zoom: number,
      layout: { xOffset: number; yOffset: number },
      elementCount: number,
    ): boolean => {
      if (!CLICK_TOOLS.has(activeTool)) return false;

      const pdf = screenToPdf(
        { x: screenX, y: screenY },
        { zoom, pageX: layout.xOffset, pageY: layout.yOffset },
      );

      let newEl: FormElement;
      if (activeTool === "checkbox") {
        newEl = createCheckbox({
          x: pdf.x,
          y: pdf.y,
          pageNumber,
          name: `checkbox_${elementCount + 1}`,
        });
      } else {
        newEl = createRadioButton({
          x: pdf.x,
          y: pdf.y,
          pageNumber,
          groupName: "group_1",
          value: `option_${elementCount + 1}`,
        });
      }
      addElement(newEl);
      selectElements(new Set([newEl.id]));
      return true;
    },
    [addElement, selectElements],
  );

  const startDraw = useCallback(
    (
      screenX: number,
      screenY: number,
      pageNumber: number,
      activeTool: string,
      zoom: number,
      layout: { xOffset: number; yOffset: number },
      snapCtx: SnapContext,
    ) => {
      if (
        !HORIZONTAL_DRAW_TOOLS.has(activeTool) &&
        !RECT_DRAW_TOOLS.has(activeTool)
      )
        return false;

      const pdf = screenToPdf(
        { x: screenX, y: screenY },
        { zoom, pageX: layout.xOffset, pageY: layout.yOffset },
      );
      let startX = screenX;
      let startY = screenY;
      if (hasAnySnap(snapCtx)) {
        const snap = snapPosition(pdf.x, pdf.y, 0, 0, snapCtx);
        const snapped = pdfToScreen(
          { x: snap.x, y: snap.y },
          { zoom, pageX: layout.xOffset, pageY: layout.yOffset },
        );
        startX = snapped.x;
        startY = snapped.y;
      }
      drawStartRef.current = {
        x: startX,
        y: startY,
        pageX: layout.xOffset,
        pageY: layout.yOffset,
        pageNumber,
      };
      isDrawingRef.current = false;
      setDrawRect(null);
      return true;
    },
    [],
  );

  const updateDraw = useCallback(
    (
      currentX: number,
      currentY: number,
      zoom: number,
      snapCtx: SnapContext,
    ) => {
      if (!drawStartRef.current) return false;
      isDrawingRef.current = true;
      const start = drawStartRef.current;
      const pdfCurrent = screenToPdf(
        { x: currentX, y: currentY },
        { zoom, pageX: start.pageX, pageY: start.pageY },
      );
      let snappedCurrentX = currentX;
      let snappedCurrentY = currentY;
      if (hasAnySnap(snapCtx)) {
        const snap = snapPosition(pdfCurrent.x, pdfCurrent.y, 0, 0, snapCtx);
        const snappedScreen = pdfToScreen(
          { x: snap.x, y: snap.y },
          { zoom, pageX: start.pageX, pageY: start.pageY },
        );
        snappedCurrentX = snappedScreen.x;
        snappedCurrentY = snappedScreen.y;
        setDrawGuides(snap.guides);
      } else {
        setDrawGuides([]);
      }
      setDrawRect({
        startX: start.x,
        startY: start.y,
        currentX: snappedCurrentX,
        currentY: snappedCurrentY,
      });
      return true;
    },
    [],
  );

  const finishDraw = useCallback(
    (activeTool: string, zoom: number, elementCount: number): boolean => {
      if (!drawStartRef.current || !isDrawingRef.current || !drawRect) {
        drawStartRef.current = null;
        isDrawingRef.current = false;
        setDrawRect(null);
        setDrawGuides([]);
        return false;
      }

      const start = drawStartRef.current;
      const left = Math.min(drawRect.startX, drawRect.currentX);
      const top = Math.min(drawRect.startY, drawRect.currentY);
      const width = Math.abs(drawRect.currentX - drawRect.startX);

      if (HORIZONTAL_DRAW_TOOLS.has(activeTool) && width > MIN_DRAW_SIZE) {
        const pdfTopLeft = screenToPdf(
          { x: left, y: start.y },
          { zoom, pageX: start.pageX, pageY: start.pageY },
        );
        const pdfWidth = width / zoom;

        const newEl = createTextField({
          x: pdfTopLeft.x,
          y: pdfTopLeft.y,
          pageNumber: start.pageNumber,
          name: `text_${elementCount + 1}`,
          multiline: false,
          width: pdfWidth,
        });
        addElement(newEl);
        selectElements(new Set([newEl.id]));
      } else if (RECT_DRAW_TOOLS.has(activeTool)) {
        const height = Math.abs(drawRect.currentY - drawRect.startY);
        if (width > MIN_DRAW_SIZE && height > MIN_DRAW_SIZE) {
          const pdfTopLeft = screenToPdf(
            { x: left, y: top },
            { zoom, pageX: start.pageX, pageY: start.pageY },
          );
          const pdfWidth = width / zoom;
          const pdfHeight = height / zoom;

          const newEl = createTextField({
            x: pdfTopLeft.x,
            y: pdfTopLeft.y,
            pageNumber: start.pageNumber,
            name: `text_${elementCount + 1}`,
            multiline: true,
            width: pdfWidth,
            height: pdfHeight,
          });
          addElement(newEl);
          selectElements(new Set([newEl.id]));
        }
      }

      drawStartRef.current = null;
      isDrawingRef.current = false;
      setDrawRect(null);
      setDrawGuides([]);
      return true;
    },
    [drawRect, addElement, selectElements],
  );

  const resetDraw = useCallback(() => {
    drawStartRef.current = null;
    isDrawingRef.current = false;
    setDrawRect(null);
    setDrawGuides([]);
  }, []);

  const isDrawTool = (tool: string) =>
    CLICK_TOOLS.has(tool) ||
    HORIZONTAL_DRAW_TOOLS.has(tool) ||
    RECT_DRAW_TOOLS.has(tool);

  return {
    drawRect,
    drawGuides,
    drawStartRef,
    isDrawingRef,
    handleClickCreate,
    startDraw,
    updateDraw,
    finishDraw,
    resetDraw,
    isDrawTool,
    HORIZONTAL_DRAW_TOOLS,
    RECT_DRAW_TOOLS,
  };
}
