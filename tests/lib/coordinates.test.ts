import { describe, it, expect } from "vitest";
import { pdfToScreen, screenToPdf } from "@/lib/coordinates";

describe("pdfToScreen", () => {
  it("converts PDF points to screen pixels at 1x zoom", () => {
    const result = pdfToScreen({ x: 72, y: 72 }, { zoom: 1, pageX: 0, pageY: 0 });
    expect(result.x).toBeCloseTo(72);
    expect(result.y).toBeCloseTo(72);
  });

  it("scales by zoom factor", () => {
    const result = pdfToScreen({ x: 100, y: 200 }, { zoom: 2, pageX: 0, pageY: 0 });
    expect(result.x).toBeCloseTo(200);
    expect(result.y).toBeCloseTo(400);
  });

  it("adds page offset to y coordinate", () => {
    const result = pdfToScreen({ x: 50, y: 50 }, { zoom: 1, pageX: 0, pageY: 792 });
    expect(result.x).toBeCloseTo(50);
    expect(result.y).toBeCloseTo(842);
  });

  it("adds page offset to x coordinate", () => {
    const result = pdfToScreen({ x: 50, y: 50 }, { zoom: 1, pageX: 100, pageY: 0 });
    expect(result.x).toBeCloseTo(150);
    expect(result.y).toBeCloseTo(50);
  });

  it("handles zoom and page offset together", () => {
    const result = pdfToScreen({ x: 72, y: 36 }, { zoom: 1.5, pageX: 50, pageY: 600 });
    expect(result.x).toBeCloseTo(158);
    expect(result.y).toBeCloseTo(654);
  });

  it("handles zero coordinates", () => {
    const result = pdfToScreen({ x: 0, y: 0 }, { zoom: 1, pageX: 0, pageY: 0 });
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it("handles negative coordinates", () => {
    const result = pdfToScreen({ x: -10, y: -20 }, { zoom: 2, pageX: 100, pageY: 100 });
    expect(result.x).toBeCloseTo(80);
    expect(result.y).toBeCloseTo(60);
  });

  it("falls back to zoom=1 when zoom is 0", () => {
    const result = pdfToScreen({ x: 100, y: 200 }, { zoom: 0, pageX: 0, pageY: 0 });
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(200);
  });

  it("falls back to zoom=1 when zoom is negative", () => {
    const result = pdfToScreen({ x: 100, y: 200 }, { zoom: -2, pageX: 0, pageY: 0 });
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(200);
  });

  it("falls back to zoom=1 when zoom is NaN", () => {
    const result = pdfToScreen({ x: 100, y: 200 }, { zoom: NaN, pageX: 0, pageY: 0 });
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(200);
  });

  it("falls back to zoom=1 when zoom is Infinity", () => {
    const result = pdfToScreen({ x: 100, y: 200 }, { zoom: Infinity, pageX: 0, pageY: 0 });
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(200);
  });
});

describe("screenToPdf", () => {
  it("converts screen pixels to PDF points at 1x zoom", () => {
    const result = screenToPdf({ x: 72, y: 72 }, { zoom: 1, pageX: 0, pageY: 0 });
    expect(result.x).toBeCloseTo(72);
    expect(result.y).toBeCloseTo(72);
  });

  it("divides by zoom factor", () => {
    const result = screenToPdf({ x: 200, y: 400 }, { zoom: 2, pageX: 0, pageY: 0 });
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(200);
  });

  it("subtracts page offset from y coordinate", () => {
    const result = screenToPdf({ x: 50, y: 842 }, { zoom: 1, pageX: 0, pageY: 792 });
    expect(result.x).toBeCloseTo(50);
    expect(result.y).toBeCloseTo(50);
  });

  it("subtracts page offset from x coordinate", () => {
    const result = screenToPdf({ x: 150, y: 50 }, { zoom: 1, pageX: 100, pageY: 0 });
    expect(result.x).toBeCloseTo(50);
    expect(result.y).toBeCloseTo(50);
  });

  it("handles zoom and page offset together", () => {
    const result = screenToPdf({ x: 158, y: 654 }, { zoom: 1.5, pageX: 50, pageY: 600 });
    expect(result.x).toBeCloseTo(72);
    expect(result.y).toBeCloseTo(36);
  });

  it("falls back to zoom=1 when zoom is 0", () => {
    const result = screenToPdf({ x: 100, y: 200 }, { zoom: 0, pageX: 0, pageY: 0 });
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(200);
  });

  it("falls back to zoom=1 when zoom is NaN", () => {
    const result = screenToPdf({ x: 100, y: 200 }, { zoom: NaN, pageX: 0, pageY: 0 });
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(200);
  });

  it("falls back to zoom=1 when zoom is Infinity", () => {
    const result = screenToPdf({ x: 100, y: 200 }, { zoom: Infinity, pageX: 0, pageY: 0 });
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(200);
  });
});

describe("round-trip conversion", () => {
  it("pdfToScreen → screenToPdf returns original point", () => {
    const original = { x: 123.456, y: 456.789 };
    const opts = { zoom: 1.5, pageX: 200, pageY: 800 };
    const screen = pdfToScreen(original, opts);
    const roundTripped = screenToPdf(screen, opts);
    expect(roundTripped.x).toBeCloseTo(original.x);
    expect(roundTripped.y).toBeCloseTo(original.y);
  });

  it("screenToPdf → pdfToScreen returns original screen point", () => {
    const original = { x: 300, y: 500 };
    const opts = { zoom: 0.75, pageX: 50, pageY: 300 };
    const pdf = screenToPdf(original, opts);
    const roundTripped = pdfToScreen(pdf, opts);
    expect(roundTripped.x).toBeCloseTo(original.x);
    expect(roundTripped.y).toBeCloseTo(original.y);
  });
});
