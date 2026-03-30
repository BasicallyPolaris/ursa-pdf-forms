import { useCallback, useEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { useEditorStore } from "@/stores/editor-store";
import { createTextField, createCheckbox, createRadioButton, type FormElement } from "@/lib/form-element-model";
import {
  pdfToScreen,
  screenToPdf,
  TOP_PADDING,
  PAGE_GAP,
} from "@/lib/coordinates";
import { rectsOverlap, type Rect } from "@/lib/geometry";
import { snapPosition, snapResizeBounds, type SnapGuide, type SnapContext } from "@/lib/snap-engine";
import { GridOverlay } from "./grid-overlay";

function getElementName(el: FormElement): string {
  if (el.type === "radio" && "groupName" in el) return el.groupName || el.value;
  if ("name" in el) return el.name;
  return "";
}

const MIN_SIZE = 10;

const CLICK_TOOLS = new Set(["input", "checkbox", "radio"]);
const DRAW_TOOLS = new Set(["textarea"]);

export function CanvasOverlay() {
  const {
    elements,
    activeTool,
    zoom,
    pages,
    pdfBytes,
    selectedIds,
    gridEnabled,
    gridSize,
    guides,
    previewGuide,
  } = useEditorStore();
  const addElement = useEditorStore((s) => s.addElement);
  const updateElement = useEditorStore((s) => s.updateElement);
  const selectElements = useEditorStore((s) => s.selectElements);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const addToSelection = useEditorStore((s) => s.addToSelection);
  const moveElements = useEditorStore((s) => s.moveElements);
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
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null);
  const [dragSnapCorrection, setDragSnapCorrection] = useState<{ dx: number; dy: number } | null>(null);
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
      const xOffset = Math.max(0, (overlayWidth - screenWidth) / 2);
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
    (draggedElementId: string | null, pageNumber: number): SnapContext => {
      const page = pages.find((p) => p.pageNumber === pageNumber);
      return {
        gridSize,
        snapThreshold: 5,
        pageWidth: page?.width ?? 612,
        pageHeight: page?.height ?? 792,
        otherElements: elements
          .filter((el) => el.id !== draggedElementId && el.pageNumber === pageNumber)
          .map((el) => ({ x: el.x, y: el.y, width: el.width, height: el.height })),
        rulerGuides: guides.map((g) => ({ orientation: g.orientation, position: g.position })),
        snapToGrid: gridEnabled,
        snapToPageEdges: gridEnabled,
        snapToElements: true,
        snapToGuides: true,
      };
    },
    [elements, pages, gridSize, gridEnabled, guides],
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
      if (!pageNumber) return;

      const layout = layouts.get(pageNumber)!;

      if (CLICK_TOOLS.has(activeTool)) {
        const pdf = screenToPdf(
          { x: screenX, y: screenY },
          { zoom, pageX: layout.xOffset, pageY: layout.yOffset },
        );

        if (gridEnabled) {
          pdf.x = Math.round(pdf.x / gridSize) * gridSize;
          pdf.y = Math.round(pdf.y / gridSize) * gridSize;
        }

        let newEl: FormElement;
        if (activeTool === "checkbox") {
          newEl = createCheckbox({
            x: pdf.x,
            y: pdf.y,
            pageNumber,
            name: `checkbox_${elements.length + 1}`,
          });
        } else if (activeTool === "radio") {
          newEl = createRadioButton({
            x: pdf.x,
            y: pdf.y,
            pageNumber,
            groupName: "group_1",
            value: `option_${elements.length + 1}`,
          });
        } else {
          newEl = createTextField({
            x: pdf.x,
            y: pdf.y,
            pageNumber,
            name: `text_${elements.length + 1}`,
            multiline: false,
            height: 20,
          });
        }
        addElement(newEl);
        selectElements(new Set([newEl.id]));
        return;
      }

      if (DRAW_TOOLS.has(activeTool)) {
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
      }
    },
    [activeTool, zoom, elements.length, addElement, selectElements, clearSelection, getPageLayouts, findPageAtPoint, gridEnabled, gridSize],
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
          const shiftOrCtrl = (e as React.MouseEvent).shiftKey || (e as React.MouseEvent).ctrlKey || (e as React.MouseEvent).metaKey;
          if (!isSelected) {
            if (shiftOrCtrl) {
              const store = useEditorStore.getState();
              const next = new Set(store.selectedIds);
              next.add(el.id);
              selectElements(next);
            } else {
              selectElements(new Set([el.id]));
            }
          }
          const positions = new Map<string, { x: number; y: number }>();
          for (const e of elements) {
            positions.set(e.id, { x: e.x, y: e.y });
          }
          dragStartPositions.current = positions;
          draggingId.current = el.id;
          setDragOffset(null);
          setDragSnapCorrection(null);
          setActiveGuides([]);
        }}
        onDrag={(_e, d) => {
          const deltaX = d.x - screen.x;
          const deltaY = d.y - screen.y;

          const snapCtx = buildSnapContext(el.id, el.pageNumber);
          const proposedPdfX = el.x + deltaX / zoom;
          const proposedPdfY = el.y + deltaY / zoom;

          if (snapCtx.snapToGrid || snapCtx.snapToElements || snapCtx.snapToGuides) {
            const result = snapPosition(proposedPdfX, proposedPdfY, el.width, el.height, snapCtx);
            const snappedDeltaX = (result.x - el.x) * zoom;
            const snappedDeltaY = (result.y - el.y) * zoom;
            setDragOffset({ dx: snappedDeltaX, dy: snappedDeltaY });
            setDragSnapCorrection({ dx: snappedDeltaX - deltaX, dy: snappedDeltaY - deltaY });
            setActiveGuides(result.guides);
          } else {
            setDragOffset({ dx: deltaX, dy: deltaY });
            setDragSnapCorrection(null);
            setActiveGuides([]);
          }
        }}
        onDragStop={(_e, d) => {
          const pl = layouts.get(el.pageNumber);
          if (!pl) return;

          const currentStore = useEditorStore.getState();
          const currentSelectedIds = currentStore.selectedIds;

          if (currentSelectedIds.size > 1 && currentSelectedIds.has(el.id)) {
            const snapCtx = buildSnapContext(null, el.pageNumber);
            const updates: Array<{ id: string; x: number; y: number }> = [];
            for (const otherEl of elements) {
              if (!currentSelectedIds.has(otherEl.id)) continue;
              const startPos = dragStartPositions.current?.get(otherEl.id);
              if (startPos) {
                let newX = startPos.x + (d.x - screen.x) / zoom;
                let newY = startPos.y + (d.y - screen.y) / zoom;

                if (snapCtx.snapToGrid || snapCtx.snapToElements || snapCtx.snapToGuides) {
                  const result = snapPosition(newX, newY, otherEl.width, otherEl.height, snapCtx);
                  newX = result.x;
                  newY = result.y;
                }

                updates.push({ id: otherEl.id, x: newX, y: newY });
              }
            }
            moveElements(updates);
          } else {
            const snapCtx = buildSnapContext(el.id, el.pageNumber);
            const proposedX = el.x + (d.x - screen.x) / zoom;
            const proposedY = el.y + (d.y - screen.y) / zoom;

            let finalX = proposedX;
            let finalY = proposedY;
            if (snapCtx.snapToGrid || snapCtx.snapToElements || snapCtx.snapToGuides) {
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
        }}
        onResize={(_e, dir, ref, _delta, position) => {
          const pl = layouts.get(el.pageNumber);
          if (!pl) return;
          const newWidth = parseFloat(ref.style.width) / zoom;
          const newHeight = parseFloat(ref.style.height) / zoom;
          const pdf = screenToPdf(
            { x: position.x, y: position.y },
            { zoom, pageX: pl.xOffset, pageY: pl.yOffset },
          );

          const snapCtx = buildSnapContext(el.id, el.pageNumber);
          if (snapCtx.snapToGrid || snapCtx.snapToElements || snapCtx.snapToGuides) {
            const result = snapResizeBounds(pdf.x, pdf.y, newWidth, newHeight, dir, snapCtx);
            setActiveGuides(result.guides);
          }
        }}
        onResizeStop={(_e, dir, ref, _delta, position) => {
          const pl = layouts.get(el.pageNumber);
          if (!pl) return;
          let newWidth = parseFloat(ref.style.width) / zoom;
          let newHeight = parseFloat(ref.style.height) / zoom;
          const { x: pdfX, y: pdfY } = screenToPdf(
            { x: position.x, y: position.y },
            { zoom, pageX: pl.xOffset, pageY: pl.yOffset },
          );

          const snapCtx = buildSnapContext(el.id, el.pageNumber);
          let finalX = pdfX;
          let finalY = pdfY;
          if (snapCtx.snapToGrid || snapCtx.snapToElements || snapCtx.snapToGuides) {
            const result = snapResizeBounds(pdfX, pdfY, newWidth, newHeight, dir, snapCtx);
            finalX = result.x;
            finalY = result.y;
            newWidth = result.width;
            newHeight = result.height;
          }

          updateElement(el.id, {
            x: finalX,
            y: finalY,
            width: Math.max(MIN_SIZE / zoom, newWidth),
            height: Math.max(MIN_SIZE / zoom, newHeight),
          });
          setActiveGuides([]);
        }}
      >
        <div
          className={`h-full w-full flex items-center justify-center ${
            isSelected
              ? "ring-1 ring-blue-400/30"
              : ""
          } ${
            el.type === "checkbox"
              ? isSelected
                ? "border-2 border-green-400 bg-green-500/15"
                : "border border-green-500/50 bg-green-500/10"
              : el.type === "radio"
                ? isSelected
                  ? "border-2 border-purple-400 bg-purple-500/15"
                  : "border border-purple-500/50 bg-purple-500/10"
                : el.type === "text" && el.multiline
                  ? isSelected
                    ? "border-2 border-amber-400 bg-amber-500/15"
                    : "border border-amber-500/50 bg-amber-500/10"
                  : isSelected
                    ? "border-2 border-blue-400 bg-blue-500/15"
                    : "border border-blue-500/50 bg-blue-500/10"
          }`}
          style={
            draggingId.current === el.id && dragSnapCorrection
              ? { transform: `translate(${dragSnapCorrection.dx}px, ${dragSnapCorrection.dy}px)` }
              : undefined
          }
        >
          {el.type === "checkbox" && (
            <svg viewBox="0 0 10 10" className="h-3/5 w-3/5 text-green-500">
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
            <svg viewBox="0 0 10 10" className="h-3/5 w-3/5 text-purple-500">
              <circle cx="5" cy="5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1" />
              <circle cx="5" cy="5" r="1.5" fill="currentColor" />
            </svg>
          )}
          {el.type === "text" && el.multiline && (
            <svg viewBox="0 0 12 12" className="h-3/5 w-3/5 text-amber-500 opacity-50">
              <line x1="2" y1="3" x2="10" y2="3" stroke="currentColor" strokeWidth="1" />
              <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1" />
              <line x1="2" y1="9" x2="7" y2="9" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
          <span className={`absolute -top-4 left-0 truncate text-[10px] ${
            el.type === "checkbox" ? "text-green-400" : el.type === "radio" ? "text-purple-400" : el.type === "text" && el.multiline ? "text-amber-400" : "text-blue-400"
          }`}>
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
    ? {
        left: Math.min(drawRect.startX, drawRect.currentX),
        top: Math.min(drawRect.startY, drawRect.currentY),
        width: Math.abs(drawRect.currentX - drawRect.startX),
        height: Math.abs(drawRect.currentY - drawRect.startY),
      }
    : null;

  const guideLineElements = activeGuides.map((guide, i) => {
    const draggedEl = draggingId.current ? elements.find((e) => e.id === draggingId.current) : null;
    const layout = draggedEl ? layouts.get(draggedEl.pageNumber) : layouts.get(1);
    if (!layout) return null;
    if (guide.orientation === "horizontal") {
      const screenY = layout.yOffset + guide.position * zoom;
      return (
        <div
          key={`guide-${i}`}
          className="pointer-events-none absolute z-50"
          style={{
            left: layout.xOffset,
            top: screenY,
            width: layout.screenWidth,
            height: 1,
            backgroundColor: guide.type === "element" ? "#f97316" : "#22d3ee",
          }}
        />
      );
    } else {
      const screenX = layout.xOffset + guide.position * zoom;
      return (
        <div
          key={`guide-${i}`}
          className="pointer-events-none absolute z-50"
          style={{
            left: screenX,
            top: layout.yOffset,
            width: 1,
            height: layout.screenHeight,
            backgroundColor: guide.type === "element" ? "#f97316" : "#22d3ee",
          }}
        />
      );
    }
  });

  const persistentGuideElements = pages.flatMap((page) => {
    const layout = layouts.get(page.pageNumber);
    if (!layout) return [];
    return guides.map((guide) => {
      if (guide.orientation === "horizontal") {
        const screenY = layout.yOffset + guide.position * zoom;
        return (
          <div
            key={`${guide.id}-${page.pageNumber}`}
            className="pointer-events-none absolute z-40"
            style={{
              left: layout.xOffset,
              top: screenY,
              width: layout.screenWidth,
              height: 1,
              backgroundColor: "#22d3ee",
              opacity: 0.6,
            }}
          />
        );
      } else {
        const screenX = layout.xOffset + guide.position * zoom;
        return (
          <div
            key={`${guide.id}-${page.pageNumber}`}
            className="pointer-events-none absolute z-40"
            style={{
              left: screenX,
              top: layout.yOffset,
              width: 1,
              height: layout.screenHeight,
              backgroundColor: "#22d3ee",
              opacity: 0.6,
            }}
          />
        );
      }
    });
  });

  const previewGuideElements = previewGuide
    ? pages.flatMap((page) => {
        const layout = layouts.get(page.pageNumber);
        if (!layout) return [];
        if (previewGuide.orientation === "horizontal") {
          const screenY = layout.yOffset + previewGuide.position * zoom;
          return [
            <div
              key="preview-guide"
              className="pointer-events-none absolute z-50"
              style={{
                left: layout.xOffset,
                top: screenY,
                width: layout.screenWidth,
                height: 1,
                backgroundColor: "#22d3ee",
              }}
            />,
          ];
        } else {
          const screenX = layout.xOffset + previewGuide.position * zoom;
          return [
            <div
              key="preview-guide"
              className="pointer-events-none absolute z-50"
              style={{
                left: screenX,
                top: layout.yOffset,
                width: 1,
                height: layout.screenHeight,
                backgroundColor: "#22d3ee",
              }}
            />,
          ];
        }
      })
    : [];

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0"
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      style={{ cursor: activeTool !== "select" ? "crosshair" : "default" }}
    >
      <GridOverlay overlayWidth={overlayWidth} />
      {elementOverlays}
      {persistentGuideElements}
      {previewGuideElements}
      {guideLineElements}
      {marqueeRect && marqueeRect.width > 0 && marqueeRect.height > 0 && (
        <div
          className="pointer-events-none absolute border border-blue-400/60 bg-blue-400/10"
          style={{
            left: marqueeRect.left,
            top: marqueeRect.top,
            width: marqueeRect.width,
            height: marqueeRect.height,
          }}
        />
      )}
      {drawRectStyle && drawRectStyle.width > 0 && drawRectStyle.height > 0 && (
        <div
          className="pointer-events-none absolute border-2 border-amber-400/70 bg-amber-400/10"
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
