import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).href;

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

let cachedBytes: Uint8Array | null = null;
let cachedDoc: PdfDocument | null = null;

async function loadDocument(pdfBytes: Uint8Array): Promise<PdfDocument> {
  const proxy = await pdfjsLib.getDocument({
    data: pdfBytes.slice(),
    cMapUrl: "/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/standard_fonts/",
    useSystemFonts: true,
  }).promise;

  const BATCH = 20;
  const pageInfos: PageInfo[] = [];
  for (let i = 0; i < proxy.numPages; i += BATCH) {
    const slice = Array.from(
      { length: Math.min(BATCH, proxy.numPages - i) },
      (_, j) => {
        const pageNum = i + j + 1;
        return proxy.getPage(pageNum).then((p) => {
          const vp = p.getViewport({ scale: 1 });
          return { width: vp.width, height: vp.height, pageNumber: pageNum };
        });
      },
    );
    pageInfos.push(...(await Promise.all(slice)));
  }

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
}

export async function loadPdfDocument(pdfBytes: Uint8Array): Promise<PdfDocument> {
  if (cachedBytes && cachedBytes === pdfBytes && cachedDoc) {
    return cachedDoc;
  }

  if (cachedDoc) {
    cachedDoc.destroy();
  }

  const doc = await loadDocument(pdfBytes);

  cachedBytes = pdfBytes;
  cachedDoc = doc;
  return doc;
}
