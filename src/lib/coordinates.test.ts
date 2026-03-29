import { describe, it, expect } from "vitest";
import { pdfToScreen, screenToPdf } from "./coordinates";

describe("pdfToScreen", () => {
  it("converts PDF points to screen pixels at 1x zoom", () => {
    const result = pdfToScreen({ x: 72, y: 72 }, { zoom: 1, pageOffset: 0 });
    expect(result.x).toBeCloseTo(72);
    expect(result.y).toBeCloseTo(72);
  });

  it("scales by zoom factor", () => {
    const result = pdfToScreen({ x: 100, y: 200 }, { zoom: 2, pageOffset: 0 });
    expect(result.x).toBeCloseTo(200);
    expect(result.y).toBeCloseTo(400);
  });

  it("adds page offset to y coordinate", () => {
    const result = pdfToScreen({ x: 50, y: 50 }, { zoom: 1, pageOffset: 792 });
    expect(result.x).toBeCloseTo(50);
    expect(result.y).toBeCloseTo(842);
  });

  it("handles zoom and page offset together", () => {
    const result = pdfToScreen({ x: 72, y: 36 }, { zoom: 1.5, pageOffset: 600 });
    expect(result.x).toBeCloseTo(108);
    expect(result.y).toBeCloseTo(654);
  });

  it("handles zero coordinates", () => {
    const result = pdfToScreen({ x: 0, y: 0 }, { zoom: 1, pageOffset: 0 });
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it("handles negative coordinates", () => {
    const result = pdfToScreen({ x: -10, y: -20 }, { zoom: 2, pageOffset: 100 });
    expect(result.x).toBeCloseTo(-20);
    expect(result.y).toBeCloseTo(60);
  });
});

describe("screenToPdf", () => {
  it("converts screen pixels to PDF points at 1x zoom", () => {
    const result = screenToPdf({ x: 72, y: 72 }, { zoom: 1, pageOffset: 0 });
    expect(result.x).toBeCloseTo(72);
    expect(result.y).toBeCloseTo(72);
  });

  it("divides by zoom factor", () => {
    const result = screenToPdf({ x: 200, y: 400 }, { zoom: 2, pageOffset: 0 });
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(200);
  });

  it("subtracts page offset from y coordinate", () => {
    const result = screenToPdf({ x: 50, y: 842 }, { zoom: 1, pageOffset: 792 });
    expect(result.x).toBeCloseTo(50);
    expect(result.y).toBeCloseTo(50);
  });

  it("handles zoom and page offset together", () => {
    const result = screenToPdf({ x: 108, y: 654 }, { zoom: 1.5, pageOffset: 600 });
    expect(result.x).toBeCloseTo(72);
    expect(result.y).toBeCloseTo(36);
  });
});

describe("round-trip conversion", () => {
  it("pdfToScreen → screenToPdf returns original point", () => {
    const original = { x: 123.456, y: 456.789 };
    const opts = { zoom: 1.5, pageOffset: 800 };
    const screen = pdfToScreen(original, opts);
    const roundTripped = screenToPdf(screen, opts);
    expect(roundTripped.x).toBeCloseTo(original.x);
    expect(roundTripped.y).toBeCloseTo(original.y);
  });

  it("screenToPdf → pdfToScreen returns original screen point", () => {
    const original = { x: 300, y: 500 };
    const opts = { zoom: 0.75, pageOffset: 300 };
    const pdf = screenToPdf(original, opts);
    const roundTripped = pdfToScreen(pdf, opts);
    expect(roundTripped.x).toBeCloseTo(original.x);
    expect(roundTripped.y).toBeCloseTo(original.y);
  });
});
