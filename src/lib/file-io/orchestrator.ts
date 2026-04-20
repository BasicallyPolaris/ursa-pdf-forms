import {
  exportFormElements,
  stripAcroFormFromPdf,
} from "@/lib/pdf-export-engine";
import { extractAcroFormFields } from "@/lib/pdf-form-reader";
import { loadPdfDocument } from "@/lib/pdf-loader";
import type {
  DialogPort,
  FileSystemPort,
  StorePort,
  WindowPort,
} from "./ports";
import type { FileIO, FileIOLabels, UnsavedAction } from "./types";

function extractFileName(filePath: string, fallback: string): string {
  if (typeof filePath !== "string" || filePath.length === 0) return fallback;
  return filePath.split(/[/\\]/).pop() ?? fallback;
}

const MAX_PDF_SIZE = 100 * 1024 * 1024;

export function createFileIO(
  ports: {
    fs: FileSystemPort;
    dialogs: DialogPort;
    store: StorePort;
    window: WindowPort;
  },
  getLabels: () => FileIOLabels,
): FileIO {
  let operationInProgress = false;

  async function withLock<T>(fn: () => Promise<T>): Promise<T> {
    if (operationInProgress) {
      throw new Error("Another file operation is in progress");
    }
    operationInProgress = true;
    try {
      return await fn();
    } finally {
      operationInProgress = false;
    }
  }
  async function loadPdfFromBytes(
    bytes: Uint8Array,
    fileName: string,
  ): Promise<void> {
    const doc = await loadPdfDocument(bytes);
    ports.store.setPdf(fileName, bytes, []);

    try {
      const pages = await doc.getPageInfos();
      if (ports.store.getPdfBytes() === bytes) {
        ports.store.setPdfPages(pages);
      }
    } catch (error) {
      if (ports.store.getPdfBytes() === bytes) {
        console.error("Failed to load PDF page metadata:", error);
      }
    }

    let hasExistingFields = false;
    try {
      const fields = await extractAcroFormFields(bytes);
      if (fields.length > 0) {
        hasExistingFields = true;
        if (ports.store.getPdfBytes() === bytes) {
          ports.store.setInitialElements(fields);
        }
      }
    } catch (error) {
      console.error("Failed to extract AcroForm fields:", error);
    }

    if (hasExistingFields) {
      try {
        const renderBytes = await stripAcroFormFromPdf(bytes);
        if (ports.store.getPdfBytes() === bytes) {
          ports.store.setRenderPdfBytes(renderBytes);
        }
      } catch (error) {
        console.error("Failed to strip AcroForm for rendering:", error);
      }
    }
  }

  async function confirmUnsavedChanges(): Promise<UnsavedAction> {
    if (!ports.store.isDirty()) return "discard";
    const labels = getLabels();

    try {
      const result = await ports.dialogs.showConfirm({
        title: labels.unsavedTitle,
        message: labels.unsavedMessage,
        kind: "warning",
        labels: {
          yes: labels.save,
          no: labels.discard,
          cancel: labels.cancel,
        },
      });

      if (result === "yes") {
        const error = await exportPdf();
        return error ? "cancel" : "save";
      }
      if (result === "cancel") return "cancel";
      return "discard";
    } catch {
      return "cancel";
    }
  }

  async function openPdf(): Promise<string | null> {
    const labels = getLabels();
    try {
      return await withLock(async () => {
        const action = await confirmUnsavedChanges();
        if (action === "cancel") return null;

        const filePath = await ports.dialogs.pickOpenFile([
          { name: labels.pdfFilterName, extensions: ["pdf"] },
        ]);
        if (!filePath) return null;

        const bytes = await ports.fs.readFile(filePath);
        if (bytes.length > MAX_PDF_SIZE) {
          return labels.fileTooLarge ?? "File is too large to open";
        }
        const fileName = extractFileName(filePath, labels.defaultPdfName);
        await loadPdfFromBytes(bytes, fileName);
        ports.store.setPdfFilePath(filePath);
        return null;
      });
    } catch (error) {
      console.error("Open PDF failed:", error);
      return error instanceof Error && error.message === "Another file operation is in progress"
        ? labels.operationInProgress ?? "Another file operation is in progress"
        : labels.openFailed;
    }
  }

  async function exportPdf(): Promise<string | null> {
    const labels = getLabels();
    const pdfBytes = ports.store.getPdfBytes();
    if (!pdfBytes) return null;

    try {
      return await withLock(async () => {
        const elements = ports.store.getElements();
        const resultBytes = await exportFormElements(pdfBytes, elements);

        const sourcePath = ports.store.getPdfFilePath();
        const sourceName = ports.store.getPdfFileName();
        let defaultExportPath = labels.defaultExportName;
        if (sourcePath) {
          const dir = sourcePath.split(/[/\\]/).slice(0, -1).join("/");
          const baseName = sourceName ?? extractFileName(sourcePath, labels.defaultExportName);
          defaultExportPath = `${dir}/${baseName}`;
        } else if (sourceName) {
          defaultExportPath = sourceName;
        }

        const filePath = await ports.dialogs.pickSaveFile(
          [{ name: labels.pdfFilterName, extensions: ["pdf"] }],
          defaultExportPath,
        );
        if (!filePath) return null;

        await ports.fs.writeFile(filePath, resultBytes);
        ports.store.markClean();
        return null;
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message !== "Another file operation is in progress"
          ? error.message
          : labels.exportFailed;
      console.error("Export failed:", error);
      return message;
    }
  }

  function registerCloseGuard(): () => void {
    return ports.window.onCloseRequested(async () => {
      try {
        if (!ports.store.isDirty()) return true;
        const action = await confirmUnsavedChanges();
        return action !== "cancel";
      } catch {
        return false;
      }
    });
  }

  async function loadPdfFromPath(filePath: string): Promise<string | null> {
    const labels = getLabels();
    try {
      return await withLock(async () => {
        const bytes = await ports.fs.readFile(filePath);
        if (bytes.length > MAX_PDF_SIZE) {
          return labels.fileTooLarge ?? "File is too large to open";
        }
        const fileName = extractFileName(filePath, labels.defaultPdfName);
        await loadPdfFromBytes(bytes, fileName);
        ports.store.setPdfFilePath(filePath);
        return null;
      });
    } catch (error) {
      console.error("Load PDF from path failed:", error);
      return error instanceof Error && error.message === "Another file operation is in progress"
        ? labels.operationInProgress ?? "Another file operation is in progress"
        : labels.loadFailed;
    }
  }

  return {
    openPdf,
    loadPdfFromBytes,
    loadPdfFromPath,
    exportPdf,
    confirmUnsavedChanges,
    registerCloseGuard,
  };
}
