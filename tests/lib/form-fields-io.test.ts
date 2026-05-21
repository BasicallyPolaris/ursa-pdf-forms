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

  it("clamps imported fields to target PDF page bounds", () => {
    const json = JSON.stringify({
      version: 1,
      pages: [{ width: 612, height: 792 }],
      fields: [
        {
          type: "text",
          id: "a",
          x: -400,
          y: 2000,
          width: 5000,
          height: 5000,
          pageNumber: 1,
          name: "n",
          defaultValue: "",
          fontSize: 12,
          multiline: true,
          required: false,
          fontFamily: "Helvetica",
          fontWeight: "regular",
          textColor: "#000000",
          backgroundColor: null,
          borderColor: null,
          borderWidth: 1,
        },
      ],
    });
    const doc = parseFormFieldsJson(json);
    const prepared = prepareImportedFields(doc, pagesA);
    const el = prepared[0];
    expect(el.x).toBeGreaterThanOrEqual(0);
    expect(el.y).toBeGreaterThanOrEqual(0);
    expect(el.width).toBeLessThanOrEqual(612);
    expect(el.height).toBeLessThanOrEqual(792);
    expect(el.x + el.width).toBeLessThanOrEqual(612);
    expect(el.y + el.height).toBeLessThanOrEqual(792);
  });

  it("clamps after scale to smaller target page", () => {
    const json = JSON.stringify({
      version: 1,
      pages: [{ width: 612, height: 792 }],
      fields: [
        {
          type: "text",
          id: "a",
          x: 500,
          y: 700,
          width: 400,
          height: 200,
          pageNumber: 1,
          name: "n",
          defaultValue: "",
          fontSize: 12,
          multiline: true,
          required: false,
          fontFamily: "Helvetica",
          fontWeight: "regular",
          textColor: "#000000",
          backgroundColor: null,
          borderColor: null,
          borderWidth: 1,
        },
      ],
    });
    const doc = parseFormFieldsJson(json);
    const prepared = prepareImportedFields(doc, pagesB);
    const el = prepared[0];
    expect(el.x + el.width).toBeLessThanOrEqual(306);
    expect(el.y + el.height).toBeLessThanOrEqual(396);
  });

  it("clamps when source and target page sizes match but geometry is off-page", () => {
    const field = createTextField({
      x: 700,
      y: 0,
      pageNumber: 1,
      width: 100,
      height: 20,
      name: "n",
    });
    const prepared = prepareImportedFields(
      {
        version: 1,
        pages: [
          { width: 612, height: 792 },
          { width: 612, height: 792 },
        ],
        fields: [field],
      },
      pagesA,
    );
    expect(prepared[0].x).toBe(612 - 100);
    expect(prepared[0].width).toBe(100);
  });

  it("uses positive defaults for invalid width in parsed JSON", () => {
    const json = JSON.stringify({
      version: 1,
      pages: [],
      fields: [
        {
          type: "checkbox",
          id: "c",
          x: 0,
          y: 0,
          width: -5,
          height: 0,
          pageNumber: 1,
          name: "cb",
          defaultChecked: false,
        },
      ],
    });
    const doc = parseFormFieldsJson(json);
    expect(doc.fields[0].width).toBe(15);
    expect(doc.fields[0].height).toBe(15);
  });
});
