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

function getElementName(el: FormElement): string {
  if (el.type === "radio" && "groupName" in el) return el.groupName || el.value;
  if ("name" in el) return el.name;
  return "";
}

const MIN_SIZE = 10;

export function CanvasOverlay() {
  const {
    elements,
    activeTool,
    zoom,
    pages,
    pdfBytes,
    selectedIds,
  } = useEditorStore();
  const addElement = useEditorStore((s) => s.addElement);
  const updateElement = useEditorStore((s) => s.updateElement);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const selectElements = useEditorStore((s) => s.selectElements);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const toggleInSelection = useEditorStore((s) => s.toggleInSelection);
  const addToSelection = useEditorStore((s) => s.addToSelection);
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

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;

      const elementTarget = (e.target as HTMLElement).closest("[data-element-overlay]");

      if (elementTarget) {
        if (activeTool !== "select") return;
        const elementId = (elementTarget as HTMLElement).getAttribute("data-element-id");
        if (!elementId) return;
        if (e.shiftKey) {
          toggleInSelection(elementId);
        } else if (!selectedIds.has(elementId)) {
          selectElements(new Set([elementId]));
        }
        return;
      }

      if (activeTool === "text" || activeTool === "checkbox" || activeTool === "radio") {
        const rect = e.currentTarget.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const layouts = getPageLayouts();
        const pageNumber = findPageAtPoint(screenX, screenY, layouts);
        if (!pageNumber) return;

        const layout = layouts.get(pageNumber)!;
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
          });
        }
        addElement(newEl);
        selectElements(new Set([newEl.id]));
        setActiveTool("select");
        return;
      }

      if (activeTool === "select") {
        if (!e.shiftKey) {
          clearSelection();
        }
        const rect = e.currentTarget.getBoundingClientRect();
        marqueeStartRef.current = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
        isDraggingRef.current = false;
        setMarquee(null);
      }
    },
    [activeTool, zoom, elements.length, selectedIds, addElement, selectElements, setActiveTool, clearSelection, toggleInSelection, getPageLayouts, findPageAtPoint],
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!marqueeStartRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
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
    [marquee, elements, zoom, getPageLayouts, selectElements, addToSelection],
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

  const elementOverlays = elements.map((el) => {
    const layout = layouts.get(el.pageNumber);
    if (!layout) return null;

    const screen = pdfToScreen(
      { x: el.x, y: el.y },
      { zoom, pageX: layout.xOffset, pageY: layout.yOffset },
    );
    const screenWidth = el.width * zoom;
    const screenHeight = el.height * zoom;
    const isSelected = selectedIds.has(el.id);

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
        onDragStart={() => {
          if (!isSelected) {
            selectElements(new Set([el.id]));
          }
        }}
        onDrag={(_e, d) => {
          if (selectedIds.size > 1 && isSelected) {
            const deltaX = d.x - screen.x;
            const deltaY = d.y - screen.y;
            for (const otherEl of elements) {
              if (otherEl.id === el.id) continue;
              if (!selectedIds.has(otherEl.id)) continue;
              const otherLayout = layouts.get(otherEl.pageNumber);
              if (!otherLayout) continue;
              const otherScreen = pdfToScreen(
                { x: otherEl.x, y: otherEl.y },
                { zoom, pageX: otherLayout.xOffset, pageY: otherLayout.yOffset },
              );
              const rndEl = document.querySelector(
                `[data-element-overlay][style*="${otherEl.id}"]`,
              );
              if (rndEl) {
                const htmlEl = rndEl as HTMLElement;
                htmlEl.style.transform = `translate(${otherScreen.x + deltaX}px, ${otherScreen.y + deltaY}px)`;
              }
            }
          }
        }}
        onDragStop={(_e, d) => {
          const pl = layouts.get(el.pageNumber);
          if (!pl) return;
          const deltaX = d.x - screen.x;
          const deltaY = d.y - screen.y;
          const pdfDeltaX = deltaX / zoom;
          const pdfDeltaY = deltaY / zoom;

          if (selectedIds.size > 1 && isSelected) {
            for (const otherEl of elements) {
              if (!selectedIds.has(otherEl.id)) continue;
              updateElement(otherEl.id, {
                x: otherEl.x + pdfDeltaX,
                y: otherEl.y + pdfDeltaY,
              });
            }
          } else {
            const pdf = screenToPdf(
              { x: d.x, y: d.y },
              { zoom, pageX: pl.xOffset, pageY: pl.yOffset },
            );
            updateElement(el.id, { x: pdf.x, y: pdf.y });
          }
        }}
        onResizeStop={(_e, _dir, ref, _delta, position) => {
          const pl = layouts.get(el.pageNumber);
          if (!pl) return;
          const newWidth = parseFloat(ref.style.width) / zoom;
          const newHeight = parseFloat(ref.style.height) / zoom;
          const pdf = screenToPdf(
            { x: position.x, y: position.y },
            { zoom, pageX: pl.xOffset, pageY: pl.yOffset },
          );
          updateElement(el.id, {
            x: pdf.x,
            y: pdf.y,
            width: Math.max(MIN_SIZE / zoom, newWidth),
            height: Math.max(MIN_SIZE / zoom, newHeight),
          });
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
                : isSelected
                  ? "border-2 border-blue-400 bg-blue-500/15"
                  : "border border-blue-500/50 bg-blue-500/10"
          }`}
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
          <span className={`absolute -top-4 left-0 truncate text-[10px] ${
            el.type === "checkbox" ? "text-green-400" : el.type === "radio" ? "text-purple-400" : "text-blue-400"
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

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0"
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      style={{ cursor: activeTool !== "select" ? "crosshair" : "default" }}
    >
      {elementOverlays}
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
    </div>
  );
}
