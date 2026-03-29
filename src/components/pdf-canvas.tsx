import { useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { useEditorStore } from "@/stores/editor-store";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export function PdfCanvas() {
  const { pdfBytes, zoom } = useEditorStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderTasksRef = useRef<Map<number, pdfjsLib.RenderTask>>(new Map());

  const renderAllPages = useCallback(
    async (pdf: pdfjsLib.PDFDocumentProxy) => {
      const container = containerRef.current;
      if (!container) return;

      renderTasksRef.current.forEach((task) => task.cancel());
      renderTasksRef.current.clear();

      container.innerHTML = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: zoom });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.display = "block";
        canvas.style.margin = "0 auto";
        canvas.dataset.pageNumber = String(i);

        const wrapper = document.createElement("div");
        wrapper.className = "flex justify-center";
        wrapper.style.height = `${viewport.height}px`;
        wrapper.appendChild(canvas);
        container.appendChild(wrapper);

        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        const task = page.render({ canvas, viewport });
        renderTasksRef.current.set(i, task);
        try {
          await task.promise;
          renderTasksRef.current.delete(i);
        } catch {
          // cancelled
        }
      }
    },
    [zoom],
  );

  useEffect(() => {
    if (!pdfBytes) return;

    let cancelled = false;
    const load = async () => {
      const pdf = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
      if (cancelled) return;

      pdfDocRef.current = pdf;

      const pageInfos = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale: 1 });
        pageInfos.push({
          width: vp.width,
          height: vp.height,
          pageNumber: i,
        });
      }

      if (cancelled) return;

      useEditorStore.getState().setPdf(
        useEditorStore.getState().pdfFileName ?? "document.pdf",
        pdfBytes,
        pageInfos,
      );

      await renderAllPages(pdf);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [pdfBytes, renderAllPages]);

  useEffect(() => {
    if (pdfDocRef.current) {
      renderAllPages(pdfDocRef.current);
    }
  }, [zoom, renderAllPages]);

  if (!pdfBytes) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>Open a PDF file to get started</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center gap-2 overflow-auto p-4"
    />
  );
}
