import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).href;

interface PageInfoResult {
  width: number;
  height: number;
  pageNumber: number;
}

interface LoadMsg {
  type: "load";
  data: ArrayBuffer;
}

interface RenderMsg {
  type: "renderPage";
  pageNumber: number;
  scale: number;
  requestId: number;
}

type InMsg = LoadMsg | RenderMsg;

let doc: pdfjsLib.PDFDocumentProxy | null = null;

self.onmessage = async (e: MessageEvent<InMsg>) => {
  const msg = e.data;

  if (msg.type === "load") {
    try {
      if (doc) {
        doc.destroy();
        doc = null;
      }

      doc = await pdfjsLib.getDocument({
        data: new Uint8Array(msg.data),
        cMapUrl: "/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/standard_fonts/",
        useSystemFonts: true,
      }).promise;

      const BATCH = 20;
      const infos: PageInfoResult[] = [];
      for (let i = 0; i < doc.numPages; i += BATCH) {
        const slice = Array.from(
          { length: Math.min(BATCH, doc.numPages - i) },
          (_, j) => {
            const pageNum = i + j + 1;
            return doc!.getPage(pageNum).then((p) => {
              const vp = p.getViewport({ scale: 1 });
              return { width: vp.width, height: vp.height, pageNumber: pageNum };
            });
          },
        );
        infos.push(...(await Promise.all(slice)));
      }

      self.postMessage({ type: "loaded", pageInfos: infos });
    } catch (err) {
      self.postMessage({
        type: "loadError",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (msg.type === "renderPage") {
    try {
      if (!doc) {
        self.postMessage({
          type: "renderError",
          requestId: msg.requestId,
          error: "No document loaded",
        });
        return;
      }

      const page = await doc.getPage(msg.pageNumber);
      const viewport = page.getViewport({ scale: msg.scale });
      const offscreen = new OffscreenCanvas(viewport.width, viewport.height);
      const ctx = offscreen.getContext("2d");
      if (!ctx) {
        self.postMessage({
          type: "renderError",
          requestId: msg.requestId,
          error: "Cannot get 2d context",
        });
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.render({ canvasContext: ctx, viewport } as any).promise;
      const bitmap = offscreen.transferToImageBitmap();

      self.postMessage(
        {
          type: "rendered",
          requestId: msg.requestId,
          pageNumber: msg.pageNumber,
          bitmap,
          width: viewport.width,
          height: viewport.height,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [bitmap] as any,
      );
    } catch (err) {
      self.postMessage({
        type: "renderError",
        requestId: msg.requestId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
};
