import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useEditorStore } from "@/stores/editor-store";
import { loadPdfDocument } from "@/lib/pdf-loader";

const THUMB_SCALE = 0.2;
const MAX_CONCURRENT = 3;

export function PageSidebar() {
  const { t } = useTranslation();
  const { pdfBytes, pages } = useEditorStore();
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!pdfBytes || pages.length === 0) return;

    let cancelled = false;
    const queue: number[] = [];
    let activeRenders = 0;

    const processQueue = async (doc: Awaited<ReturnType<typeof loadPdfDocument>>) => {
      while (queue.length > 0 && activeRenders < MAX_CONCURRENT && !cancelled) {
        const pageNum = queue.shift();
        if (pageNum === undefined) break;

        const canvas = canvasRefs.current.get(pageNum);
        if (!canvas) continue;

        activeRenders++;
        try {
          const result = await doc.renderPage(pageNum, THUMB_SCALE);
          if (cancelled) {
            result.bitmap.close();
            break;
          }
          canvas.width = result.width;
          canvas.height = result.height;
          const ctx = canvas.getContext("2d");
          if (ctx) ctx.drawImage(result.bitmap, 0, 0);
          result.bitmap.close();
        } catch {
          // skip failed thumbnail
        } finally {
          activeRenders--;
        }
      }
    };

    const loadAndRender = async () => {
      const doc = await loadPdfDocument(pdfBytes);
      if (cancelled) return;

      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const num = Number((entry.target as HTMLElement).dataset.pageNum);
            if (!num) continue;
            queue.push(num);
            observerRef.current?.unobserve(entry.target);
          }
          if (queue.length > 0) processQueue(doc);
        },
        { root: containerRef.current, rootMargin: "200px" },
      );

      for (const ref of canvasRefs.current.values()) {
        const wrapper = ref.closest("[data-thumb-wrapper]");
        if (wrapper) observerRef.current.observe(wrapper);
      }
    };

    loadAndRender();

    return () => {
      cancelled = true;
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [pdfBytes, pages]);

  const scrollToPage = (pageNumber: number) => {
    const scrollContainer = document.querySelector(
      "[data-pdf-scroll-container]",
    );
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
      className="flex w-44 flex-col border-r border-border bg-card select-none"
    >
      <div className="px-2.5 py-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">
          {t("sidebar.pages")}
        </span>
      </div>
      {pdfBytes && (
        <div
          ref={containerRef}
          className="flex flex-col gap-1.5 overflow-auto px-2 pb-2 pt-1"
        >
          {pages.map((page) => (
            <button
              key={page.pageNumber}
              onClick={() => scrollToPage(page.pageNumber)}
              className="group flex flex-col items-center gap-1 rounded-md border border-transparent p-1.5 hover:border-border hover:bg-accent/40 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-card"
            >
              <div
                data-thumb-wrapper
                data-page-num={page.pageNumber}
                className="overflow-hidden rounded-sm border border-border/50"
              >
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
