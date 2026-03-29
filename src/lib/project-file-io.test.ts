import { describe, it, expect } from "vitest";
import {
  serializeProject,
  parseProject,
  type ProjectFile,
} from "./project-file-io";
import { createTextField, isTextField } from "./form-element-model";

describe("serializeProject / parseProject", () => {
  it("round-trips a minimal project", () => {
    const original: ProjectFile = {
      schemaVersion: 1,
      pdfBase64: btoa("fake-pdf-bytes"),
      elements: [],
    };

    const json = serializeProject(original);
    const restored = parseProject(json);

    expect(restored.schemaVersion).toBe(1);
    expect(restored.pdfBase64).toBe(original.pdfBase64);
    expect(restored.elements).toEqual([]);
  });

  it("round-trips a project with form elements", () => {
    const elements = [
      createTextField({
        x: 72,
        y: 720,
        pageNumber: 1,
        name: "firstName",
        width: 200,
        height: 20,
      }),
      createTextField({
        x: 72,
        y: 680,
        pageNumber: 1,
        name: "lastName",
        defaultValue: "Doe",
        fontSize: 14,
      }),
    ];

    const original: ProjectFile = {
      schemaVersion: 1,
      pdfBase64: btoa("fake-pdf-bytes"),
      elements,
    };

    const json = serializeProject(original);
    const restored = parseProject(json);

    expect(restored.elements.length).toBe(2);
    const el0 = restored.elements[0];
    const el1 = restored.elements[1];
    expect(isTextField(el0) && el0.name).toBe("firstName");
    expect(el0.type).toBe("text");
    expect(isTextField(el1) && el1.defaultValue).toBe("Doe");
  });

  it("preserves element data integrity including optional fields", () => {
    const el = createTextField({
      x: 100,
      y: 200,
      pageNumber: 2,
      name: "multilineField",
      multiline: true,
      required: true,
      maxLength: 500,
    });

    const original: ProjectFile = {
      schemaVersion: 1,
      pdfBase64: btoa("pdf-data"),
      elements: [el],
    };

    const restored = parseProject(serializeProject(original));
    const restoredEl = restored.elements[0];

    expect(restoredEl.x).toBe(100);
    expect(restoredEl.y).toBe(200);
    expect(restoredEl.pageNumber).toBe(2);
    if (isTextField(restoredEl)) {
      expect(restoredEl.multiline).toBe(true);
      expect(restoredEl.required).toBe(true);
      expect(restoredEl.maxLength).toBe(500);
    }
  });

  it("includes schema version in serialized output", () => {
    const project: ProjectFile = {
      schemaVersion: 1,
      pdfBase64: "",
      elements: [],
    };

    const json = serializeProject(project);
    const parsed = JSON.parse(json);
    expect(parsed.schemaVersion).toBe(1);
  });

  it("handles large base64 PDF payloads", () => {
    const largePdf = "x".repeat(100_000);
    const project: ProjectFile = {
      schemaVersion: 1,
      pdfBase64: btoa(largePdf),
      elements: [],
    };

    const restored = parseProject(serializeProject(project));
    expect(atob(restored.pdfBase64)).toBe(largePdf);
  });
});
