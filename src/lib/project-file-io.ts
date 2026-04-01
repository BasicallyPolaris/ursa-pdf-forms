import type { FormElement } from "./form-element-model";
import type { GuideLine } from "@/stores/editor-store";

export interface ProjectFile {
  schemaVersion: number;
  pdfBase64: string;
  elements: FormElement[];
  guides?: GuideLine[];
  gridSize?: number;
  gridEnabled?: boolean;
  showGrid?: boolean;
}

export function serializeProject(project: ProjectFile): string {
  return JSON.stringify(project);
}

export function parseProject(json: string): ProjectFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON in project file");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Project file does not contain a valid object");
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.schemaVersion !== "number" || !("pdfBase64" in obj)) {
    throw new Error("Invalid project file format");
  }

  if (typeof obj.pdfBase64 !== "string" || obj.pdfBase64.length === 0) {
    throw new Error("Project file contains no PDF data");
  }

  try {
    atob(obj.pdfBase64);
  } catch {
    throw new Error("Project file contains corrupted PDF data");
  }

  if (!Array.isArray(obj.elements)) {
    throw new Error("Project file contains invalid element data");
  }

  if (obj.guides !== undefined && !Array.isArray(obj.guides)) {
    throw new Error("Project file contains invalid guide data");
  }

  const elements = (obj.elements as FormElement[]).filter(
    (el) =>
      el &&
      typeof el === "object" &&
      typeof el.id === "string" &&
      typeof el.type === "string" &&
      typeof el.x === "number" &&
      typeof el.y === "number" &&
      typeof el.pageNumber === "number",
  );

  const guides = Array.isArray(obj.guides)
    ? (obj.guides as GuideLine[]).filter(
        (g) =>
          g &&
          typeof g === "object" &&
          typeof g.id === "string" &&
          (g.orientation === "horizontal" || g.orientation === "vertical") &&
          typeof g.position === "number",
      )
    : [];

  return {
    schemaVersion: obj.schemaVersion,
    pdfBase64: obj.pdfBase64,
    elements,
    guides,
    gridSize: typeof obj.gridSize === "number" ? obj.gridSize : undefined,
    gridEnabled: typeof obj.gridEnabled === "boolean" ? obj.gridEnabled : undefined,
    showGrid: typeof obj.showGrid === "boolean" ? obj.showGrid : undefined,
  };
}
