export interface Point {
  x: number;
  y: number;
}

export const TOP_PADDING = 16;
export const PAGE_GAP = 8;

export interface TransformOptions {
  zoom: number;
  pageX: number;
  pageY: number;
}

export function pdfToScreen(pdf: Point, options: TransformOptions): Point {
  return {
    x: pdf.x * options.zoom + options.pageX,
    y: pdf.y * options.zoom + options.pageY,
  };
}

export function screenToPdf(screen: Point, options: TransformOptions): Point {
  return {
    x: (screen.x - options.pageX) / options.zoom,
    y: (screen.y - options.pageY) / options.zoom,
  };
}
