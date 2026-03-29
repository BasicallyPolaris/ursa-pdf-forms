import { useCallback } from "react";
import { Rnd } from "react-rnd";
import { useEditorStore } from "@/stores/editor-store";
import { createTextField, type FormElement } from "@/lib/form-element-model";
import { pdfToScreen, screenToPdf } from "@/lib/coordinates";

function getElementName(el: FormElement): string {
  if ("name" in el) return (el as { name: string }).name;
  if ("groupName" in el) return (el as { groupName: string }).groupName;
  return "";
}

const MIN_SIZE = 10;

export function CanvasOverlay() {
  const { elements, activeTool, zoom, pages, pdfBytes } = useEditorStore();
  const addElement = useEditorStore((s) => s.addElement);
  const updateElement = useEditorStore((s) => s.updateElement);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (activeTool !== "text") return;
      if ((e.target as HTMLElement).closest("[data-element-overlay]")) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      let pageOffset = 0;
      for (const page of pages) {
        const pageScreenHeight = page.height * zoom;
        if (screenY >= pageOffset && screenY < pageOffset + pageScreenHeight) {
          const pageCenterOffset = (page.width * zoom) / 2;
          const adjustedX = screenX - (rect.width / 2 - pageCenterOffset);

          const pdfPoint = {
            x: adjustedX / zoom,
            y: (screenY - pageOffset) / zoom,
          };

          const el = createTextField({
            x: pdfPoint.x,
            y: pdfPoint.y,
            pageNumber: page.pageNumber,
            name: `text_${elements.length + 1}`,
          });
          addElement(el);
          useEditorStore.getState().setActiveTool("select");
          return;
        }
        pageOffset += pageScreenHeight + 8;
      }
    },
    [activeTool, zoom, pages, elements.length, addElement],
  );

  if (!pdfBytes) return null;

  const elementOverlays = elements.map((el) => {
    const page = pages.find((p) => p.pageNumber === el.pageNumber);
    if (!page) return null;

    let offsetForPage = 0;
    for (const p of pages) {
      if (p.pageNumber === el.pageNumber) break;
      offsetForPage += p.height * zoom + 8;
    }

    const screenPos = pdfToScreen(
      { x: el.x, y: el.y },
      { zoom, pageOffset: offsetForPage },
    );

    const screenWidth = el.width * zoom;
    const screenHeight = el.height * zoom;

    const pageCenterOffset = (page.width * zoom) / 2;

    const leftOffset = `calc(50% - ${pageCenterOffset}px + ${screenPos.x}px)`;

    return (
      <Rnd
        key={el.id}
        data-element-overlay
        size={{ width: screenWidth, height: screenHeight }}
        position={{ x: 0, y: 0 }}
        style={{
          position: "absolute",
          left: leftOffset,
          top: `${screenPos.y}px`,
        }}
        minWidth={MIN_SIZE}
        minHeight={MIN_SIZE}
        bounds="parent"
        enableResizing={{
          top: true,
          right: true,
          bottom: true,
          left: true,
          topRight: true,
          bottomRight: true,
          bottomLeft: true,
          topLeft: true,
        }}
        onDragStop={(_e, d) => {
          const newScreenY = screenPos.y + d.deltaY;
          const newScreenX = screenPos.x + d.deltaX;

          const newPdf = screenToPdf(
            { x: newScreenX, y: newScreenY },
            { zoom, pageOffset: offsetForPage },
          );
          updateElement(el.id, { x: newPdf.x, y: newPdf.y });
        }}
        onResizeStop={(_e, _dir, ref, _delta, _position) => {
          const newWidth = parseFloat(ref.style.width) / zoom;
          const newHeight = parseFloat(ref.style.height) / zoom;
          updateElement(el.id, {
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
      className="absolute inset-0"
      onClick={handleCanvasClick}
      style={{ cursor: activeTool !== "select" ? "crosshair" : "default" }}
    >
      {elementOverlays}
    </div>
  );
}
