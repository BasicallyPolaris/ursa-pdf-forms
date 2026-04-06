import {
  isDirty as storeIsDirty,
  markClean as storeMarkClean,
  useEditorStore,
} from "@/stores/editor-store";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { message, open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import type {
  DialogPort,
  FileSystemPort,
  StorePort,
  WindowPort,
} from "../ports";

export const tauriFileSystem: FileSystemPort = {
  async readFile(path: string) {
    const bytes = await readFile(path);
    return new Uint8Array(bytes);
  },
  async writeFile(path: string, data: Uint8Array) {
    await writeFile(path, data);
  },
};

export const tauriDialogs: DialogPort = {
  async pickOpenFile(filters) {
    return (await open({
      filters,
      multiple: false,
    })) as string | null;
  },
  async pickSaveFile(filters, defaultPath) {
    return await save({ filters, defaultPath });
  },
  async showConfirm(options) {
    const result = await message(options.message, {
      title: options.title,
      kind: options.kind,
      buttons: {
        yes: options.labels.yes,
        no: options.labels.no,
        cancel: options.labels.cancel,
      },
    });
    if (result === "Yes" || result === options.labels.yes) return "yes";
    if (result === "Cancel") return "cancel";
    return "no";
  },
};

export const zustandStore: StorePort = {
  getPdfBytes: () => useEditorStore.getState().pdfBytes,
  getElements: () => useEditorStore.getState().elements,
  setPdf: (name, bytes, pages) =>
    useEditorStore.getState().setPdf(name, bytes, pages),
  setPdfPages: (pages) => useEditorStore.getState().setPdfPages(pages),
  setInitialElements: (elements) =>
    useEditorStore.getState().setInitialElements(elements),
  setRenderPdfBytes: (bytes) =>
    useEditorStore.getState().setRenderPdfBytes(bytes),
  isDirty: () => storeIsDirty(),
  markClean: () => storeMarkClean(),
};

export const tauriWindow: WindowPort = {
  onCloseRequested(handler) {
    const unlisten = getCurrentWindow().onCloseRequested(async (event) => {
      const allowClose = await handler();
      if (!allowClose) event.preventDefault();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  },
};
