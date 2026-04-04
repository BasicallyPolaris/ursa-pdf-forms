import i18n from "@/i18n";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { useEditorStore } from "@/stores/editor-store";
import { loadPdfDocument } from "./pdf-loader";
import { extractAcroFormFields } from "./pdf-form-reader";
import { stripAcroFormFromPdf } from "./pdf-export-engine";

function extractFileName(filePath: string, fallback: string): string {
  return filePath.split(/[/\\]/).pop() ?? fallback;
}

async function loadPdfIntoStore(pdfBytes: Uint8Array, fileName: string) {
  const doc = await loadPdfDocument(pdfBytes);
  const store = useEditorStore.getState();
  store.setPdf(fileName, pdfBytes, []);

  try {
    const pages = await doc.getPageInfos();
    const currentStore = useEditorStore.getState();
    if (currentStore.pdfBytes === pdfBytes) {
      currentStore.setPdfPages(pages);
    }
  } catch (error) {
    const currentStore = useEditorStore.getState();
    if (currentStore.pdfBytes === pdfBytes) {
      console.error("Failed to load PDF page metadata:", error);
    }
  }

  let hasExistingFields = false;
  try {
    const fields = await extractAcroFormFields(pdfBytes);
    if (fields.length > 0) {
      hasExistingFields = true;
      const currentStore = useEditorStore.getState();
      if (currentStore.pdfBytes === pdfBytes) {
        currentStore.setInitialElements(fields);
      }
    }
  } catch (error) {
    console.error("Failed to extract AcroForm fields:", error);
  }

  if (hasExistingFields) {
    try {
      const renderBytes = await stripAcroFormFromPdf(pdfBytes);
      const currentStore = useEditorStore.getState();
      if (currentStore.pdfBytes === pdfBytes) {
        currentStore.setRenderPdfBytes(renderBytes);
      }
    } catch (error) {
      console.error("Failed to strip AcroForm for rendering:", error);
    }
  }
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

export { extractFileName, loadPdfIntoStore };
