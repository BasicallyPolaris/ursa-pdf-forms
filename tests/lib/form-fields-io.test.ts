import { describe, it, expect } from "vitest";
import {
  assignFreshFieldIds,
  parseFormFieldsJson,
  prepareImportedFields,
  remapImportedFields,
  serializeFormFields,
} from "@/lib/form-fields-io";
import {
  createCheckbox,
  createTextField,
  isTextField,
} from "@/lib/form-element-model";
import type { PageInfo } from "@/lib/pdf-loader";

const pagesA: PageInfo[] = [
  { pageNumber: 1, width: 612, height: 792 },
  { pageNumber: 2, width: 612, height: 792 },
];

const pagesB: PageInfo[] = [
  { pageNumber: 1, width: 306, height: 396 },
  { pageNumber: 2, width: 306, height: 396 },
];

describe("form-fields-io", () => {
  it("round-trips fields and page metadata", () => {
    const field = createTextField({ x: 100, y: 200, pageNumber: 1, name: "name1" });
    const json = serializeFormFields([field], pagesA);
    const doc = parseFormFieldsJson(json);
    expect(doc.pages).toEqual([
      { width: 612, height: 792 },
      { width: 612, height: 792 },
    ]);
    expect(doc.fields).toHaveLength(1);
    expect(isTextField(doc.fields[0]) && doc.fields[0].name).toBe("name1");
    expect(doc.fields[0].x).toBe(100);
  });

  it("scales coordinates when target page size differs", () => {
    const field = createTextField({
      x: 100,
      y: 200,
      pageNumber: 1,
      width: 50,
      height: 20,
    });
    const remapped = remapImportedFields(
      [field],
      [{ width: 612, height: 792 }],
      pagesB,
    );
    expect(remapped[0].x).toBeCloseTo(50, 1);
    expect(remapped[0].y).toBeCloseTo(100, 1);
    expect(remapped[0].width).toBeCloseTo(25, 1);
    expect(remapped[0].height).toBe(20);
  });

  it("scales height for multiline text and non-input fields", () => {
    const multiline = createTextField({
      x: 100,
      y: 200,
      pageNumber: 1,
      width: 50,
      height: 80,
      multiline: true,
    });
    const checkbox = createCheckbox({
      x: 100,
      y: 200,
      pageNumber: 1,
      width: 20,
      height: 20,
    });
    const source = [{ width: 612, height: 792 }];
    const remapped = remapImportedFields([multiline, checkbox], source, pagesB);
    expect(remapped[0].height).toBeCloseTo(40, 1);
    expect(remapped[1].height).toBeCloseTo(10, 1);
  });

  it("clamps page numbers to available pages", () => {
    const field = createTextField({ x: 0, y: 0, pageNumber: 5 });
    const prepared = prepareImportedFields(
      { version: 1, pages: [], fields: [field] },
      pagesA,
    );
    expect(prepared[0].pageNumber).toBe(2);
  });

  it("assigns fresh ids on import", () => {
    const field = createTextField({ x: 0, y: 0, pageNumber: 1 });
    const originalId = field.id;
    const prepared = assignFreshFieldIds([field]);
    expect(prepared[0].id).not.toBe(originalId);
  });

  it("rejects unsupported versions", () => {
    expect(() =>
      parseFormFieldsJson(
        JSON.stringify({ version: 99, pages: [], fields: [] }),
      ),
    ).toThrow("unsupportedVersion");
  });

  it("rejects invalid json", () => {
    expect(() => parseFormFieldsJson("{")).toThrow("invalidJson");
  });
});
