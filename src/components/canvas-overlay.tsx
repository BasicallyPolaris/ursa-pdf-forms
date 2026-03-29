import { useCallback, useEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { useEditorStore } from "@/stores/editor-store";
import { createTextField, type FormElement } from "@/lib/form-element-model";
import {
  pdfToScreen,
  screenToPdf,
  TOP_PADDING,
  PAGE_GAP,
} from "@/lib/coordinates";

function getElementName(el: FormElement): string {
  if ("name" in el) return (el as { name: string }).name;
  if ("groupName" in el) return (el as { groupName: string }).groupName;
  return "";
}

const MIN_SIZE = 10;

interface PageLayout {
  xOffset: number;
  yOffset: number;
  screenWidth: number;
  screenHeight: number;
}

export function CanvasOverlay() {
  const { elements, activeTool, zoom, pages, pdfBytes } = useEditorStore();
  const addElement = useEditorStore((s) => s.addElement);
  const updateElement = useEditorStore((s) => s.updateElement);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [overlayWidth, setOverlayWidth] = useState(0);

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

  const getPageLayouts = useCallback((): Map<number, PageLayout> => {
    const layouts = new Map<number, PageLayout>();
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

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (activeTool !== "text") return;
      if ((e.target as HTMLElement).closest("[data-element-overlay]")) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const layouts = getPageLayouts();
      for (const [pageNumber, layout] of layouts) {
        if (
          screenX >= layout.xOffset &&
          screenX < layout.xOffset + layout.screenWidth &&
          screenY >= layout.yOffset &&
          screenY < layout.yOffset + layout.screenHeight
        ) {
          const pdf = screenToPdf(
            { x: screenX, y: screenY },
            { zoom, pageX: layout.xOffset, pageY: layout.yOffset },
          );

          const el = createTextField({
            x: pdf.x,
            y: pdf.y,
            pageNumber,
            name: `text_${elements.length + 1}`,
          });
          addElement(el);
          setActiveTool("select");
          return;
        }
      }
    },
    [activeTool, zoom, elements.length, addElement, setActiveTool, getPageLayouts],
  );

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

    return (
      <Rnd
        key={el.id}
        data-element-overlay
        size={{ width: screenWidth, height: screenHeight }}
        position={{ x: screen.x, y: screen.y }}
        minWidth={MIN_SIZE}
        minHeight={MIN_SIZE}
        bounds="parent"
        onDragStop={(_e, d) => {
          const pl = layouts.get(el.pageNumber);
          if (!pl) return;
          const pdf = screenToPdf(
            { x: d.x, y: d.y },
            { zoom, pageX: pl.xOffset, pageY: pl.yOffset },
          );
          updateElement(el.id, { x: pdf.x, y: pdf.y });
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
        <div className="h-full w-full border border-blue-500 bg-blue-500/10">
          <span className="absolute -top-4 left-0 truncate text-[10px] text-blue-400">
            {getElementName(el)}
          </span>
        </div>
      </Rnd>
    );
  });

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0"
      onClick={handleCanvasClick}
      style={{ cursor: activeTool !== "select" ? "crosshair" : "default" }}
    >
      {elementOverlays}
    </div>
  );
}
