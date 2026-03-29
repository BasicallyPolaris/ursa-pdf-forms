import { useCallback } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { createTextField, type FormElement } from "@/lib/form-element-model";
import { pdfToScreen } from "@/lib/coordinates";

function getElementName(el: FormElement): string {
  if ("name" in el) return (el as { name: string }).name;
  if ("groupName" in el) return (el as { groupName: string }).groupName;
  return "";
}

export function CanvasOverlay() {
  const { elements, activeTool, zoom, pages, pdfBytes } = useEditorStore();
  const addElement = useEditorStore((s) => s.addElement);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (activeTool !== "text") return;

      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      let pageOffset = 0;
      for (const page of pages) {
        const pageScreenHeight = page.height * zoom;
        if (screenY >= pageOffset && screenY < pageOffset + pageScreenHeight) {
          const pdfPoint = {
            x: (screenX - (rect.width / 2 - (page.width * zoom) / 2)) / zoom,
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

    const pageCenterOffset =
      page ? (page.width * zoom) / 2 : 0;

    return (
      <div
        key={el.id}
        className="pointer-events-none absolute border border-blue-500 bg-blue-500/10"
        style={{
          left: `calc(50% - ${pageCenterOffset}px + ${screenPos.x}px)`,
          top: `${screenPos.y}px`,
          width: `${screenWidth}px`,
          height: `${screenHeight}px`,
        }}
      >
        <span className="absolute -top-4 left-0 truncate text-[10px] text-blue-400">
          {getElementName(el)}
        </span>
      </div>
    );
  });

  return (
    <div
      className="absolute inset-0"
      onClick={handleClick}
      style={{ cursor: activeTool !== "select" ? "crosshair" : "default" }}
    >
      {elementOverlays}
    </div>
  );
}
