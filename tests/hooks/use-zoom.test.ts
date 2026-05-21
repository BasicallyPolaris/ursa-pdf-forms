import { describe, expect, it } from "vitest";
import { clampZoom, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "@/hooks/use-zoom";

describe("clampZoom", () => {
  it("clamps to ZOOM_MIN", () => {
    expect(clampZoom(ZOOM_MIN - ZOOM_STEP)).toBe(ZOOM_MIN);
    expect(clampZoom(0)).toBe(ZOOM_MIN);
  });

  it("clamps to ZOOM_MAX", () => {
    expect(clampZoom(ZOOM_MAX + ZOOM_STEP)).toBe(ZOOM_MAX);
  });

  it("passes through values inside the range", () => {
    expect(clampZoom(1)).toBe(1);
    expect(clampZoom(ZOOM_MIN)).toBe(ZOOM_MIN);
  });
});
