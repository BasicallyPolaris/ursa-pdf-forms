import type { FormElement } from "@/lib/form-element-model";
import type { PageInfo } from "@/lib/pdf-loader";
import type {
  DialogPort,
  FileFilter,
  FileSystemPort,
  StorePort,
  WindowPort,
} from "../ports";

export function createTestFileSystem(
  files: Map<string, Uint8Array> = new Map(),
): FileSystemPort & { writtenFiles: Map<string, Uint8Array> } {
  const writtenFiles = new Map<string, Uint8Array>();
  return {
    writtenFiles,
    async readFile(path: string) {
      const data = files.get(path);
      if (!data) throw new Error(`File not found: ${path}`);
      return data.slice();
    },
    async writeFile(path: string, data: Uint8Array) {
      writtenFiles.set(path, data.slice());
    },
  };
}

export function createTestDialogs(overrides?: {
  openResult?: string | null;
  saveResult?: string | null;
  confirmResult?: "yes" | "no" | "cancel";
}): DialogPort & {
  openCalls: FileFilter[][];
  saveCalls: { filters: FileFilter[]; defaultPath: string }[];
  confirmCalls: Array<{ title: string; message: string; kind: string }>;
  setOpenResult: (result: string | null) => void;
  setSaveResult: (result: string | null) => void;
  setConfirmResult: (result: "yes" | "no" | "cancel") => void;
} {
  let openResult = overrides?.openResult ?? null;
  let saveResult = overrides?.saveResult ?? null;
  let confirmResult = overrides?.confirmResult ?? "no";

  const openCalls: FileFilter[][] = [];
  const saveCalls: { filters: FileFilter[]; defaultPath: string }[] = [];
  const confirmCalls: Array<{ title: string; message: string; kind: string }> =
    [];

  return {
    openCalls,
    saveCalls,
    confirmCalls,
    setOpenResult(r) {
      openResult = r;
    },
    setSaveResult(r) {
      saveResult = r;
    },
    setConfirmResult(r) {
      confirmResult = r;
    },
    async pickOpenFile(filters) {
      openCalls.push(filters);
      return openResult;
    },
    async pickSaveFile(filters, defaultPath) {
      saveCalls.push({ filters, defaultPath });
      return saveResult;
    },
    async showConfirm(options) {
      confirmCalls.push({
        title: options.title,
        message: options.message,
        kind: options.kind,
      });
      return confirmResult;
    },
  };
}

export function createTestStore(initial?: {
  pdfBytes?: Uint8Array;
  elements?: FormElement[];
}): StorePort & {
  state: {
    pdfBytes: Uint8Array | null;
    elements: FormElement[];
    pages: PageInfo[];
    fileName: string | null;
    renderPdfBytes: Uint8Array | null;
  };
  mutations: string[];
} {
  let savedSnapshot = JSON.stringify(initial?.elements ?? []);

  const state = {
    pdfBytes: initial?.pdfBytes ?? null,
    elements: initial?.elements ?? [],
    pages: [] as PageInfo[],
    fileName: null as string | null,
    filePath: null as string | null,
    renderPdfBytes: null as Uint8Array | null,
  };

  const mutations: string[] = [];

  return {
    state,
    mutations,
    getPdfBytes: () => state.pdfBytes,
    getPdfFilePath: () => state.filePath,
    getPdfFileName: () => state.fileName,
    getElements: () => state.elements,
    setPdf(name, bytes, pages) {
      mutations.push("setPdf");
      state.fileName = name;
      state.pdfBytes = bytes;
      state.pages = pages;
      state.elements = [];
      state.renderPdfBytes = null;
      savedSnapshot = "[]";
    },
    setPdfPages(pages) {
      mutations.push("setPdfPages");
      state.pages = pages;
    },
    setPdfFilePath(path) {
      mutations.push("setPdfFilePath");
      state.filePath = path;
    },
    setInitialElements(elements) {
      mutations.push("setInitialElements");
      state.elements = elements;
      savedSnapshot = JSON.stringify(elements);
    },
    setRenderPdfBytes(bytes) {
      mutations.push("setRenderPdfBytes");
      state.renderPdfBytes = bytes;
    },
    isDirty: () => {
      if (!state.pdfBytes) return false;
      return JSON.stringify(state.elements) !== savedSnapshot;
    },
    markClean() {
      mutations.push("markClean");
      savedSnapshot = JSON.stringify(state.elements);
    },
  };
}

export function createTestWindow(): WindowPort & {
  closeHandlers: Array<() => Promise<boolean>>;
  simulateCloseRequest: () => Promise<boolean>;
} {
  const closeHandlers: Array<() => Promise<boolean>> = [];

  return {
    closeHandlers,
    onCloseRequested(handler) {
      closeHandlers.push(handler);
      return () => {
        const idx = closeHandlers.indexOf(handler);
        if (idx >= 0) closeHandlers.splice(idx, 1);
      };
    },
    async simulateCloseRequest() {
      if (closeHandlers.length === 0) return true;
      return closeHandlers[closeHandlers.length - 1]();
    },
  };
}
