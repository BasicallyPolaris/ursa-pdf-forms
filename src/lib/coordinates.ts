export interface Point {
  x: number;
  y: number;
}

export const V_PADDING = 16;
export const PAGE_GAP = 8;
export const H_PADDING = 16;

export interface TransformOptions {
  zoom: number;
  pageX: number;
  pageY: number;
}

export function pdfToScreen(pdf: Point, options: TransformOptions): Point {
  const z = Number.isFinite(options.zoom) && options.zoom > 0 ? options.zoom : 1;
  return {
    x: pdf.x * z + options.pageX,
    y: pdf.y * z + options.pageY,
  };
}

export function screenToPdf(screen: Point, options: TransformOptions): Point {
  const z = Number.isFinite(options.zoom) && options.zoom > 0 ? options.zoom : 1;
  return {
    x: (screen.x - options.pageX) / z,
    y: (screen.y - options.pageY) / z,
  };
}
