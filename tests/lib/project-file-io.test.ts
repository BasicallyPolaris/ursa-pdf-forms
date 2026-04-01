import { describe, it, expect } from "vitest";
import {
  serializeProject,
  parseProject,
  type ProjectFile,
} from "@/lib/project-file-io";
import { createTextField, isTextField } from "@/lib/form-element-model";

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

describe("parseProject validation edge cases", () => {
  it("throws on invalid JSON", () => {
    expect(() => parseProject("{broken json")).toThrow("Invalid JSON");
  });

  it("throws on non-object JSON", () => {
    expect(() => parseProject('"hello"')).toThrow("valid object");
    expect(() => parseProject("42")).toThrow("valid object");
    expect(() => parseProject("null")).toThrow("valid object");
  });

  it("throws on missing schemaVersion", () => {
    const json = JSON.stringify({ pdfBase64: btoa("data"), elements: [] });
    expect(() => parseProject(json)).toThrow("Invalid project file format");
  });

  it("throws on missing pdfBase64", () => {
    const json = JSON.stringify({ schemaVersion: 1, elements: [] });
    expect(() => parseProject(json)).toThrow("Invalid project file format");
  });

  it("throws on empty pdfBase64", () => {
    const json = JSON.stringify({ schemaVersion: 1, pdfBase64: "", elements: [] });
    expect(() => parseProject(json)).toThrow("no PDF data");
  });

  it("throws on non-string pdfBase64", () => {
    const json = JSON.stringify({ schemaVersion: 1, pdfBase64: 42, elements: [] });
    expect(() => parseProject(json)).toThrow("no PDF data");
  });

  it("throws on invalid base64", () => {
    const json = JSON.stringify({ schemaVersion: 1, pdfBase64: "not-valid-base64!!!", elements: [] });
    expect(() => parseProject(json)).toThrow("corrupted PDF data");
  });

  it("throws on missing elements array", () => {
    const json = JSON.stringify({ schemaVersion: 1, pdfBase64: btoa("data") });
    expect(() => parseProject(json)).toThrow("invalid element data");
  });

  it("throws on non-array elements", () => {
    const json = JSON.stringify({ schemaVersion: 1, pdfBase64: btoa("data"), elements: "not-array" });
    expect(() => parseProject(json)).toThrow("invalid element data");
  });

  it("filters out malformed elements", () => {
    const project = {
      schemaVersion: 1,
      pdfBase64: btoa("data"),
      elements: [
        { type: "text", id: "a", x: 0, y: 0, pageNumber: 1 },
        { type: "text" },
        null,
        "not-an-object",
        { type: 42, id: "b", x: 0, y: 0, pageNumber: 1 },
      ],
    };
    const restored = parseProject(JSON.stringify(project));
    expect(restored.elements.length).toBe(1);
    expect(restored.elements[0].id).toBe("a");
  });

  it("filters out malformed guides", () => {
    const project = {
      schemaVersion: 1,
      pdfBase64: btoa("data"),
      elements: [],
      guides: [
        { id: "g1", orientation: "horizontal", position: 100 },
        { id: "g2" },
        null,
        "bad",
        { id: "g3", orientation: "diagonal", position: 50 },
        { id: "g4", orientation: "vertical", position: "not-a-number" },
      ],
    };
    const restored = parseProject(JSON.stringify(project));
    expect(restored.guides!.length).toBe(1);
    expect(restored.guides![0].id).toBe("g1");
  });

  it("handles non-array guides field", () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      pdfBase64: btoa("data"),
      elements: [],
      guides: "not-array",
    });
    expect(() => parseProject(json)).toThrow("invalid guide data");
  });

  it("preserves optional grid settings when valid", () => {
    const project = {
      schemaVersion: 1,
      pdfBase64: btoa("data"),
      elements: [],
      gridSize: 20,
      gridEnabled: true,
      showGrid: false,
    };
    const restored = parseProject(JSON.stringify(project));
    expect(restored.gridSize).toBe(20);
    expect(restored.gridEnabled).toBe(true);
    expect(restored.showGrid).toBe(false);
  });

  it("drops invalid grid settings", () => {
    const project = {
      schemaVersion: 1,
      pdfBase64: btoa("data"),
      elements: [],
      gridSize: "not-a-number",
      gridEnabled: "not-a-bool",
      showGrid: 42,
    };
    const restored = parseProject(JSON.stringify(project));
    expect(restored.gridSize).toBeUndefined();
    expect(restored.gridEnabled).toBeUndefined();
    expect(restored.showGrid).toBeUndefined();
  });

  it("handles guides as undefined when not present", () => {
    const project = {
      schemaVersion: 1,
      pdfBase64: btoa("data"),
      elements: [],
    };
    const restored = parseProject(JSON.stringify(project));
    expect(restored.guides).toEqual([]);
  });
});
