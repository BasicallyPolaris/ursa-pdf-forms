import { describe, it, expect } from "vitest";
import {
  snapToGrid,
  snapToPageEdge,
  snapPosition,
  snapResizeBounds,
  type SnapContext,
} from "@/lib/snap-engine";

describe("snapToGrid", () => {
  it("rounds to nearest grid unit", () => {
    expect(snapToGrid(7, 10)).toBe(10);
    expect(snapToGrid(3, 10)).toBe(0);
    expect(snapToGrid(15, 10)).toBe(20);
  });

  it("returns same value if already on grid", () => {
    expect(snapToGrid(10, 10)).toBe(10);
    expect(snapToGrid(0, 10)).toBe(0);
  });

  it("handles custom grid sizes", () => {
    expect(snapToGrid(7, 5)).toBe(5);
    expect(snapToGrid(8, 5)).toBe(10);
    expect(snapToGrid(12, 20)).toBe(20);
  });

  it("returns original position if gridSize is 0", () => {
    expect(snapToGrid(7, 0)).toBe(7);
  });
});

describe("snapToPageEdge", () => {
  it("snaps to left edge when within threshold", () => {
    const result = snapToPageEdge(3, 100, 612, 5, "vertical");
    expect(result.snapped).toBe(0);
  });

  it("snaps to right edge when within threshold", () => {
    const result = snapToPageEdge(508, 100, 612, 5, "vertical");
    expect(result.snapped).toBe(512);
  });

  it("does not snap when outside threshold", () => {
    const result = snapToPageEdge(10, 100, 612, 5, "vertical");
    expect(result.snapped).toBe(10);
  });

  it("does not snap at exact threshold boundary", () => {
    const result = snapToPageEdge(5, 100, 612, 5, "vertical");
    expect(result.snapped).toBe(0);
  });
});

function makeContext(overrides: Partial<SnapContext> = {}): SnapContext {
  return {
    gridSize: 10,
    snapThreshold: 5,
    pageWidth: 612,
    pageHeight: 792,
    otherElements: [],
    rulerGuides: [],
    snapToGrid: true,
    snapToPageEdges: true,
    snapToElements: true,
    snapToGuides: true,
    ...overrides,
  };
}

describe("snapPosition", () => {
  it("snaps to grid when grid enabled", () => {
    const result = snapPosition(7, 13, 100, 30, makeContext());
    expect(result.x).toBe(10);
    expect(result.y).toBe(10);
    expect(result.guides.length).toBeGreaterThan(0);
  });

  it("does not snap to grid when disabled", () => {
    const result = snapPosition(7, 13, 100, 30, makeContext({ snapToGrid: false }));
    expect(result.x).toBe(7);
    expect(result.y).toBe(13);
    expect(result.guides).toHaveLength(0);
  });

  it("snaps to page edges", () => {
    const result = snapPosition(2, 760, 100, 30, makeContext({ snapToGrid: false }));
    expect(result.x).toBe(0);
    expect(result.y).toBe(762);
  });

  it("does not clamp elements dragged far outside page", () => {
    const result = snapPosition(-50, 850, 100, 30, makeContext({ snapToGrid: false }));
    expect(result.x).toBe(-50);
    expect(result.y).toBe(850);
  });

  it("snaps to element edges", () => {
    const result = snapPosition(97, 50, 100, 30, makeContext({
      snapToGrid: false,
      snapToPageEdges: false,
      otherElements: [{ x: 100, y: 50, width: 80, height: 30 }],
    }));
    expect(result.x).toBe(100);
    const hasVerticalGuide = result.guides.some((g) => g.orientation === "vertical" && g.type === "element");
    expect(hasVerticalGuide).toBe(true);
  });

  it("snaps to element centers", () => {
    const other = { x: 100, y: 50, width: 80, height: 30 };
    const otherCenterX = 140;
    const elementWidth = 60;
    const proposedX = otherCenterX - elementWidth / 2 + 2;

    const result = snapPosition(proposedX, 50, elementWidth, 30, makeContext({
      snapToGrid: false,
      snapToPageEdges: false,
      otherElements: [other],
    }));
    expect(result.x).toBe(otherCenterX - elementWidth / 2);
  });

  it("snaps to ruler guides", () => {
    const result = snapPosition(200, 298, 100, 30, makeContext({
      snapToGrid: false,
      snapToPageEdges: false,
      snapToElements: false,
      rulerGuides: [{ orientation: "horizontal", position: 300 }],
    }));
    expect(result.y).toBe(300);
    const hasHorizontalGuide = result.guides.some((g) => g.orientation === "horizontal" && g.type === "ruler");
    expect(hasHorizontalGuide).toBe(true);
  });

  it("snaps to vertical ruler guides", () => {
    const result = snapPosition(198, 50, 100, 30, makeContext({
      snapToGrid: false,
      snapToPageEdges: false,
      snapToElements: false,
      rulerGuides: [{ orientation: "vertical", position: 200 }],
    }));
    expect(result.x).toBe(200);
  });

  it("does not snap when no targets within threshold", () => {
    const result = snapPosition(200, 200, 100, 30, makeContext({
      snapToGrid: false,
      snapToPageEdges: false,
      otherElements: [{ x: 500, y: 500, width: 80, height: 30 }],
    }));
    expect(result.x).toBe(200);
    expect(result.y).toBe(200);
    expect(result.guides).toHaveLength(0);
  });

  it("returns no guides when no snapping occurs", () => {
    const result = snapPosition(50, 50, 100, 30, makeContext({
      snapToGrid: false,
      snapToPageEdges: false,
    }));
    expect(result.guides).toHaveLength(0);
  });

  it("composes grid and element snapping, nearest wins", () => {
    const result = snapPosition(47, 50, 100, 30, makeContext({
      snapToGrid: true,
      snapToPageEdges: false,
      otherElements: [{ x: 46, y: 50, width: 80, height: 30 }],
    }));
    expect(result.x).toBe(46);
    expect(result.guides.some((g) => g.type === "element")).toBe(true);
  });

  it("handles multiple simultaneous alignments", () => {
    const result = snapPosition(97, 47, 100, 30, makeContext({
      snapToGrid: false,
      snapToPageEdges: false,
      otherElements: [{ x: 100, y: 50, width: 80, height: 30 }],
    }));
    expect(result.x).toBe(100);
    expect(result.y).toBe(50);
    expect(result.guides.length).toBeGreaterThanOrEqual(2);
  });

  it("shows guides for all elements at the same alignment position", () => {
    const result = snapPosition(97, 50, 100, 30, makeContext({
      snapToGrid: false,
      snapToPageEdges: false,
      otherElements: [
        { x: 100, y: 50, width: 80, height: 30, id: "el-a" },
        { x: 100, y: 200, width: 60, height: 20, id: "el-b" },
      ],
    }));
    expect(result.x).toBe(100);
    const elementGuides = result.guides.filter(
      (g) => g.orientation === "vertical" && g.type === "element",
    );
    const guideIds = elementGuides.map((g) => g.elementId).sort();
    expect(guideIds).toContain("el-a");
    expect(guideIds).toContain("el-b");
  });

  it("excludes nearby-but-not-aligned guides", () => {
    const result = snapPosition(97, 50, 100, 30, makeContext({
      snapToGrid: false,
      snapToPageEdges: false,
      otherElements: [{ x: 100, y: 50, width: 80, height: 30 }],
    }));
    expect(result.x).toBe(100);
    const rightEdge = result.x + 100;
    const hasGuideNearRightEdge = result.guides.some(
      (g) => g.orientation === "vertical" && Math.abs(g.position - rightEdge) > 0.1 && Math.abs(g.position - rightEdge) <= 5,
    );
    expect(hasGuideNearRightEdge).toBe(false);
  });

  it("includes concurrent zero-distance alignments", () => {
    const result = snapPosition(97, 50, 80, 30, makeContext({
      snapToGrid: false,
      snapToPageEdges: false,
      otherElements: [{ x: 100, y: 50, width: 80, height: 30, id: "other" }],
    }));
    expect(result.x).toBe(100);
    const vGuides = result.guides.filter(
      (g) => g.orientation === "vertical" && g.type === "element",
    );
    expect(vGuides.length).toBeGreaterThanOrEqual(2);
  });

  it("prefers snap closer to previous position when tied", () => {
    const ctx = makeContext({
      snapToGrid: false,
      snapToPageEdges: false,
      otherElements: [
        { x: 100, y: 50, width: 80, height: 30, id: "el-a" },
        { x: 101, y: 50, width: 80, height: 30, id: "el-b" },
      ],
    });
    const result = snapPosition(98, 50, 100, 30, ctx, {
      previousSnappedX: 101,
      previousSnappedY: 50,
    });
    expect(result.x).toBe(101);
  });

  it("does not apply tie-breaking when clear winner exists", () => {
    const ctx = makeContext({
      snapToGrid: false,
      snapToPageEdges: false,
      otherElements: [
        { x: 50, y: 50, width: 80, height: 30, id: "el-a" },
        { x: 100, y: 50, width: 80, height: 30, id: "el-b" },
      ],
    });
    const result = snapPosition(98, 50, 100, 30, ctx, {
      previousSnappedX: 50,
      previousSnappedY: 50,
    });
    expect(result.x).toBe(100);
  });

  it("only shows grid guides when edges are exactly on grid", () => {
    const result = snapPosition(8, 12, 100, 30, makeContext({
      snapToPageEdges: false,
      snapToElements: false,
      snapToGuides: false,
    }));
    expect(result.x).toBe(10);
    expect(result.y).toBe(10);
    const gridGuides = result.guides.filter((g) => g.type === "grid");
    expect(gridGuides.length).toBeGreaterThan(0);
    for (const g of gridGuides) {
      expect(g.position % 10).toBe(0);
    }
  });

  it("snapResizeBounds threads previous snap for hysteresis", () => {
    const ctx = makeContext({
      snapToGrid: false,
      snapToPageEdges: false,
      otherElements: [
        { x: 100, y: 50, width: 80, height: 30, id: "el-a" },
        { x: 101, y: 50, width: 80, height: 30, id: "el-b" },
      ],
    });
    const result = snapResizeBounds(48, 50, 50, 30, "right", ctx, {
      previousSnappedX: 51,
      previousSnappedY: 50,
    });
    expect(result.x + result.width).toBe(101);
  });
});
