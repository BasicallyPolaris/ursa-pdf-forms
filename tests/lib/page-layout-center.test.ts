import type { PageInfo } from "@/lib/pdf-loader";
import { getPageAtContentY } from "@/lib/page-layout";
import { describe, expect, it } from "vitest";

const twoPages: PageInfo[] = [
  { pageNumber: 1, width: 612, height: 792 },
  { pageNumber: 2, width: 612, height: 792 },
];

describe("getPageAtContentY", () => {
  it("returns the page whose bounds contain the anchor", () => {
    expect(getPageAtContentY(400, twoPages, 1, 800)).toBe(1);
    expect(getPageAtContentY(900, twoPages, 1, 800)).toBe(2);
  });

  it("does not pick a neighboring page by center distance when anchor is on another page", () => {
    const zoom = 1;
    const page1Bottom = 16 + 792;
    const page2Top = page1Bottom + 8;
    const anchorOnPage2 = page2Top + 100;
    expect(getPageAtContentY(anchorOnPage2, twoPages, zoom, 800)).toBe(2);
  });
});
