import { describe, it, expect } from "vitest";
import {
  createTextField,
  isTextField,
  validateElement,
  type FormElement,
} from "./form-element-model";

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
});

describe("isTextField", () => {
  it("returns true for text elements", () => {
    const el = createTextField({ x: 0, y: 0, pageNumber: 1 });
    expect(isTextField(el)).toBe(true);
  });

  it("returns false for non-text elements", () => {
    const el: FormElement = {
      type: "checkbox",
      id: "test",
      x: 0,
      y: 0,
      width: 12,
      height: 12,
      pageNumber: 1,
      name: "cb",
      defaultChecked: false,
    } as FormElement;
    expect(isTextField(el)).toBe(false);
  });
});

describe("validateElement", () => {
  it("accepts valid text field", () => {
    const el = createTextField({ x: 0, y: 0, pageNumber: 1, name: "field1" });
    const errors = validateElement(el);
    expect(errors).toEqual([]);
  });

  it("rejects element with empty name", () => {
    const el = createTextField({ x: 0, y: 0, pageNumber: 1 });
    const errors = validateElement(el);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain("name is required");
  });

  it("rejects element with zero page number", () => {
    const el = createTextField({ x: 0, y: 0, pageNumber: 0, name: "f" });
    const errors = validateElement(el);
    expect(errors).toContain("pageNumber must be >= 1");
  });

  it("rejects element with negative dimensions", () => {
    const el = createTextField({
      x: 0,
      y: 0,
      pageNumber: 1,
      name: "f",
      width: -10,
      height: 5,
    });
    const errors = validateElement(el);
    expect(errors).toContain("width must be > 0");
  });
});
