import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { useEditorStore } from "@/stores/editor-store";
import { serializeProject, parseProject } from "./project-file-io";
import { loadPdfDocument } from "./pdf-loader";

function extractFileName(filePath: string, fallback: string): string {
  return filePath.split(/[/\\]/).pop() ?? fallback;
}

async function loadPdfIntoStore(pdfBytes: Uint8Array, fileName: string) {
  const { pageInfos } = await loadPdfDocument(pdfBytes);
  useEditorStore.getState().setPdf(fileName, pdfBytes, pageInfos);
}

export async function openPdfFile() {
  const selected = await open({
    filters: [{ name: "PDF", extensions: ["pdf"] }],
    multiple: false,
  });

  if (!selected) return;

  const filePath = selected as string;
  const bytes = await readFile(filePath);
  const fileName = extractFileName(filePath, "document.pdf");
  const pdfBytes = new Uint8Array(bytes);
  await loadPdfIntoStore(pdfBytes, fileName);
}

export async function saveProjectFile() {
  const { pdfFileName, pdfBytes, elements, guides, gridSize, gridEnabled, showGrid } = useEditorStore.getState();
  if (!pdfBytes) return;

  const encoder = new TextEncoder();
  const pdfBase64 = btoa(
    Array.from(pdfBytes)
      .map((b) => String.fromCharCode(b))
      .join(""),
  );

  const json = serializeProject({
    schemaVersion: 1,
    pdfBase64,
    elements,
    guides,
    gridSize,
    gridEnabled,
    showGrid,
  });

  const filePath = await save({
    filters: [{ name: "PDF Form Maker Project", extensions: ["pfm"] }],
    defaultPath: (pdfFileName ?? "project").replace(".pdf", ".pfm"),
  });

  if (!filePath) return;

  await writeFile(filePath, encoder.encode(json));
}

export async function openProjectFile() {
  const selected = await open({
    filters: [{ name: "PDF Form Maker Project", extensions: ["pfm"] }],
    multiple: false,
  });

  if (!selected) return;

  const filePath = selected as string;
  const bytes = await readFile(filePath);
  const json = new TextDecoder().decode(bytes);
  const project = parseProject(json);

  const pdfBytes = Uint8Array.from(atob(project.pdfBase64), (c) =>
    c.charCodeAt(0),
  );

  const fileName = extractFileName(filePath, "project.pfm");
  await loadPdfIntoStore(pdfBytes, fileName);

  for (const el of project.elements) {
    useEditorStore.getState().addElement(el);
  }

  if (project.guides) {
    for (const guide of project.guides) {
      useEditorStore.getState().addGuide(guide.orientation, guide.position);
    }
  }
  if (project.gridSize !== undefined) {
    useEditorStore.getState().setGridSize(project.gridSize);
  }
  if (project.gridEnabled !== undefined && !project.gridEnabled) {
    useEditorStore.getState().toggleGrid();
  }
  if (project.showGrid !== undefined && !project.showGrid) {
    useEditorStore.getState().toggleShowGrid();
  }
}

export { extractFileName, loadPdfIntoStore };
