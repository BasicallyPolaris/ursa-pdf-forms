import type { PDFPage } from "pdf-lib";

export interface PdfViewQuad {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function boxToQuad(box: {
  x: number;
  y: number;
  width: number;
  height: number;
}): PdfViewQuad {
  return {
    x0: box.x,
    y0: box.y,
    x1: box.x + box.width,
    y1: box.y + box.height,
  };
}

const EPS = 1e-5;

function quadsEqual(a: PdfViewQuad, b: PdfViewQuad): boolean {
  return (
    Math.abs(a.x0 - b.x0) < EPS &&
    Math.abs(a.y0 - b.y0) < EPS &&
    Math.abs(a.x1 - b.x1) < EPS &&
    Math.abs(a.y1 - b.y1) < EPS
  );
}

export function intersectMediaAndCrop(
  media: { x: number; y: number; width: number; height: number },
  crop: { x: number; y: number; width: number; height: number },
): PdfViewQuad {
  const M = boxToQuad(media);
  const C = boxToQuad(crop);
  if (quadsEqual(M, C)) return M;
  const ix0 = Math.max(M.x0, C.x0);
  const iy0 = Math.max(M.y0, C.y0);
  const ix1 = Math.min(M.x1, C.x1);
  const iy1 = Math.min(M.y1, C.y1);
  if (ix1 - ix0 > EPS && iy1 - iy0 > EPS) {
    return { x0: ix0, y0: iy0, x1: ix1, y1: iy1 };
  }
  return M;
}

export function getPageViewQuadForPdfLibPage(page: PDFPage): PdfViewQuad {
  return intersectMediaAndCrop(page.getMediaBox(), page.getCropBox());
}

export function editorRectToPdfLowerLeft(
  el: { x: number; y: number; width: number; height: number },
  view: PdfViewQuad,
): { x: number; y: number } {
  return {
    x: view.x0 + el.x,
    y: view.y1 - el.y - el.height,
  };
}

export function pdfWidgetRectToEditorRaw(
  rect: { x1: number; y1: number; x2: number; y2: number },
  view: PdfViewQuad,
): { rawX: number; rawY: number; rawWidth: number; rawHeight: number } {
  return {
    rawX: rect.x1 - view.x0,
    rawY: view.y1 - rect.y2,
    rawWidth: rect.x2 - rect.x1,
    rawHeight: rect.y2 - rect.y1,
  };
}
