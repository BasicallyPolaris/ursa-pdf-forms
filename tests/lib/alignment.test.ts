import { describe, it, expect } from "vitest";
import {
  alignLeft,
  alignRight,
  alignTop,
  alignBottom,
  alignCenterH,
  alignCenterV,
  distributeH,
  distributeV,
  centerOnPage,
} from "@/lib/alignment";

const elements = [
  { id: "a", x: 10, y: 20, width: 100, height: 30 },
  { id: "b", x: 150, y: 80, width: 80, height: 25 },
  { id: "c", x: 50, y: 50, width: 120, height: 40 },
];

describe("alignLeft", () => {
  it("aligns all elements to leftmost edge", () => {
    const ids = new Set(["a", "b", "c"]);
    const result = alignLeft(elements, ids);
    expect(result).toHaveLength(3);
    expect(result.find((r) => r.id === "a")!.x).toBe(10);
    expect(result.find((r) => r.id === "b")!.x).toBe(10);
    expect(result.find((r) => r.id === "c")!.x).toBe(10);
  });

  it("preserves y positions", () => {
    const ids = new Set(["a", "b"]);
    const result = alignLeft(elements, ids);
    expect(result.find((r) => r.id === "a")!.y).toBe(20);
    expect(result.find((r) => r.id === "b")!.y).toBe(80);
  });

  it("returns empty for single element", () => {
    const result = alignLeft(elements, new Set(["a"]));
    expect(result).toHaveLength(0);
  });
});

describe("alignRight", () => {
  it("aligns all elements to rightmost right edge", () => {
    const ids = new Set(["a", "b", "c"]);
    const result = alignRight(elements, ids);
    expect(result).toHaveLength(3);
    expect(result.find((r) => r.id === "a")!.x).toBe(130);
    expect(result.find((r) => r.id === "b")!.x).toBe(150);
    expect(result.find((r) => r.id === "c")!.x).toBe(110);
  });
});

describe("alignTop", () => {
  it("aligns all elements to topmost edge", () => {
    const ids = new Set(["a", "b", "c"]);
    const result = alignTop(elements, ids);
    expect(result).toHaveLength(3);
    for (const r of result) {
      expect(r.y).toBe(20);
    }
  });
});

describe("alignBottom", () => {
  it("aligns all elements to bottommost bottom edge", () => {
    const ids = new Set(["a", "b", "c"]);
    const result = alignBottom(elements, ids);
    expect(result).toHaveLength(3);
    expect(result.find((r) => r.id === "a")!.y).toBe(75);
    expect(result.find((r) => r.id === "b")!.y).toBe(80);
    expect(result.find((r) => r.id === "c")!.y).toBe(65);
  });
});

describe("alignCenterH", () => {
  it("aligns all elements to average center X", () => {
    const ids = new Set(["a", "b", "c"]);
    const result = alignCenterH(elements, ids);
    expect(result).toHaveLength(3);
    const centers = result.map((r) => {
      const el = elements.find((e) => e.id === r.id)!;
      return r.x + el.width / 2;
    });
    expect(centers[0]).toBeCloseTo(centers[1]);
    expect(centers[1]).toBeCloseTo(centers[2]);
  });
});

describe("alignCenterV", () => {
  it("aligns all elements to average center Y", () => {
    const ids = new Set(["a", "b", "c"]);
    const result = alignCenterV(elements, ids);
    expect(result).toHaveLength(3);
    const centers = result.map((r) => {
      const el = elements.find((e) => e.id === r.id)!;
      return r.y + el.height / 2;
    });
    expect(centers[0]).toBeCloseTo(centers[1]);
    expect(centers[1]).toBeCloseTo(centers[2]);
  });
});

describe("distributeH", () => {
  it("returns empty for fewer than 3 elements", () => {
    const result = distributeH(elements, new Set(["a", "b"]));
    expect(result).toHaveLength(0);
  });

  it("distributes elements with equal spacing", () => {
    const els = [
      { id: "a", x: 0, y: 0, width: 20, height: 20 },
      { id: "b", x: 100, y: 0, width: 20, height: 20 },
      { id: "c", x: 200, y: 0, width: 20, height: 20 },
    ];
    const result = distributeH(els, new Set(["a", "b", "c"]));
    expect(result).toHaveLength(3);
    expect(result.find((r) => r.id === "a")!.x).toBe(0);
    expect(result.find((r) => r.id === "c")!.x).toBe(200);
    expect(result.find((r) => r.id === "b")!.x).toBe(100);
  });

  it("preserves leftmost and rightmost positions", () => {
    const els = [
      { id: "a", x: 10, y: 0, width: 20, height: 20 },
      { id: "b", x: 200, y: 0, width: 30, height: 20 },
      { id: "c", x: 350, y: 0, width: 25, height: 20 },
    ];
    const result = distributeH(els, new Set(["a", "b", "c"]));
    expect(result.find((r) => r.id === "a")!.x).toBe(10);
    expect(result.find((r) => r.id === "c")!.x).toBe(350);
  });
});

describe("distributeV", () => {
  it("returns empty for fewer than 3 elements", () => {
    const result = distributeV(elements, new Set(["a", "b"]));
    expect(result).toHaveLength(0);
  });

  it("distributes elements with equal vertical spacing", () => {
    const els = [
      { id: "a", x: 0, y: 0, width: 20, height: 20 },
      { id: "b", x: 0, y: 100, width: 20, height: 20 },
      { id: "c", x: 0, y: 200, width: 20, height: 20 },
    ];
    const result = distributeV(els, new Set(["a", "b", "c"]));
    expect(result).toHaveLength(3);
    expect(result.find((r) => r.id === "b")!.y).toBe(100);
  });
});

describe("centerOnPage", () => {
  it("centers a single element on the page", () => {
    const els = [{ id: "a", x: 10, y: 20, width: 100, height: 30 }];
    const result = centerOnPage(els, new Set(["a"]), 612, 792);
    expect(result).toHaveLength(1);
    expect(result[0].x).toBe((612 - 100) / 2);
    expect(result[0].y).toBe((792 - 30) / 2);
  });

  it("centers a group of elements on the page", () => {
    const result = centerOnPage(elements, new Set(["a", "b", "c"]), 612, 792);
    expect(result).toHaveLength(3);
    const xs = result.map((r) => r.x);
    const groupLeft = Math.min(...xs);
    const groupRight = Math.max(...xs.map((x, i) => x + elements.find((e) => e.id === result[i].id)!.width));
    const groupCenterX = (groupLeft + groupRight) / 2;
    expect(groupCenterX).toBeCloseTo(306);
  });

  it("returns empty for no selection", () => {
    const result = centerOnPage(elements, new Set(), 612, 792);
    expect(result).toHaveLength(0);
  });
});
