import { useEffect, useRef, useCallback, type ReactNode } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { useEditorStore } from "@/stores/editor-store";
import { loadPdfDocument } from "@/lib/pdf-loader";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const RASTERIZE_DELAY = 200;

interface PdfCanvasProps {
  children?: ReactNode;
}

export function PdfCanvas({ children }: PdfCanvasProps) {
  const pdfBytes = useEditorStore((s) => s.pdfBytes);
  const zoom = useEditorStore((s) => s.zoom);
  const pagesRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderTasksRef = useRef<Map<number, pdfjsLib.RenderTask>>(new Map());
  const renderedZoomRef = useRef(zoom);
  const zoomRef = useRef(zoom);
  const rasterizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  zoomRef.current = zoom;

  const renderAllPages = useCallback(
    async (pdf: pdfjsLib.PDFDocumentProxy, scale: number) => {
      const container = pagesRef.current;
      if (!container) return;

      renderTasksRef.current.forEach((task) => task.cancel());
      renderTasksRef.current.clear();

      renderedZoomRef.current = scale;

      const existing = container.querySelectorAll<HTMLDivElement>("[data-page-wrapper]");
      const reuseMap = new Map<number, HTMLDivElement>();
      existing.forEach((el) => {
        const num = Number(el.dataset.pageWrapper);
        reuseMap.set(num, el);
      });

      const promises: Promise<void>[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const pagePromise = (async () => {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale });

          let wrapper = reuseMap.get(i);
          let canvas: HTMLCanvasElement;

          if (wrapper) {
            canvas = wrapper.querySelector("canvas")!;
            reuseMap.delete(i);
          } else {
            canvas = document.createElement("canvas");
            canvas.style.display = "block";
            canvas.style.margin = "0 auto";
            wrapper = document.createElement("div");
            wrapper.className = "flex justify-center";
            wrapper.dataset.pageWrapper = String(i);
            wrapper.appendChild(canvas);
            container.appendChild(wrapper);
          }

          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          canvas.dataset.pageNumber = String(i);

          wrapper.style.height = `${viewport.height}px`;

          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          const task = page.render({ canvas, viewport });
          renderTasksRef.current.set(i, task);
          try {
            await task.promise;
            renderTasksRef.current.delete(i);
          } catch {}
        })();

        promises.push(pagePromise);
      }

      await Promise.all(promises);

      reuseMap.forEach((el) => el.remove());
    },
    [],
  );

  useEffect(() => {
    if (!pdfBytes) {
      pdfDocRef.current = null;
      return;
    }

    let cancelled = false;
    const load = async () => {
      const { proxy: pdf } = await loadPdfDocument(pdfBytes);
      if (cancelled) return;

      pdfDocRef.current = pdf;
      await renderAllPages(pdf, zoomRef.current);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [pdfBytes]);

  useEffect(() => {
    const container = pagesRef.current;
    if (!container || !pdfDocRef.current) return;

    const renderedZoom = renderedZoomRef.current;
    const scaleRatio = zoom / renderedZoom;

    const wrappers = container.querySelectorAll<HTMLElement>("[data-page-wrapper]");
    for (let i = 0; i < wrappers.length; i++) {
      const wrapper = wrappers[i];
      const canvas = wrapper.querySelector("canvas");
      if (!canvas) continue;

      const canvasW = canvas.width;
      const canvasH = canvas.height;

      canvas.style.width = `${canvasW * scaleRatio}px`;
      canvas.style.height = `${canvasH * scaleRatio}px`;
      wrapper.style.height = `${canvasH * scaleRatio}px`;
    }

    if (rasterizeTimerRef.current) {
      clearTimeout(rasterizeTimerRef.current);
    }

    rasterizeTimerRef.current = setTimeout(() => {
      if (pdfDocRef.current) {
        renderAllPages(pdfDocRef.current, zoomRef.current);
      }
    }, RASTERIZE_DELAY);

    return () => {
      if (rasterizeTimerRef.current) {
        clearTimeout(rasterizeTimerRef.current);
      }
    };
  }, [zoom, renderAllPages]);

  if (!pdfBytes) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>Open a PDF file to get started</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto" data-pdf-scroll-container>
      <div className="relative w-fit min-w-full">
        <div
          ref={pagesRef}
          className="flex flex-col items-center gap-2 p-4"
        />
        {children}
      </div>
    </div>
  );
}
