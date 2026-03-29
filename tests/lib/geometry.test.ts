import { describe, it, expect } from "vitest";
import { rectsOverlap, type Rect } from "@/lib/geometry";

describe("rectsOverlap", () => {
  it("returns true for overlapping rectangles", () => {
    const a: Rect = { x: 0, y: 0, width: 10, height: 10 };
    const b: Rect = { x: 5, y: 5, width: 10, height: 10 };
    expect(rectsOverlap(a, b)).toBe(true);
  });

  it("returns true for fully contained rectangle", () => {
    const a: Rect = { x: 0, y: 0, width: 20, height: 20 };
    const b: Rect = { x: 5, y: 5, width: 5, height: 5 };
    expect(rectsOverlap(a, b)).toBe(true);
  });

  it("returns true for identical rectangles", () => {
    const a: Rect = { x: 10, y: 10, width: 10, height: 10 };
    expect(rectsOverlap(a, a)).toBe(true);
  });

  it("returns false for non-overlapping rectangles", () => {
    const a: Rect = { x: 0, y: 0, width: 10, height: 10 };
    const b: Rect = { x: 20, y: 20, width: 10, height: 10 };
    expect(rectsOverlap(a, b)).toBe(false);
  });

  it("returns false for horizontally adjacent rectangles (touching edges)", () => {
    const a: Rect = { x: 0, y: 0, width: 10, height: 10 };
    const b: Rect = { x: 10, y: 0, width: 10, height: 10 };
    expect(rectsOverlap(a, b)).toBe(false);
  });

  it("returns false for vertically adjacent rectangles (touching edges)", () => {
    const a: Rect = { x: 0, y: 0, width: 10, height: 10 };
    const b: Rect = { x: 0, y: 10, width: 10, height: 10 };
    expect(rectsOverlap(a, b)).toBe(false);
  });

  it("returns true for partial horizontal overlap", () => {
    const a: Rect = { x: 0, y: 0, width: 10, height: 10 };
    const b: Rect = { x: 8, y: 0, width: 10, height: 10 };
    expect(rectsOverlap(a, b)).toBe(true);
  });

  it("returns true for partial vertical overlap", () => {
    const a: Rect = { x: 0, y: 0, width: 10, height: 10 };
    const b: Rect = { x: 0, y: 8, width: 10, height: 10 };
    expect(rectsOverlap(a, b)).toBe(true);
  });

  it("handles negative coordinates", () => {
    const a: Rect = { x: -10, y: -10, width: 15, height: 15 };
    const b: Rect = { x: -5, y: -5, width: 10, height: 10 };
    expect(rectsOverlap(a, b)).toBe(true);
  });
});
