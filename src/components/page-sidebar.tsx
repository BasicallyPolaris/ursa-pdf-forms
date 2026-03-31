import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useEditorStore } from "@/stores/editor-store";
import { loadPdfDocument } from "@/lib/pdf-loader";

export function PageSidebar() {
  const { t } = useTranslation();
  const { pdfBytes, pages } = useEditorStore();
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pdfBytes || pages.length === 0) return;

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
  }, [pdfBytes, pages]);

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

  return (
    <aside
      data-testid="left-sidebar"
      className="flex w-44 flex-col border-r border-border bg-card"
    >
      <div className="px-2.5 py-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">{t("sidebar.pages")}</span>
      </div>
      {pdfBytes && (
        <div
          ref={containerRef}
          className="flex flex-col gap-1.5 overflow-auto px-2 pb-2"
        >
          {pages.map((page) => (
            <button
              key={page.pageNumber}
              onClick={() => scrollToPage(page.pageNumber)}
              className="group flex flex-col items-center gap-1 rounded-md border border-transparent p-1.5 hover:border-border hover:bg-accent/40 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-card"
            >
              <div className="overflow-hidden rounded-sm border border-border/50">
                <canvas
                  ref={(el) => {
                    if (el) canvasRefs.current.set(page.pageNumber, el);
                  }}
                  className="max-w-full"
                />
              </div>
              <span className="text-[10px] tabular-nums text-muted-foreground group-hover:text-foreground">
                {page.pageNumber}
              </span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
