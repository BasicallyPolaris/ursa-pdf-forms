import { describe, it, expect } from "vitest";
import { resolveElementPosition } from "@/lib/page-coordinates";
import type { PageInfo } from "@/lib/pdf-loader";

const singlePage: PageInfo[] = [
  { width: 612, height: 792, pageNumber: 1 },
];

const multiPage: PageInfo[] = [
  { width: 612, height: 792, pageNumber: 1 },
  { width: 612, height: 792, pageNumber: 2 },
  { width: 612, height: 792, pageNumber: 3 },
];

const differentSizes: PageInfo[] = [
  { width: 612, height: 792, pageNumber: 1 },
  { width: 400, height: 600, pageNumber: 2 },
];

describe("resolveElementPosition", () => {
  describe("basic clamping", () => {
    it("clamps X to page width", () => {
      const result = resolveElementPosition(singlePage, 1, 700, 100);
      expect(result).toEqual({ pageNumber: 1, x: 612, y: 100 });
    });

    it("clamps X to 0", () => {
      const result = resolveElementPosition(singlePage, 1, -50, 100);
      expect(result).toEqual({ pageNumber: 1, x: 0, y: 100 });
    });

    it("clamps Y to page height", () => {
      const result = resolveElementPosition(singlePage, 1, 100, 900);
      expect(result).toEqual({ pageNumber: 1, x: 100, y: 792 });
    });

    it("clamps Y to 0", () => {
      const result = resolveElementPosition(singlePage, 1, 100, -10);
      expect(result).toEqual({ pageNumber: 1, x: 100, y: 0 });
    });

    it("allows Y = 0", () => {
      const result = resolveElementPosition(singlePage, 1, 100, 0);
      expect(result).toEqual({ pageNumber: 1, x: 100, y: 0 });
    });

    it("allows Y = page height", () => {
      const result = resolveElementPosition(singlePage, 1, 100, 792);
      expect(result).toEqual({ pageNumber: 1, x: 100, y: 792 });
    });

    it("allows X = 0", () => {
      const result = resolveElementPosition(singlePage, 1, 0, 100);
      expect(result).toEqual({ pageNumber: 1, x: 0, y: 100 });
    });

    it("allows X = page width", () => {
      const result = resolveElementPosition(singlePage, 1, 612, 100);
      expect(result).toEqual({ pageNumber: 1, x: 612, y: 100 });
    });

    it("passes through valid positions unchanged", () => {
      const result = resolveElementPosition(singlePage, 1, 100, 200);
      expect(result).toEqual({ pageNumber: 1, x: 100, y: 200 });
    });
  });

  describe("page transitions", () => {
    it("moves to next page when Y exceeds current page height", () => {
      const result = resolveElementPosition(multiPage, 1, 100, 850);
      expect(result).toEqual({ pageNumber: 2, x: 100, y: 58 });
    });

    it("moves to previous page when Y is negative", () => {
      const result = resolveElementPosition(multiPage, 2, 100, -50);
      expect(result).toEqual({ pageNumber: 1, x: 100, y: 742 });
    });

    it("skips multiple pages forward", () => {
      const result = resolveElementPosition(multiPage, 1, 100, 1600);
      expect(result).toEqual({ pageNumber: 3, x: 100, y: 16 });
    });

    it("skips multiple pages backward", () => {
      const result = resolveElementPosition(multiPage, 3, 100, -1600);
      expect(result).toEqual({ pageNumber: 1, x: 100, y: 0 });
    });

    it("clamps to last page if Y goes too far", () => {
      const result = resolveElementPosition(multiPage, 1, 100, 3000);
      expect(result).toEqual({ pageNumber: 3, x: 100, y: 792 });
    });

    it("clamps to first page if Y goes too far negative", () => {
      const result = resolveElementPosition(multiPage, 3, 100, -3000);
      expect(result).toEqual({ pageNumber: 1, x: 100, y: 0 });
    });

    it("does not transition when Y equals page height", () => {
      const result = resolveElementPosition(multiPage, 1, 100, 792);
      expect(result).toEqual({ pageNumber: 1, x: 100, y: 792 });
    });
  });

  describe("different page sizes", () => {
    it("clamps X to new page width after Y transition", () => {
      const result = resolveElementPosition(differentSizes, 1, 500, 850);
      expect(result).toEqual({ pageNumber: 2, x: 400, y: 58 });
    });

    it("transitions backward to a differently sized page", () => {
      const result = resolveElementPosition(differentSizes, 2, 100, -50);
      expect(result).toEqual({ pageNumber: 1, x: 100, y: 742 });
    });
  });

  describe("edge cases", () => {
    it("returns unchanged for empty pages", () => {
      const result = resolveElementPosition([], 1, 100, 200);
      expect(result).toEqual({ pageNumber: 1, x: 100, y: 200 });
    });

    it("returns unchanged for unknown page number", () => {
      const result = resolveElementPosition(multiPage, 99, 100, 200);
      expect(result).toEqual({ pageNumber: 99, x: 100, y: 200 });
    });

    it("handles single page without transition", () => {
      const result = resolveElementPosition(singlePage, 1, 100, 900);
      expect(result).toEqual({ pageNumber: 1, x: 100, y: 792 });
    });
  });
});
