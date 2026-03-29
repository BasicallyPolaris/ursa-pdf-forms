import { describe, it, expect } from "vitest";
import {
  createTextField,
  createCheckbox,
  createRadioButton,
  isTextField,
  isCheckbox,
  isRadioButton,
  getUniqueName,
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
      { type: "text" as const, id: "a", x: 0, y: 0, width: 10, height: 10, pageNumber: 1, name: "text_1", defaultValue: "", fontSize: 12, multiline: false, required: false, maxLength: undefined },
    ];
    expect(getUniqueName("text_1", existing)).toBe("text_2");
  });

  it("skips to next available number", () => {
    const existing = [
      { type: "text" as const, id: "a", x: 0, y: 0, width: 10, height: 10, pageNumber: 1, name: "text_1", defaultValue: "", fontSize: 12, multiline: false, required: false, maxLength: undefined },
      { type: "text" as const, id: "b", x: 0, y: 0, width: 10, height: 10, pageNumber: 1, name: "text_2", defaultValue: "", fontSize: 12, multiline: false, required: false, maxLength: undefined },
      { type: "text" as const, id: "c", x: 0, y: 0, width: 10, height: 10, pageNumber: 1, name: "text_3", defaultValue: "", fontSize: 12, multiline: false, required: false, maxLength: undefined },
    ];
    expect(getUniqueName("text_1", existing)).toBe("text_4");
  });

  it("appends _2 when name has no trailing number", () => {
    const existing = [
      { type: "text" as const, id: "a", x: 0, y: 0, width: 10, height: 10, pageNumber: 1, name: "firstName", defaultValue: "", fontSize: 12, multiline: false, required: false, maxLength: undefined },
    ];
    expect(getUniqueName("firstName", existing)).toBe("firstName_2");
  });

  it("skips _3 when _2 also exists", () => {
    const existing = [
      { type: "text" as const, id: "a", x: 0, y: 0, width: 10, height: 10, pageNumber: 1, name: "field", defaultValue: "", fontSize: 12, multiline: false, required: false, maxLength: undefined },
      { type: "text" as const, id: "b", x: 0, y: 0, width: 10, height: 10, pageNumber: 1, name: "field_2", defaultValue: "", fontSize: 12, multiline: false, required: false, maxLength: undefined },
      { type: "text" as const, id: "c", x: 0, y: 0, width: 10, height: 10, pageNumber: 1, name: "field_3", defaultValue: "", fontSize: 12, multiline: false, required: false, maxLength: undefined },
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
