import * as pdfjsLib from "pdfjs-dist";

export interface PageInfo {
  width: number;
  height: number;
  pageNumber: number;
}

export interface PdfLoadResult {
  proxy: pdfjsLib.PDFDocumentProxy;
  pageInfos: PageInfo[];
}

let cache: { bytes: Uint8Array; result: PdfLoadResult } | null = null;

export async function loadPdfDocument(
  pdfBytes: Uint8Array,
): Promise<PdfLoadResult> {
  if (cache && cache.bytes === pdfBytes) {
    return cache.result;
  }

  const proxy = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;

  const pageInfos: PageInfo[] = [];
  for (let i = 1; i <= proxy.numPages; i++) {
    const page = await proxy.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    pageInfos.push({ width: vp.width, height: vp.height, pageNumber: i });
  }

  const result: PdfLoadResult = { proxy, pageInfos };
  cache = { bytes: pdfBytes, result };
  return result;
}


