export interface Point {
  x: number;
  y: number;
}

export interface TransformOptions {
  zoom: number;
  pageOffset: number;
}

export function pdfToScreen(pdf: Point, options: TransformOptions): Point {
  return {
    x: pdf.x * options.zoom,
    y: pdf.y * options.zoom + options.pageOffset,
  };
}

export function screenToPdf(screen: Point, options: TransformOptions): Point {
  return {
    x: screen.x / options.zoom,
    y: (screen.y - options.pageOffset) / options.zoom,
  };
}
