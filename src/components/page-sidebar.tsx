import { useEffect, useRef } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { loadPdfDocument } from "@/lib/pdf-loader";

export function PageSidebar() {
  const { pdfBytes, pages, sidebarCollapsed, toggleSidebar } = useEditorStore();
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pdfBytes || sidebarCollapsed || pages.length === 0) return;

    let cancelled = false;
    const renderThumbnails = async () => {
      const { proxy: pdf } = await loadPdfDocument(pdfBytes);
      if (cancelled) return;

      const thumbScale = 0.2;

      for (let i = 1; i <= pdf.numPages; i++) {
        if (cancelled) return;

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
    };

    renderThumbnails();
    return () => {
      cancelled = true;
    };
  }, [pdfBytes, sidebarCollapsed, pages]);

  const scrollToPage = (pageNumber: number) => {
    const scrollContainer = document.querySelector("[data-pdf-scroll-container]");
    if (!scrollContainer) return;

    const pageCanvas = scrollContainer.querySelector(
      `[data-page-number="${pageNumber}"]`,
    );
    if (!pageCanvas) return;

    const containerRect = scrollContainer.getBoundingClientRect();
    const canvasRect = pageCanvas.getBoundingClientRect();
    const offset =
      canvasRect.top - containerRect.top + scrollContainer.scrollTop;

    scrollContainer.scrollTo({ top: offset, behavior: "smooth" });
  };

  if (sidebarCollapsed) {
    return (
      <aside
        data-testid="left-sidebar"
        className="flex w-10 flex-col items-center border-r border-border bg-card py-2"
      >
        <button
          onClick={() => toggleSidebar()}
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
          onClick={() => toggleSidebar()}
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
