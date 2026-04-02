export interface PageInfo {
  width: number;
  height: number;
  pageNumber: number;
}

export interface RenderResult {
  pageNumber: number;
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

export interface PdfDocument {
  pageInfos: PageInfo[];
  renderPage(pageNumber: number, scale: number): Promise<RenderResult>;
  destroy(): void;
}

let worker: Worker | null = null;
let reqCounter = 0;
const pending = new Map<number, { resolve: (r: RenderResult) => void; reject: (e: Error) => void }>();
let cachedBytes: Uint8Array | null = null;
let cachedDoc: PdfDocument | null = null;

function hasWorker(): boolean {
  return typeof Worker !== "undefined";
}

function ensureWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./pdf-worker.ts", import.meta.url), {
      type: "module",
      name: "pdf-render",
    });
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === "rendered") {
        const p = pending.get(msg.requestId);
        if (p) {
          pending.delete(msg.requestId);
          p.resolve({
            pageNumber: msg.pageNumber,
            bitmap: msg.bitmap,
            width: msg.width,
            height: msg.height,
          });
        } else {
          msg.bitmap.close();
        }
      } else if (msg.type === "renderError") {
        const p = pending.get(msg.requestId);
        if (p) {
          pending.delete(msg.requestId);
          p.reject(new Error(msg.error));
        }
      }
    };
  }
  return worker;
}

async function loadViaWorker(pdfBytes: Uint8Array): Promise<PdfDocument> {
  const w = ensureWorker();

  const pageInfos = await new Promise<PageInfo[]>((resolve, reject) => {
    const origHandler = w.onmessage;
    w.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === "loaded") {
        w.onmessage = origHandler;
        resolve(msg.pageInfos);
      } else if (msg.type === "loadError") {
        w.onmessage = origHandler;
        reject(new Error(msg.error));
      } else {
        origHandler?.call(w, e);
      }
    };
    const copy = pdfBytes.buffer.slice(0);
    w.postMessage({ type: "load", data: copy }, [copy]);
  });

  return {
    pageInfos,
    renderPage(pageNumber: number, scale: number): Promise<RenderResult> {
      const id = ++reqCounter;
      return new Promise<RenderResult>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        w.postMessage({ type: "renderPage", pageNumber, scale, requestId: id });
      });
    },
    destroy() {},
  };
}

async function loadFallback(pdfBytes: Uint8Array): Promise<PdfDocument> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    const proxy = await pdfjsLib.getDocument({
      data: pdfBytes.slice(),
      cMapUrl: "/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/standard_fonts/",
      useSystemFonts: true,
    }).promise;

    const pageInfos = await Promise.all(
      Array.from({ length: proxy.numPages }, (_, i) =>
        proxy.getPage(i + 1).then((p) => {
          const vp = p.getViewport({ scale: 1 });
          return { width: vp.width, height: vp.height, pageNumber: i + 1 };
        }),
      ),
    );

    return {
      pageInfos,
      async renderPage(pageNumber: number, scale: number): Promise<RenderResult> {
        const page = await proxy.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Cannot get 2d context");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await page.render({ canvasContext: ctx, viewport } as any).promise;
        const bitmap = await createImageBitmap(canvas);
        return { pageNumber, bitmap, width: viewport.width, height: viewport.height };
      },
      destroy() {
        proxy.destroy();
      },
    };
  } catch {
    return {
      pageInfos: [],
      async renderPage(): Promise<RenderResult> {
        throw new Error("PDF rendering not available");
      },
      destroy() {},
    };
  }
}

export async function loadPdfDocument(pdfBytes: Uint8Array): Promise<PdfDocument> {
  if (cachedBytes && cachedBytes === pdfBytes && cachedDoc) {
    return cachedDoc;
  }

  if (cachedDoc) {
    cachedDoc.destroy();
  }

  let doc: PdfDocument;
  if (hasWorker()) {
    doc = await loadViaWorker(pdfBytes);
  } else {
    doc = await loadFallback(pdfBytes);
  }

  cachedBytes = pdfBytes;
  cachedDoc = doc;
  return doc;
}
