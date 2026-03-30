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
  const parsed = JSON.parse(json);

  if (!parsed.schemaVersion || !("pdfBase64" in parsed)) {
    throw new Error("Invalid project file format");
  }

  return {
    schemaVersion: parsed.schemaVersion,
    pdfBase64: parsed.pdfBase64,
    elements: parsed.elements ?? [],
    guides: parsed.guides ?? [],
    gridSize: parsed.gridSize,
    gridEnabled: parsed.gridEnabled,
    showGrid: parsed.showGrid,
  };
}
