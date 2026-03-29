import { useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { useEditorStore } from "@/stores/editor-store";

export function PageSidebar() {
  const { pdfBytes, pages, sidebarCollapsed } = useEditorStore();
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  const renderThumbnails = useCallback(async () => {
    if (!pdfBytes || sidebarCollapsed) return;

    const pdf = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
    const thumbScale = 0.2;

    for (let i = 1; i <= pdf.numPages; i++) {
      const canvas = canvasRefs.current.get(i);
      if (!canvas) continue;

      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: thumbScale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      await page.render({ canvas, viewport }).promise;
    }
  }, [pdfBytes, sidebarCollapsed]);

  useEffect(() => {
    renderThumbnails();
  }, [renderThumbnails]);

  const scrollToPage = (pageNumber: number) => {
    const canvasArea = document.querySelector("[data-testid='canvas-area']");
    if (!canvasArea) return;

    const pageCanvas = canvasArea.querySelector(
      `[data-page-number="${pageNumber}"]`,
    );
    if (pageCanvas) {
      pageCanvas.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (sidebarCollapsed) {
    return (
      <aside
        data-testid="left-sidebar"
        className="flex w-10 flex-col items-center border-r border-border bg-card py-2"
      >
        <button
          onClick={() => useEditorStore.getState().toggleSidebar()}
          className="text-xs text-muted-foreground hover:text-foreground"
          title="Expand sidebar"
        >
          &laquo;
        </button>
        {pdfBytes && pages.length > 0 && (
          <span className="mt-2 text-xs text-muted-foreground">
            1/{pages.length}
          </span>
        )}
      </aside>
    );
  }

  return (
    <aside
      data-testid="left-sidebar"
      className="flex w-48 flex-col border-r border-border bg-card"
    >
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-medium text-muted-foreground">Pages</span>
        <button
          onClick={() => useEditorStore.getState().toggleSidebar()}
          className="text-xs text-muted-foreground hover:text-foreground"
          title="Collapse sidebar"
        >
          &raquo;
        </button>
      </div>
      {pdfBytes && (
        <div
          ref={containerRef}
          className="flex flex-col gap-2 overflow-auto p-2"
        >
          {pages.map((page) => (
            <button
              key={page.pageNumber}
              onClick={() => scrollToPage(page.pageNumber)}
              className="flex flex-col items-center gap-1 rounded border border-border p-1 hover:bg-accent"
            >
              <canvas
                ref={(el) => {
                  if (el) canvasRefs.current.set(page.pageNumber, el);
                }}
                className="max-w-full"
              />
              <span className="text-xs text-muted-foreground">
                {page.pageNumber}
              </span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
