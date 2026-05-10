import { describe, it, expect } from "vitest";
import {
  editorRectToPdfLowerLeft,
  intersectMediaAndCrop,
  pdfWidgetRectToEditorRaw,
} from "@/lib/pdf-page-view";

describe("intersectMediaAndCrop", () => {
  it("returns media when crop matches media", () => {
    const media = { x: 0, y: 0, width: 612, height: 792 };
    const q = intersectMediaAndCrop(media, media);
    expect(q).toEqual({ x0: 0, y0: 0, x1: 612, y1: 792 });
  });

  it("returns intersection when crop is smaller than media", () => {
    const media = { x: 0, y: 0, width: 612, height: 792 };
    const crop = { x: 0, y: 0, width: 612, height: 692 };
    const q = intersectMediaAndCrop(media, crop);
    expect(q).toEqual({ x0: 0, y0: 0, x1: 612, y1: 692 });
  });

  it("returns intersection for offset overlapping boxes", () => {
    const media = { x: 0, y: 0, width: 100, height: 100 };
    const crop = { x: 50, y: 40, width: 100, height: 100 };
    const q = intersectMediaAndCrop(media, crop);
    expect(q).toEqual({ x0: 50, y0: 40, x1: 100, y1: 100 });
  });
});

describe("editorRectToPdfLowerLeft / pdfWidgetRectToEditorRaw", () => {
  it("round-trips for a non-origin view", () => {
    const view = { x0: 10, y0: 20, x1: 310, y1: 420 };
    const el = { x: 72, y: 100, width: 200, height: 24 };
    const ll = editorRectToPdfLowerLeft(el, view);
    expect(ll.x).toBeCloseTo(82);
    expect(ll.y).toBeCloseTo(296);
    const rect = {
      x1: ll.x,
      y1: ll.y,
      x2: ll.x + el.width,
      y2: ll.y + el.height,
    };
    const back = pdfWidgetRectToEditorRaw(rect, view);
    expect(back.rawX).toBeCloseTo(el.x);
    expect(back.rawY).toBeCloseTo(el.y);
    expect(back.rawWidth).toBeCloseTo(el.width);
    expect(back.rawHeight).toBeCloseTo(el.height);
  });
});
