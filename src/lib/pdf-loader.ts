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

export interface CancellableRender {
  promise: Promise<RenderResult>;
  cancel: () => void;
}

export interface PdfDocument {
  proxy: pdfjsLib.PDFDocumentProxy;
  fingerprint: string;
  pageCount: number;
  getPage(pageNumber: number): Promise<pdfjsLib.PDFPageProxy>;
  getPageInfo(pageNumber: number): Promise<PageInfo>;
  getCachedPageInfo(pageNumber: number): PageInfo | null;
  getPageInfos(
    onBatch?: (accumulated: PageInfo[]) => void,
  ): Promise<PageInfo[]>;
  renderPage(pageNumber: number, scale: number): Promise<RenderResult>;
  startRender(pageNumber: number, scale: number): CancellableRender;
  destroy(): void;
}

let cachedBytes: Uint8Array | null = null;
let cachedDoc: PdfDocument | null = null;

async function loadDocument(pdfBytes: Uint8Array): Promise<PdfDocument> {
  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes.slice(),
    cMapUrl: "/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/standard_fonts/",
    useSystemFonts: true,
  });
  const proxy = await loadingTask.promise;
  const pagePromises = new Map<number, Promise<pdfjsLib.PDFPageProxy>>();
  const pageInfoCache = new Map<number, PageInfo>();
  const pageInfoPromises = new Map<number, Promise<PageInfo>>();
  let pageInfosPromise: Promise<PageInfo[]> | null = null;
  let destroyed = false;

  const getPage = (pageNumber: number) => {
    const existing = pagePromises.get(pageNumber);
    if (existing) return existing;
    const next = proxy.getPage(pageNumber);
    pagePromises.set(pageNumber, next);
    return next;
  };

  const getPageInfo = (pageNumber: number) => {
    const cached = pageInfoCache.get(pageNumber);
    if (cached) return Promise.resolve(cached);
    const existing = pageInfoPromises.get(pageNumber);
    if (existing) return existing;

    const next = getPage(pageNumber).then((page) => {
      if (destroyed) {
        throw new Error("PDF document has been destroyed");
      }
      const viewport = page.getViewport({ scale: 1 });
      const pageInfo = {
        width: viewport.width,
        height: viewport.height,
        pageNumber,
      };
      pageInfoCache.set(pageNumber, pageInfo);
      return pageInfo;
    });
    pageInfoPromises.set(pageNumber, next);
    return next;
  };

  const getPageInfos = (onBatch?: (accumulated: PageInfo[]) => void) => {
    if (pageInfosPromise && !onBatch) return pageInfosPromise;
    const promise = (async () => {
      const batchSize = 50;
      const pageInfos: PageInfo[] = [];
      for (let index = 0; index < proxy.numPages; index += batchSize) {
        const pageNumbers = Array.from(
          { length: Math.min(batchSize, proxy.numPages - index) },
          (_, batchIndex) => index + batchIndex + 1,
        );
        const batch = await Promise.all(
          pageNumbers.map((pageNumber) => getPageInfo(pageNumber)),
        );
        pageInfos.push(...batch);
        onBatch?.(pageInfos.slice());
      }
      return pageInfos;
    })();
    if (!pageInfosPromise) pageInfosPromise = promise;
    return promise;
  };

  const startRenderFn = (
    pageNumber: number,
    scale: number,
  ): CancellableRender => {
    let renderTask: ReturnType<pdfjsLib.PDFPageProxy["render"]> | null = null;
    let cancelled = false;

    const promise = getPage(pageNumber).then(async (page) => {
      if (cancelled) throw new Error("Render cancelled");
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("Cannot get 2d context");
      renderTask = page.render({ canvas, canvasContext: ctx, viewport });
      await renderTask.promise;
      const bitmap = await createImageBitmap(canvas);
      return {
        pageNumber,
        bitmap,
        width: canvas.width,
        height: canvas.height,
      };
    });

    return {
      promise,
      cancel() {
        cancelled = true;
        renderTask?.cancel();
      },
    };
  };

  return {
    proxy,
    fingerprint: proxy.fingerprints?.[0] ?? `${proxy.numPages}`,
    pageCount: proxy.numPages,
    getPage,
    getPageInfo,
    getCachedPageInfo(pageNumber: number) {
      return pageInfoCache.get(pageNumber) ?? null;
    },
    getPageInfos,
    startRender: startRenderFn,
    async renderPage(pageNumber: number, scale: number): Promise<RenderResult> {
      return startRenderFn(pageNumber, scale).promise;
    },
    destroy() {
      destroyed = true;
      loadingTask.destroy();
      proxy.destroy();
      pagePromises.clear();
      pageInfoCache.clear();
      pageInfoPromises.clear();
      pageInfosPromise = null;
    },
  };
}

export async function loadPdfDocument(
  pdfBytes: Uint8Array,
): Promise<PdfDocument> {
  if (cachedBytes === pdfBytes && cachedDoc) {
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
