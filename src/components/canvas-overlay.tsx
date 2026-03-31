import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Rnd } from "react-rnd";
import { useEditorStore } from "@/stores/editor-store";
import { createTextField, createCheckbox, createRadioButton, heightFromFontSize, type FormElement } from "@/lib/form-element-model";
import {
  pdfToScreen,
  screenToPdf,
  TOP_PADDING,
  PAGE_GAP,
  H_PADDING,
} from "@/lib/coordinates";
import { rectsOverlap, type Rect } from "@/lib/geometry";
import { snapPosition, snapResizeBounds, type SnapGuide, type SnapContext } from "@/lib/snap-engine";
import { computeBoundingRect } from "@/lib/selection-geometry";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Trash2 } from "lucide-react";
import { lockCursor, unlockCursor } from "@/lib/cursor";
import { getElementStyleConfig, getElementStyleConfigByType } from "@/lib/element-style-map";

function getElementName(el: FormElement): string {
  if (el.type === "radio" && "groupName" in el) return el.groupName || el.value;
  if ("name" in el) return el.name;
  return "";
}

const MIN_SIZE = 10;

const CLICK_TOOLS = new Set(["checkbox", "radio"]);
const HORIZONTAL_DRAW_TOOLS = new Set(["input"]);
const RECT_DRAW_TOOLS = new Set(["textarea"]);

export function CanvasOverlay() {
  const { t } = useTranslation();
  const {
    elements,
    activeTool,
    zoom,
    pages,
    pdfBytes,
    selectedIds,
    gridSize,
    guides,
    previewGuide,
  } = useEditorStore();
  const addElement = useEditorStore((s) => s.addElement);
  const updateElement = useEditorStore((s) => s.updateElement);
  const selectElements = useEditorStore((s) => s.selectElements);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const addToSelection = useEditorStore((s) => s.addToSelection);
  const toggleInSelection = useEditorStore((s) => s.toggleInSelection);
  const moveElements = useEditorStore((s) => s.moveElements);
  const setDragLivePositions = useEditorStore((s) => s.setDragLivePositions);
  const dragLivePositions = useEditorStore((s) => s.dragLivePositions);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [overlayWidth, setOverlayWidth] = useState(0);

  const [marquee, setMarquee] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  const [drawRect, setDrawRect] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const drawStartRef = useRef<{ x: number; y: number; pageX: number; pageY: number; pageNumber: number } | null>(null);
  const isDrawingRef = useRef(false);

  const dragStartPositions = useRef<Map<string, { x: number; y: number }> | null>(null);
  const draggingId = useRef<string | null>(null);
  const pendingToggleId = useRef<string | null>(null);
  const resizingId = useRef<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null);
  const [dragSnapCorrection, setDragSnapCorrection] = useState<{ dx: number; dy: number } | null>(null);
  const lastResizeSnap = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const [resizeSnapCorrection, setResizeSnapCorrection] = useState<{ dx: number; dy: number; dw: number; dh: number } | null>(null);
  const [activeGuides, setActiveGuides] = useState<SnapGuide[]>([]);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    setOverlayWidth(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      setOverlayWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const getPageLayouts = useCallback((): Map<
    number,
    { xOffset: number; yOffset: number; screenWidth: number; screenHeight: number }
  > => {
    const layouts = new Map<
      number,
      { xOffset: number; yOffset: number; screenWidth: number; screenHeight: number }
    >();
    let currentY = TOP_PADDING;
    for (const page of pages) {
      const screenWidth = page.width * zoom;
      const screenHeight = page.height * zoom;
      const xOffset = Math.max(H_PADDING, (overlayWidth - screenWidth) / 2);
      layouts.set(page.pageNumber, {
        xOffset,
        yOffset: currentY,
        screenWidth,
        screenHeight,
      });
      currentY += screenHeight + PAGE_GAP;
    }
    return layouts;
  }, [pages, zoom, overlayWidth]);

  const findPageAtPoint = useCallback(
    (screenX: number, screenY: number, layouts: Map<number, { xOffset: number; yOffset: number; screenWidth: number; screenHeight: number }>) => {
      for (const [pageNumber, layout] of layouts) {
        if (
          screenX >= layout.xOffset &&
          screenX < layout.xOffset + layout.screenWidth &&
          screenY >= layout.yOffset &&
          screenY < layout.yOffset + layout.screenHeight
        ) {
          return pageNumber;
        }
      }
      return null;
    },
    [],
  );

  const buildSnapContext = useCallback(
    (excludedIds: Set<string>, pageNumber: number, modifiers: { shiftKey: boolean; ctrlKey: boolean }): SnapContext => {
      const page = pages.find((p) => p.pageNumber === pageNumber);
      const freeMovement = modifiers.ctrlKey;
      return {
        gridSize,
        snapThreshold: 5,
        pageWidth: page?.width ?? 612,
        pageHeight: page?.height ?? 792,
        otherElements: elements
          .filter((el) => !excludedIds.has(el.id) && el.pageNumber === pageNumber)
          .map((el) => ({ x: el.x, y: el.y, width: el.width, height: el.height })),
        rulerGuides: guides.map((g) => ({ orientation: g.orientation, position: g.position })),
        snapToGrid: modifiers.shiftKey && !freeMovement,
        snapToPageEdges: !modifiers.shiftKey && !freeMovement,
        snapToElements: !modifiers.shiftKey && !freeMovement,
        snapToGuides: !modifiers.shiftKey && !freeMovement,
      };
    },
    [elements, pages, gridSize, guides],
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;

      const elementTarget = (e.target as HTMLElement).closest("[data-element-overlay]");
      if (elementTarget) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const layouts = getPageLayouts();
      const pageNumber = findPageAtPoint(screenX, screenY, layouts);

      if (activeTool === "select") {
        if (!e.shiftKey) {
          clearSelection();
        }
        marqueeStartRef.current = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
        isDraggingRef.current = false;
        setMarquee(null);
        return;
      }

      if (!pageNumber) return;

      const layout = layouts.get(pageNumber)!;

      if (CLICK_TOOLS.has(activeTool)) {
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
            name: `checkbox_${elements.length + 1}`,
          });
        } else {
          newEl = createRadioButton({
            x: pdf.x,
            y: pdf.y,
            pageNumber,
            groupName: "group_1",
            value: `option_${elements.length + 1}`,
          });
        }
        addElement(newEl);
        selectElements(new Set([newEl.id]));
        return;
      }

      if (HORIZONTAL_DRAW_TOOLS.has(activeTool) || RECT_DRAW_TOOLS.has(activeTool)) {
        drawStartRef.current = {
          x: screenX,
          y: screenY,
          pageX: layout.xOffset,
          pageY: layout.yOffset,
          pageNumber,
        };
        isDrawingRef.current = false;
        setDrawRect(null);
        return;
      }

    },
    [activeTool, zoom, elements.length, addElement, selectElements, clearSelection, getPageLayouts, findPageAtPoint],
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      if (drawStartRef.current) {
        isDrawingRef.current = true;
        setDrawRect({
          startX: drawStartRef.current.x,
          startY: drawStartRef.current.y,
          currentX,
          currentY,
        });
        return;
      }

      if (!marqueeStartRef.current) return;
      isDraggingRef.current = true;
      setMarquee({
        startX: marqueeStartRef.current.x,
        startY: marqueeStartRef.current.y,
        currentX,
        currentY,
      });
    },
    [],
  );

  const handleCanvasMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (drawStartRef.current && isDrawingRef.current && drawRect) {
        const start = drawStartRef.current;
        const left = Math.min(drawRect.startX, drawRect.currentX);
        const top = Math.min(drawRect.startY, drawRect.currentY);
        const width = Math.abs(drawRect.currentX - drawRect.startX);

        if (HORIZONTAL_DRAW_TOOLS.has(activeTool) && width > 5) {
          const pdfTopLeft = screenToPdf(
            { x: left, y: start.y },
            { zoom, pageX: start.pageX, pageY: start.pageY },
          );
          const pdfWidth = width / zoom;

          const newEl = createTextField({
            x: pdfTopLeft.x,
            y: pdfTopLeft.y,
            pageNumber: start.pageNumber,
            name: `text_${elements.length + 1}`,
            multiline: false,
            width: pdfWidth,
          });
          addElement(newEl);
          selectElements(new Set([newEl.id]));
        } else if (RECT_DRAW_TOOLS.has(activeTool)) {
          const height = Math.abs(drawRect.currentY - drawRect.startY);
          if (width > 5 && height > 5) {
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
              name: `text_${elements.length + 1}`,
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
        return;
      }

      drawStartRef.current = null;
      isDrawingRef.current = false;
      setDrawRect(null);

      if (marqueeStartRef.current && isDraggingRef.current && marquee) {
        const layouts = getPageLayouts();
        const left = Math.min(marquee.startX, marquee.currentX);
        const top = Math.min(marquee.startY, marquee.currentY);
        const width = Math.abs(marquee.currentX - marquee.startX);
        const height = Math.abs(marquee.currentY - marquee.startY);

        if (width > 3 && height > 3) {
          const marqueeRect: Rect = { x: left, y: top, width, height };
          const hitIds: string[] = [];

          for (const el of elements) {
            const layout = layouts.get(el.pageNumber);
            if (!layout) continue;
            const screen = pdfToScreen(
              { x: el.x, y: el.y },
              { zoom, pageX: layout.xOffset, pageY: layout.yOffset },
            );
            const elRect: Rect = {
              x: screen.x,
              y: screen.y,
              width: el.width * zoom,
              height: el.height * zoom,
            };
            if (rectsOverlap(marqueeRect, elRect)) {
              hitIds.push(el.id);
            }
          }

          if (e.shiftKey) {
            addToSelection(hitIds);
          } else {
            selectElements(new Set(hitIds));
          }
        }
      }
      marqueeStartRef.current = null;
      isDraggingRef.current = false;
      setMarquee(null);
    },
    [drawRect, marquee, activeTool, zoom, elements, addElement, selectElements, addToSelection, getPageLayouts],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        const layouts = getPageLayouts();
        if (layouts.size === 0) return;
        const scrollEl = overlayRef.current?.parentElement;
        if (!scrollEl) return;
        const scrollCenter = scrollEl.scrollTop + scrollEl.clientHeight / 2;
        let closestPage = 1;
        let closestDist = Infinity;
        for (const [pageNum, layout] of layouts) {
          const pageCenter = layout.yOffset + layout.screenHeight / 2;
          const dist = Math.abs(pageCenter - scrollCenter);
          if (dist < closestDist) {
            closestDist = dist;
            closestPage = pageNum;
          }
        }
        const pageIds = elements
          .filter((el) => el.pageNumber === closestPage)
          .map((el) => el.id);
        selectElements(new Set(pageIds));
      }

      const store = useEditorStore.getState();
      if (store.selectedIds.size === 0) return;
      if (!store.pdfBytes) return;

      const nudge = e.shiftKey ? 5 : 1;
      let dx = 0;
      let dy = 0;

      if (e.key === "ArrowLeft") { dx = -nudge; }
      else if (e.key === "ArrowRight") { dx = nudge; }
      else if (e.key === "ArrowUp") { dy = -nudge; }
      else if (e.key === "ArrowDown") { dy = nudge; }
      else return;

      e.preventDefault();
      const updates: Array<{ id: string; x: number; y: number }> = [];
      for (const el of store.elements) {
        if (store.selectedIds.has(el.id)) {
          updates.push({ id: el.id, x: el.x + dx, y: el.y + dy });
        }
      }
      if (updates.length > 0) {
        store.moveElements(updates);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [elements, getPageLayouts, selectElements]);

  if (!pdfBytes) return null;

  const layouts = getPageLayouts();

  const isInputEl = (el: FormElement) =>
    el.type === "text" && !el.multiline;

  const elementOverlays = elements.map((el) => {
    const layout = layouts.get(el.pageNumber);
    if (!layout) return null;

    const isSelected = selectedIds.has(el.id);
    const screen = pdfToScreen(
      { x: el.x, y: el.y },
      { zoom, pageX: layout.xOffset, pageY: layout.yOffset },
    );
    if (isSelected && dragOffset && draggingId.current !== el.id) {
      screen.x += dragOffset.dx;
      screen.y += dragOffset.dy;
    }
    const screenWidth = el.width * zoom;
    const screenHeight = el.height * zoom;

    const isSingleInput = isInputEl(el);

    return (
      <Rnd
        key={el.id}
        data-element-overlay
        data-element-id={el.id}
        size={{ width: screenWidth, height: screenHeight }}
        position={{ x: screen.x, y: screen.y }}
        minWidth={MIN_SIZE}
        minHeight={MIN_SIZE}
        bounds="parent"
        enableResizing={
          isSingleInput
            ? { left: true, right: true, topLeft: false, topRight: false, bottomLeft: false, bottomRight: false, top: false, bottom: false }
            : undefined
        }
        onDragStart={(e) => {
          const mouseEvent = e as React.MouseEvent;
          const shiftOrCtrl = mouseEvent.shiftKey || mouseEvent.ctrlKey || mouseEvent.metaKey;
          if (!isSelected) {
            if (shiftOrCtrl) {
              const store = useEditorStore.getState();
              const next = new Set(store.selectedIds);
              next.add(el.id);
              selectElements(next);
            } else {
              selectElements(new Set([el.id]));
            }
          } else if (shiftOrCtrl) {
            pendingToggleId.current = el.id;
          }
          lockCursor("grab");
          const positions = new Map<string, { x: number; y: number }>();
          for (const e of elements) {
            positions.set(e.id, { x: e.x, y: e.y });
          }
          dragStartPositions.current = positions;
          draggingId.current = el.id;
          setDragOffset(null);
          setDragSnapCorrection(null);
          setActiveGuides([]);
          setResizeSnapCorrection(null);
          lastResizeSnap.current = null;
          resizingId.current = null;
        }}
        onDrag={(dragEvent, d) => {
          if (pendingToggleId.current) pendingToggleId.current = null;
          const me = dragEvent as unknown as MouseEvent;
          const deltaX = d.x - screen.x;
          const deltaY = d.y - screen.y;
          const rawDx = deltaX / zoom;
          const rawDy = deltaY / zoom;

          const currentStore = useEditorStore.getState();
          const currentSelectedIds = currentStore.selectedIds;
          const isMultiDrag = currentSelectedIds.size > 1 && currentSelectedIds.has(el.id);

          const livePositions = new Map<string, { x: number; y: number; width: number; height: number }>();
          let correctionDx = 0;
          let correctionDy = 0;
          let guides: SnapGuide[] = [];

          const snapCtx = buildSnapContext(
            isMultiDrag ? currentSelectedIds : new Set([el.id]),
            el.pageNumber,
            { shiftKey: me.shiftKey, ctrlKey: me.ctrlKey || me.metaKey },
          );
          const hasSnap = snapCtx.snapToGrid || snapCtx.snapToElements || snapCtx.snapToGuides || snapCtx.snapToPageEdges;

          if (hasSnap) {
            if (isMultiDrag) {
              const selectedOnPage = elements.filter(
                (e) => currentSelectedIds.has(e.id) && e.pageNumber === el.pageNumber,
              );
              if (selectedOnPage.length >= 2) {
                let minBX = Infinity, minBY = Infinity, maxBX = -Infinity, maxBY = -Infinity;
                for (const selEl of selectedOnPage) {
                  const sp = dragStartPositions.current?.get(selEl.id);
                  if (!sp) continue;
                  const px = sp.x + rawDx;
                  const py = sp.y + rawDy;
                  if (px < minBX) minBX = px;
                  if (py < minBY) minBY = py;
                  if (px + selEl.width > maxBX) maxBX = px + selEl.width;
                  if (py + selEl.height > maxBY) maxBY = py + selEl.height;
                }
                const result = snapPosition(minBX, minBY, maxBX - minBX, maxBY - minBY, snapCtx);
                correctionDx = result.x - minBX;
                correctionDy = result.y - minBY;
                guides = result.guides;
              } else {
                const proposedX = el.x + rawDx;
                const proposedY = el.y + rawDy;
                const result = snapPosition(proposedX, proposedY, el.width, el.height, snapCtx);
                correctionDx = result.x - proposedX;
                correctionDy = result.y - proposedY;
                guides = result.guides;
              }
            } else {
              const proposedX = el.x + rawDx;
              const proposedY = el.y + rawDy;
              const result = snapPosition(proposedX, proposedY, el.width, el.height, snapCtx);
              correctionDx = result.x - proposedX;
              correctionDy = result.y - proposedY;
              guides = result.guides;
            }
          }

          setDragOffset({ dx: deltaX + correctionDx * zoom, dy: deltaY + correctionDy * zoom });
          setDragSnapCorrection(hasSnap ? { dx: correctionDx * zoom, dy: correctionDy * zoom } : null);
          setActiveGuides(guides);

          if (isMultiDrag) {
            for (const selEl of elements) {
              if (!currentSelectedIds.has(selEl.id)) continue;
              const sp = dragStartPositions.current?.get(selEl.id);
              if (!sp) continue;
              livePositions.set(selEl.id, {
                x: sp.x + rawDx + correctionDx,
                y: sp.y + rawDy + correctionDy,
                width: selEl.width,
                height: selEl.height,
              });
            }
          } else {
            livePositions.set(el.id, {
              x: el.x + rawDx + correctionDx,
              y: el.y + rawDy + correctionDy,
              width: el.width,
              height: el.height,
            });
          }
          setDragLivePositions(livePositions);
        }}
        onDragStop={(dragStopEvent, d) => {
          if (pendingToggleId.current === el.id) {
            toggleInSelection(el.id);
            pendingToggleId.current = null;
            dragStartPositions.current = null;
            draggingId.current = null;
            setDragOffset(null);
            setDragSnapCorrection(null);
            setActiveGuides([]);
            setDragLivePositions(null);
            unlockCursor();
            return;
          }

          const me = dragStopEvent as unknown as MouseEvent;
          const pl = layouts.get(el.pageNumber);
          if (!pl) return;

          const currentStore = useEditorStore.getState();
          const currentSelectedIds = currentStore.selectedIds;

          if (currentSelectedIds.size > 1 && currentSelectedIds.has(el.id)) {
            const rawDx = (d.x - screen.x) / zoom;
            const rawDy = (d.y - screen.y) / zoom;

            const selectedOnPage = elements.filter(
              (e) => currentSelectedIds.has(e.id) && e.pageNumber === el.pageNumber,
            );

            let correctionDx = 0;
            let correctionDy = 0;

            const snapCtx = buildSnapContext(currentSelectedIds, el.pageNumber, { shiftKey: me.shiftKey, ctrlKey: me.ctrlKey || me.metaKey });
            const hasSnap = snapCtx.snapToGrid || snapCtx.snapToElements || snapCtx.snapToGuides || snapCtx.snapToPageEdges;

            if (hasSnap) {
              if (selectedOnPage.length >= 2) {
                let minBX = Infinity, minBY = Infinity, maxBX = -Infinity, maxBY = -Infinity;
                for (const selEl of selectedOnPage) {
                  const sp = dragStartPositions.current?.get(selEl.id);
                  if (!sp) continue;
                  const px = sp.x + rawDx;
                  const py = sp.y + rawDy;
                  if (px < minBX) minBX = px;
                  if (py < minBY) minBY = py;
                  if (px + selEl.width > maxBX) maxBX = px + selEl.width;
                  if (py + selEl.height > maxBY) maxBY = py + selEl.height;
                }
                const result = snapPosition(minBX, minBY, maxBX - minBX, maxBY - minBY, snapCtx);
                correctionDx = result.x - minBX;
                correctionDy = result.y - minBY;
              } else {
                const proposedX = el.x + rawDx;
                const proposedY = el.y + rawDy;
                const result = snapPosition(proposedX, proposedY, el.width, el.height, snapCtx);
                correctionDx = result.x - proposedX;
                correctionDy = result.y - proposedY;
              }
            }

            const updates: Array<{ id: string; x: number; y: number }> = [];
            for (const otherEl of elements) {
              if (!currentSelectedIds.has(otherEl.id)) continue;
              const startPos = dragStartPositions.current?.get(otherEl.id);
              if (startPos) {
                updates.push({
                  id: otherEl.id,
                  x: startPos.x + rawDx + correctionDx,
                  y: startPos.y + rawDy + correctionDy,
                });
              }
            }
            moveElements(updates);
          } else {
            const snapCtx = buildSnapContext(new Set([el.id]), el.pageNumber, { shiftKey: me.shiftKey, ctrlKey: me.ctrlKey || me.metaKey });
            const proposedX = el.x + (d.x - screen.x) / zoom;
            const proposedY = el.y + (d.y - screen.y) / zoom;

            let finalX = proposedX;
            let finalY = proposedY;
            if (snapCtx.snapToGrid || snapCtx.snapToElements || snapCtx.snapToGuides || snapCtx.snapToPageEdges) {
              const result = snapPosition(proposedX, proposedY, el.width, el.height, snapCtx);
              finalX = result.x;
              finalY = result.y;
            }

            updateElement(el.id, { x: finalX, y: finalY });
          }
          dragStartPositions.current = null;
          draggingId.current = null;
          setDragOffset(null);
          setDragSnapCorrection(null);
          setActiveGuides([]);
          setDragLivePositions(null);
          unlockCursor();
        }}
        onResize={(resizeEvent, dir, ref, _delta, position) => {
          const me = resizeEvent as unknown as MouseEvent;
          lockCursor(isSingleInput ? "ew" : "nwse");
          resizingId.current = el.id;
          const pl = layouts.get(el.pageNumber);
          if (!pl) return;
          const rawWidth = parseFloat(ref.style.width) / zoom;
          const rawHeight = parseFloat(ref.style.height) / zoom;
          const rawPdf = screenToPdf(
            { x: position.x, y: position.y },
            { zoom, pageX: pl.xOffset, pageY: pl.yOffset },
          );

          const snapCtx = buildSnapContext(new Set([el.id]), el.pageNumber, { shiftKey: me.shiftKey, ctrlKey: me.ctrlKey || me.metaKey });
          const hasSnap = snapCtx.snapToGrid || snapCtx.snapToElements || snapCtx.snapToGuides || snapCtx.snapToPageEdges;

          if (hasSnap) {
            const result = snapResizeBounds(rawPdf.x, rawPdf.y, rawWidth, rawHeight, dir, snapCtx);
            const snappedW = Math.max(MIN_SIZE / zoom, result.width);
            const snappedH = Math.max(MIN_SIZE / zoom, result.height);

            lastResizeSnap.current = { x: result.x, y: result.y, width: snappedW, height: snappedH };

            const dx = (result.x - rawPdf.x) * zoom;
            const dy = (result.y - rawPdf.y) * zoom;
            const dw = (snappedW - rawWidth) * zoom;
            const dh = (snappedH - rawHeight) * zoom;
            setResizeSnapCorrection({ dx, dy, dw, dh });
            setActiveGuides(result.guides);

            const livePositions = new Map<string, { x: number; y: number; width: number; height: number }>();
            livePositions.set(el.id, {
              x: result.x,
              y: result.y,
              width: snappedW,
              height: snappedH,
            });
            setDragLivePositions(livePositions);
          } else {
            lastResizeSnap.current = null;
            setResizeSnapCorrection(null);
            setActiveGuides([]);
          }
        }}
        onResizeStop={() => {
          const snap = lastResizeSnap.current;
          if (snap) {
            updateElement(el.id, {
              x: snap.x,
              y: snap.y,
              width: snap.width,
              height: snap.height,
            });
          }
          lastResizeSnap.current = null;
          setResizeSnapCorrection(null);
          setActiveGuides([]);
          setDragLivePositions(null);
          resizingId.current = null;
          unlockCursor();
        }}
      >
        <div
          className={`h-full w-full flex items-center justify-center ${
            isSelected ? "ring-1 ring-field-text/30" : ""
          } ${getElementStyleConfig(el).borderBgClass(isSelected)}`}
          style={
            resizingId.current === el.id && resizeSnapCorrection
              ? {
                  transform: `translate(${resizeSnapCorrection.dx}px, ${resizeSnapCorrection.dy}px)`,
                  width: `calc(100% + ${resizeSnapCorrection.dw}px)`,
                  height: `calc(100% + ${resizeSnapCorrection.dh}px)`,
                }
              : draggingId.current === el.id && dragSnapCorrection
                ? { transform: `translate(${dragSnapCorrection.dx}px, ${dragSnapCorrection.dy}px)` }
                : undefined
          }
        >
          {el.type === "checkbox" && (
            <svg viewBox="0 0 10 10" className={`h-3/5 w-3/5 ${getElementStyleConfig(el).colorClass}`}>
              <path
                d="M2 5L4 7L8 3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {el.type === "radio" && (
            <svg viewBox="0 0 10 10" className={`h-3/5 w-3/5 ${getElementStyleConfig(el).colorClass}`}>
              <circle cx="5" cy="5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1" />
              <circle cx="5" cy="5" r="1.5" fill="currentColor" />
            </svg>
          )}
          {el.type === "text" && el.multiline && (
            <svg viewBox="0 0 12 12" className={`h-3/5 w-3/5 ${getElementStyleConfig(el).colorClass} opacity-50`}>
              <line x1="2" y1="3" x2="10" y2="3" stroke="currentColor" strokeWidth="1" />
              <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1" />
              <line x1="2" y1="9" x2="7" y2="9" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
          <span className={`absolute -top-4 left-0 truncate text-[10px] select-none ${getElementStyleConfig(el).textColorClass}`}>
            {getElementName(el)}
          </span>
        </div>
      </Rnd>
    );
  });

  const marqueeRect = marquee
    ? {
        left: Math.min(marquee.startX, marquee.currentX),
        top: Math.min(marquee.startY, marquee.currentY),
        width: Math.abs(marquee.currentX - marquee.startX),
        height: Math.abs(marquee.currentY - marquee.startY),
      }
    : null;

  const drawRectStyle = drawRect
    ? (() => {
        const left = Math.min(drawRect.startX, drawRect.currentX);
        const top = Math.min(drawRect.startY, drawRect.currentY);
        const width = Math.abs(drawRect.currentX - drawRect.startX);
        const height = Math.abs(drawRect.currentY - drawRect.startY);

        if (HORIZONTAL_DRAW_TOOLS.has(activeTool)) {
          const fontSize = 12;
          const autoHeight = heightFromFontSize(fontSize) * zoom;
          const start = drawStartRef.current;
          const startY = start ? start.y : top;
          return { left, top: startY, width, height: autoHeight };
        }
        return { left, top, width, height };
      })()
    : null;

  const totalContentHeight = pages.length > 0
    ? pages.reduce((acc, p) => acc + p.height * zoom, 0) + TOP_PADDING + PAGE_GAP * (pages.length - 1)
    : 0;

  const guideLineElements = activeGuides.map((guide, i) => {
    if (guide.orientation === "horizontal") {
      const screenY = TOP_PADDING + guide.position * zoom;
      return (
        <div
          key={`guide-${i}`}
          className="pointer-events-none absolute z-50"
          style={{
            left: 0,
            top: screenY,
            width: overlayWidth,
            height: 1,
            backgroundColor: guide.type === "element" || guide.type === "grid" ? "var(--guide-snap)" : "var(--guide-ruler)",
          }}
        />
      );
    } else {
      const screenX = layouts.get(1)
        ? Math.max(H_PADDING, (overlayWidth - pages[0].width * zoom) / 2) + guide.position * zoom
        : guide.position * zoom;
      return (
        <div
          key={`guide-${i}`}
          className="pointer-events-none absolute z-50"
          style={{
            left: screenX,
            top: 0,
            width: 1,
            height: totalContentHeight,
            backgroundColor: guide.type === "element" || guide.type === "grid" ? "var(--guide-snap)" : "var(--guide-ruler)",
          }}
        />
      );
    }
  });

  const removeGuide = useEditorStore((s) => s.removeGuide);
  const updateGuidePosition = useEditorStore((s) => s.updateGuidePosition);
  const selectGuide = useEditorStore((s) => s.selectGuide);
  const selectedGuideId = useEditorStore((s) => s.selectedGuideId);

  const persistentGuideElements = guides.map((guide) => {
    const isSelected = selectedGuideId === guide.id;

    const handleGuideMouseDown = (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      selectGuide(guide.id);
      lockCursor(guide.orientation === "horizontal" ? "ns" : "ew");

      const overlayEl = overlayRef.current;
      if (!overlayEl) return;
      const overlayRect = overlayEl.getBoundingClientRect();
      const scrollEl = overlayEl.parentElement as HTMLElement;
      const sLeft = scrollEl?.scrollLeft ?? 0;
      const sTop = scrollEl?.scrollTop ?? 0;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const page = pages[0];
        if (!page) return;

        if (guide.orientation === "horizontal") {
          const relY = moveEvent.clientY - overlayRect.top + sTop;
          let pdfY = Math.max(0, Math.min(page.height, (relY - TOP_PADDING) / zoom));
          if (moveEvent.shiftKey) {
            pdfY = Math.round(pdfY / gridSize) * gridSize;
          }
          updateGuidePosition(guide.id, Math.round(pdfY * 10) / 10);
        } else {
          const relX = moveEvent.clientX - overlayRect.left + sLeft;
          const xOff = Math.max(H_PADDING, (overlayWidth - page.width * zoom) / 2);
          let pdfX = Math.max(0, Math.min(page.width, (relX - xOff) / zoom));
          if (moveEvent.shiftKey) {
            pdfX = Math.round(pdfX / gridSize) * gridSize;
          }
          updateGuidePosition(guide.id, Math.round(pdfX * 10) / 10);
        }
      };

      const onMouseUp = () => {
          unlockCursor();
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    const lineStyle: React.CSSProperties = {
      position: "absolute",
      backgroundColor: "var(--guide-ruler)",
      opacity: isSelected ? 1 : 0.6,
    };

    if (guide.orientation === "horizontal") {
      const screenY = TOP_PADDING + guide.position * zoom;
      return (
        <ContextMenu key={guide.id}>
          <ContextMenuTrigger
            render={<div />}
            className="absolute z-40 cursor-ns-resize group"
            style={{ left: 0, top: screenY - 4, width: overlayWidth, height: 9 }}
            onMouseDown={handleGuideMouseDown}
          >
            <div
              className="w-full group-hover:opacity-100"
              style={{ ...lineStyle, top: 4, height: 1 }}
            />
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem
              variant="destructive"
              className="text-xs"
              onClick={() => removeGuide(guide.id)}
            >
              <Trash2 className="size-3.5" />
              {t("properties.deleteGuide")}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );
    } else {
      const firstLayout = layouts.get(1);
      const screenX = firstLayout
        ? firstLayout.xOffset + guide.position * zoom
        : guide.position * zoom;
      return (
        <ContextMenu key={guide.id}>
          <ContextMenuTrigger
            render={<div />}
            className="absolute z-40 cursor-ew-resize group"
            style={{ left: screenX - 4, top: 0, width: 9, height: totalContentHeight }}
            onMouseDown={handleGuideMouseDown}
          >
            <div
              className="h-full group-hover:opacity-100"
              style={{ ...lineStyle, left: 4, width: 1 }}
            />
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem
              variant="destructive"
              className="text-xs"
              onClick={() => removeGuide(guide.id)}
            >
              <Trash2 className="size-3.5" />
              {t("properties.deleteGuide")}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );
    }
  });

  const previewGuideElements = previewGuide
    ? (() => {
        if (previewGuide.orientation === "horizontal") {
          const screenY = TOP_PADDING + previewGuide.position * zoom;
          return [
            <div
              key="preview-guide"
              className="pointer-events-none absolute z-50"
              style={{
                left: 0,
                top: screenY,
                width: overlayWidth,
                height: 1,
                backgroundColor: "var(--guide-ruler)",
              }}
            />,
          ];
        } else {
          const firstLayout = layouts.get(1);
          const screenX = firstLayout
            ? firstLayout.xOffset + previewGuide.position * zoom
            : previewGuide.position * zoom;
          return [
            <div
              key="preview-guide"
              className="pointer-events-none absolute z-50"
              style={{
                left: screenX,
                top: 0,
                width: 1,
                height: totalContentHeight,
                backgroundColor: "var(--guide-ruler)",
              }}
            />,
          ];
        }
      })()
    : [];

  const boundingRectOverlays = (() => {
    if (selectedIds.size < 2) return null;
    const byPage = new Map<number, Array<{ x: number; y: number; width: number; height: number }>>();
    for (const el of elements) {
      if (!selectedIds.has(el.id)) continue;
      if (!byPage.has(el.pageNumber)) byPage.set(el.pageNumber, []);
      const live = dragLivePositions?.get(el.id);
      byPage.get(el.pageNumber)!.push({
        x: live?.x ?? el.x,
        y: live?.y ?? el.y,
        width: live?.width ?? el.width,
        height: live?.height ?? el.height,
      });
    }
    const rects: Array<{ screenX: number; screenY: number; screenWidth: number; screenHeight: number }> = [];
    for (const [page, items] of byPage) {
      if (items.length < 2) continue;
      const rect = computeBoundingRect(items);
      if (!rect) continue;
      const layout = layouts.get(page);
      if (!layout) continue;
      const topLeft = pdfToScreen({ x: rect.x, y: rect.y }, { zoom, pageX: layout.xOffset, pageY: layout.yOffset });
      const bottomRight = pdfToScreen({ x: rect.x + rect.width, y: rect.y + rect.height }, { zoom, pageX: layout.xOffset, pageY: layout.yOffset });
      rects.push({
        screenX: topLeft.x,
        screenY: topLeft.y,
        screenWidth: bottomRight.x - topLeft.x,
        screenHeight: bottomRight.y - topLeft.y,
      });
    }
    return rects;
  })();

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 select-none"
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      style={{ cursor: activeTool !== "select" ? "crosshair" : "default" }}
    >
      {elementOverlays}
      {boundingRectOverlays?.map((rect, i) => (
        <div
          key={`bounding-rect-${i}`}
          className="pointer-events-none absolute"
          style={{
            left: rect.screenX,
            top: rect.screenY,
            width: rect.screenWidth,
            height: rect.screenHeight,
            border: dragOffset !== null
              ? "1px dashed var(--bounding-rect)"
              : "1px dotted var(--bounding-rect)",
            opacity: dragOffset !== null ? 0.6 : 0.4,
          }}
        />
      ))}
      {persistentGuideElements}
      {previewGuideElements}
      {guideLineElements}
      {marqueeRect && marqueeRect.width > 0 && marqueeRect.height > 0 && (
        <div
          className="pointer-events-none absolute border border-field-text/50 bg-field-text-bg"
          style={{
            left: marqueeRect.left,
            top: marqueeRect.top,
            width: marqueeRect.width,
            height: marqueeRect.height,
          }}
        />
      )}
      {drawRectStyle && drawRectStyle.width > 0 && (
        <div
          className={`pointer-events-none absolute ${
            HORIZONTAL_DRAW_TOOLS.has(activeTool)
              ? getElementStyleConfigByType("text")!.drawPreviewClass
              : getElementStyleConfigByType("multiline")!.drawPreviewClass
          }`}
          style={{
            left: drawRectStyle.left,
            top: drawRectStyle.top,
            width: drawRectStyle.width,
            height: drawRectStyle.height,
          }}
        />
      )}
    </div>
  );
}
