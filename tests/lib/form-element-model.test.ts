import { describe, it, expect } from "vitest";
import {
  createTextField,
  createCheckbox,
  createRadioButton,
  isTextField,
  isCheckbox,
  isRadioButton,
  getUniqueName,
  heightFromFontSize,
  sanitizeNumericValue,
  getElementName,
  validateElementForExport,
} from "@/lib/form-element-model";

describe("createTextField", () => {
  it("creates a text field with sensible defaults", () => {
    const el = createTextField({
      x: 72,
      y: 72,
      pageNumber: 1,
    });

    expect(el.type).toBe("text");
    expect(el.x).toBe(72);
    expect(el.y).toBe(72);
    expect(el.pageNumber).toBe(1);
    expect(el.width).toBeGreaterThan(0);
    expect(el.height).toBeGreaterThan(0);
    expect(el.id).toBeTruthy();
    expect(el.name).toBe("");
    expect(el.defaultValue).toBe("");
    expect(el.fontSize).toBe(12);
    expect(el.multiline).toBe(false);
    expect(el.required).toBe(false);
  });

  it("accepts overrides for all properties", () => {
    const el = createTextField({
      x: 100,
      y: 200,
      pageNumber: 2,
      name: "firstName",
      defaultValue: "John",
      fontSize: 14,
      multiline: true,
      required: true,
      maxLength: 50,
      width: 200,
      height: 30,
    });

    expect(el.name).toBe("firstName");
    expect(el.defaultValue).toBe("John");
    expect(el.fontSize).toBe(14);
    expect(el.multiline).toBe(true);
    expect(el.required).toBe(true);
    expect(el.maxLength).toBe(50);
    expect(el.width).toBe(200);
    expect(el.height).toBe(30);
  });

  it("auto-derives height from fontSize for single-line fields", () => {
    const el = createTextField({ x: 0, y: 0, pageNumber: 1, fontSize: 14 });
    expect(el.height).toBe(heightFromFontSize(14));
    expect(el.multiline).toBe(false);
  });

  it("uses default height for multiline when no height specified", () => {
    const el = createTextField({ x: 0, y: 0, pageNumber: 1, multiline: true });
    expect(el.height).toBe(60);
  });
});

describe("heightFromFontSize", () => {
  it("returns fontSize * 1.2 rounded to nearest 0.5", () => {
    expect(heightFromFontSize(12)).toBe(14.5);
    expect(heightFromFontSize(10)).toBe(12);
    expect(heightFromFontSize(14)).toBe(17);
  });
});

describe("isTextField", () => {
  it("returns true for text elements", () => {
    const el = createTextField({ x: 0, y: 0, pageNumber: 1 });
    expect(isTextField(el)).toBe(true);
  });
});

describe("getUniqueName", () => {
  it("returns same name when no collision", () => {
    expect(getUniqueName("field_1", [])).toBe("field_1");
  });

  it("increments trailing number on collision", () => {
    const existing = [
      createTextField({ x: 0, y: 0, pageNumber: 1, name: "text_1" }),
    ];
    expect(getUniqueName("text_1", existing)).toBe("text_2");
  });

  it("skips to next available number", () => {
    const existing = [
      createTextField({ x: 0, y: 0, pageNumber: 1, name: "text_1" }),
      createTextField({ x: 0, y: 0, pageNumber: 1, name: "text_2" }),
      createTextField({ x: 0, y: 0, pageNumber: 1, name: "text_3" }),
    ];
    expect(getUniqueName("text_1", existing)).toBe("text_4");
  });

  it("appends _2 when name has no trailing number", () => {
    const existing = [
      createTextField({ x: 0, y: 0, pageNumber: 1, name: "firstName" }),
    ];
    expect(getUniqueName("firstName", existing)).toBe("firstName_2");
  });

  it("skips _3 when _2 also exists", () => {
    const existing = [
      createTextField({ x: 0, y: 0, pageNumber: 1, name: "field" }),
      createTextField({ x: 0, y: 0, pageNumber: 1, name: "field_2" }),
      createTextField({ x: 0, y: 0, pageNumber: 1, name: "field_3" }),
    ];
    expect(getUniqueName("field", existing)).toBe("field_4");
  });
});

describe("createCheckbox", () => {
  it("creates a checkbox with sensible defaults", () => {
    const el = createCheckbox({ x: 50, y: 50, pageNumber: 1 });
    expect(el.type).toBe("checkbox");
    expect(el.x).toBe(50);
    expect(el.y).toBe(50);
    expect(el.pageNumber).toBe(1);
    expect(el.width).toBe(15);
    expect(el.height).toBe(15);
    expect(el.id).toBeTruthy();
    expect(el.name).toBe("");
    expect(el.defaultChecked).toBe(false);
  });

  it("accepts overrides", () => {
    const el = createCheckbox({
      x: 100,
      y: 200,
      pageNumber: 2,
      name: "agree",
      defaultChecked: true,
      width: 20,
      height: 20,
    });
    expect(el.name).toBe("agree");
    expect(el.defaultChecked).toBe(true);
    expect(el.width).toBe(20);
    expect(el.height).toBe(20);
  });
});

describe("isCheckbox", () => {
  it("returns true for checkbox elements", () => {
    const el = createCheckbox({ x: 0, y: 0, pageNumber: 1 });
    expect(isCheckbox(el)).toBe(true);
    expect(isTextField(el)).toBe(false);
  });

  it("returns false for text elements", () => {
    const el = createTextField({ x: 0, y: 0, pageNumber: 1 });
    expect(isCheckbox(el)).toBe(false);
  });
});

describe("createRadioButton", () => {
  it("creates a radio button with sensible defaults", () => {
    const el = createRadioButton({ x: 50, y: 50, pageNumber: 1 });
    expect(el.type).toBe("radio");
    expect(el.x).toBe(50);
    expect(el.y).toBe(50);
    expect(el.pageNumber).toBe(1);
    expect(el.width).toBe(15);
    expect(el.height).toBe(15);
    expect(el.id).toBeTruthy();
    expect(el.groupName).toBe("");
    expect(el.value).toBe("");
    expect(el.label).toBe("");
  });

  it("accepts overrides", () => {
    const el = createRadioButton({
      x: 100,
      y: 200,
      pageNumber: 2,
      groupName: "color",
      value: "red",
      label: "Red",
      width: 20,
      height: 20,
    });
    expect(el.groupName).toBe("color");
    expect(el.value).toBe("red");
    expect(el.label).toBe("Red");
    expect(el.width).toBe(20);
  });
});

describe("isRadioButton", () => {
  it("returns true for radio elements", () => {
    const el = createRadioButton({ x: 0, y: 0, pageNumber: 1 });
    expect(isRadioButton(el)).toBe(true);
    expect(isTextField(el)).toBe(false);
    expect(isCheckbox(el)).toBe(false);
  });
});

describe("heightFromFontSize edge cases", () => {
  it("falls back to 12 for NaN", () => {
    expect(heightFromFontSize(NaN)).toBe(heightFromFontSize(12));
  });

  it("falls back to 12 for Infinity", () => {
    expect(heightFromFontSize(Infinity)).toBe(heightFromFontSize(12));
    expect(heightFromFontSize(-Infinity)).toBe(heightFromFontSize(12));
  });

  it("falls back to 12 for zero", () => {
    expect(heightFromFontSize(0)).toBe(heightFromFontSize(12));
  });

  it("falls back to 12 for negative", () => {
    expect(heightFromFontSize(-5)).toBe(heightFromFontSize(12));
  });
});

describe("createTextField edge cases", () => {
  it("falls back fontSize NaN to 12", () => {
    const el = createTextField({ x: 0, y: 0, pageNumber: 1, fontSize: NaN });
    expect(el.fontSize).toBe(12);
  });

  it("falls back fontSize Infinity to 12", () => {
    const el = createTextField({ x: 0, y: 0, pageNumber: 1, fontSize: Infinity });
    expect(el.fontSize).toBe(12);
  });

  it("falls back fontSize negative to 12", () => {
    const el = createTextField({ x: 0, y: 0, pageNumber: 1, fontSize: -5 });
    expect(el.fontSize).toBe(12);
  });

  it("falls back width NaN to 150", () => {
    const el = createTextField({ x: 0, y: 0, pageNumber: 1, width: NaN });
    expect(el.width).toBe(150);
  });

  it("falls back height NaN to derived default", () => {
    const el = createTextField({ x: 0, y: 0, pageNumber: 1, height: NaN });
    expect(el.height).toBe(heightFromFontSize(12));
  });

  it("falls back width zero to 150", () => {
    const el = createTextField({ x: 0, y: 0, pageNumber: 1, width: 0 });
    expect(el.width).toBe(150);
  });

  it("falls back height negative to derived default", () => {
    const el = createTextField({ x: 0, y: 0, pageNumber: 1, height: -10 });
    expect(el.height).toBe(heightFromFontSize(12));
  });
});

describe("createCheckbox edge cases", () => {
  it("falls back width NaN to 15", () => {
    const el = createCheckbox({ x: 0, y: 0, pageNumber: 1, width: NaN });
    expect(el.width).toBe(15);
  });

  it("falls back height Infinity to 15", () => {
    const el = createCheckbox({ x: 0, y: 0, pageNumber: 1, height: Infinity });
    expect(el.height).toBe(15);
  });

  it("falls back width zero to 15", () => {
    const el = createCheckbox({ x: 0, y: 0, pageNumber: 1, width: 0 });
    expect(el.width).toBe(15);
  });
});

describe("createRadioButton edge cases", () => {
  it("falls back width NaN to 15", () => {
    const el = createRadioButton({ x: 0, y: 0, pageNumber: 1, width: NaN });
    expect(el.width).toBe(15);
  });

  it("falls back height negative to 15", () => {
    const el = createRadioButton({ x: 0, y: 0, pageNumber: 1, height: -1 });
    expect(el.height).toBe(15);
  });
});

describe("sanitizeNumericValue", () => {
  it("returns undefined for undefined", () => {
    expect(sanitizeNumericValue(undefined)).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(sanitizeNumericValue(null)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(sanitizeNumericValue("")).toBeUndefined();
  });

  it("returns undefined for NaN", () => {
    expect(sanitizeNumericValue(NaN)).toBeUndefined();
  });

  it("returns undefined for Infinity", () => {
    expect(sanitizeNumericValue(Infinity)).toBeUndefined();
  });

  it("returns number for valid finite number", () => {
    expect(sanitizeNumericValue(42)).toBe(42);
  });

  it("returns number for numeric string", () => {
    expect(sanitizeNumericValue("3.14")).toBe(3.14);
  });

  it("returns undefined for non-numeric string", () => {
    expect(sanitizeNumericValue("abc")).toBeUndefined();
  });
});

describe("getElementName", () => {
  it("returns name for text field", () => {
    const el = createTextField({ x: 0, y: 0, pageNumber: 1, name: "field1" });
    expect(getElementName(el)).toBe("field1");
  });

  it("returns name for checkbox", () => {
    const el = createCheckbox({ x: 0, y: 0, pageNumber: 1, name: "check1" });
    expect(getElementName(el)).toBe("check1");
  });

  it("returns groupName for radio with groupName", () => {
    const el = createRadioButton({ x: 0, y: 0, pageNumber: 1, groupName: "color", value: "red" });
    expect(getElementName(el)).toBe("color");
  });

  it("returns value for radio without groupName", () => {
    const el = createRadioButton({ x: 0, y: 0, pageNumber: 1, value: "red" });
    expect(getElementName(el)).toBe("red");
  });

  it("returns empty string for unnamed text field", () => {
    const el = createTextField({ x: 0, y: 0, pageNumber: 1 });
    expect(getElementName(el)).toBe("");
  });
});

describe("validateElementForExport", () => {
  it("returns valid for well-formed elements", () => {
    const elements = [
      createTextField({ x: 0, y: 0, pageNumber: 1, name: "field1" }),
      createCheckbox({ x: 0, y: 0, pageNumber: 1, name: "check1" }),
    ];
    const result = validateElementForExport(elements);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("detects empty names", () => {
    const elements = [
      createTextField({ x: 0, y: 0, pageNumber: 1 }),
    ];
    const result = validateElementForExport(elements);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("empty-name");
  });

  it("allows duplicate names for linked fields", () => {
    const elements = [
      createTextField({ x: 0, y: 0, pageNumber: 1, name: "dup" }),
      createTextField({ x: 10, y: 10, pageNumber: 1, name: "dup" }),
    ];
    const result = validateElementForExport(elements);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("detects duplicate names across field types", () => {
    const elements = [
      createTextField({ x: 0, y: 0, pageNumber: 1, name: "shared" }),
      createCheckbox({ x: 10, y: 10, pageNumber: 1, name: "shared" }),
    ];
    const result = validateElementForExport(elements);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("duplicate-name");
  });

  it("detects empty radio group names", () => {
    const elements = [
      createRadioButton({ x: 0, y: 0, pageNumber: 1, value: "a" }),
    ];
    const result = validateElementForExport(elements);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("empty-group-name");
  });

  it("detects empty radio values", () => {
    const elements = [
      createRadioButton({ x: 0, y: 0, pageNumber: 1, groupName: "g1" }),
    ];
    const result = validateElementForExport(elements);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("empty-radio-value");
  });

  it("returns valid for well-formed radio group", () => {
    const elements = [
      createRadioButton({ x: 0, y: 0, pageNumber: 1, groupName: "color", value: "red" }),
      createRadioButton({ x: 0, y: 0, pageNumber: 1, groupName: "color", value: "blue" }),
    ];
    const result = validateElementForExport(elements);
    expect(result.valid).toBe(true);
  });

  it("collects multiple error types at once", () => {
    const elements = [
      createTextField({ x: 0, y: 0, pageNumber: 1 }),
      createRadioButton({ x: 0, y: 0, pageNumber: 1 }),
    ];
    const result = validateElementForExport(elements);
    expect(result.errors).toContain("empty-name");
    expect(result.errors).toContain("empty-group-name");
    expect(result.errors).toContain("empty-radio-value");
  });
});
