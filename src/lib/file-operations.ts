import i18n from "@/i18n";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { useEditorStore } from "@/stores/editor-store";
import { serializeProject, parseProject } from "./project-file-io";
import { loadPdfDocument } from "./pdf-loader";

function extractFileName(filePath: string, fallback: string): string {
  return filePath.split(/[/\\]/).pop() ?? fallback;
}

async function loadPdfIntoStore(pdfBytes: Uint8Array, fileName: string) {
  const doc = await loadPdfDocument(pdfBytes);
  const store = useEditorStore.getState();
  store.setPdf(fileName, pdfBytes, []);

  void doc
    .getPageInfos((accumulated) => {
      const currentStore = useEditorStore.getState();
      if (currentStore.pdfBytes === pdfBytes) {
        currentStore.setPdfPages(accumulated);
      }
    })
    .catch((error) => {
      const currentStore = useEditorStore.getState();
      if (currentStore.pdfBytes === pdfBytes) {
        console.error("Failed to load PDF page metadata:", error);
      }
    });
}

export async function openPdfFile(): Promise<string | null> {
  try {
    const selected = await open({
      filters: [{ name: i18n.t("file.pdfFilter"), extensions: ["pdf"] }],
      multiple: false,
    });

    if (!selected) return null;

    const filePath = selected as string;
    const bytes = await readFile(filePath);
    const fileName = extractFileName(filePath, i18n.t("file.defaultPdfName"));
    const pdfBytes = new Uint8Array(bytes);
    await loadPdfIntoStore(pdfBytes, fileName);
    return null;
  } catch (error) {
    console.error("Open PDF failed:", error);
    return i18n.t("file.openFailed");
  }
}

export async function saveProjectFile(): Promise<string | null> {
  const { pdfFileName, pdfBytes, elements, guides } = useEditorStore.getState();
  if (!pdfBytes) return null;

  try {
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
    });

    const filePath = await save({
      filters: [{ name: i18n.t("file.projectFilter"), extensions: ["pfm"] }],
      defaultPath: (pdfFileName ?? "project").replace(".pdf", ".pfm"),
    });

    if (!filePath) return null;

    const encoder = new TextEncoder();
    await writeFile(filePath, encoder.encode(json));
    return null;
  } catch (error) {
    console.error("Save project failed:", error);
    return i18n.t("file.saveFailed");
  }
}

export async function openProjectFile(): Promise<string | null> {
  try {
    const selected = await open({
      filters: [
        {
          name: i18n.t("file.projectFilter"),
          extensions: ["pfm"],
        },
      ],
      multiple: false,
    });

    if (!selected) return null;

    const filePath = selected as string;
    const bytes = await readFile(filePath);
    const json = new TextDecoder().decode(bytes);
    const project = parseProject(json);

    const pdfBytes = Uint8Array.from(atob(project.pdfBase64), (c) =>
      c.charCodeAt(0),
    );

    const fileName = extractFileName(
      filePath,
      i18n.t("file.defaultProjectName"),
    );
    await loadPdfIntoStore(pdfBytes, fileName);

    const store = useEditorStore.getState();
    for (const el of project.elements) {
      store.addElement(el);
    }

    if (project.guides) {
      for (const guide of project.guides) {
        store.addGuide(guide.orientation, guide.position);
      }
    }

    return null;
  } catch (error) {
    console.error("Open project failed:", error);
    return i18n.t("file.projectOpenFailed");
  }
}

export { extractFileName, loadPdfIntoStore };
