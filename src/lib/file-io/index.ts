import { createFileIO } from "./orchestrator";
import {
  tauriFileSystem,
  tauriDialogs,
  zustandStore,
  tauriWindow,
} from "./adapters/tauri";
import i18n from "@/i18n";

export { createFileIO } from "./orchestrator";
export type { FileIO, UnsavedAction, FileIOLabels } from "./types";
export type {
  FileSystemPort,
  DialogPort,
  StorePort,
  WindowPort,
  FileFilter,
} from "./ports";
export {
  createTestFileSystem,
  createTestDialogs,
  createTestStore,
  createTestWindow,
} from "./adapters/test";

export const fileIO = createFileIO(
  {
    fs: tauriFileSystem,
    dialogs: tauriDialogs,
    store: zustandStore,
    window: tauriWindow,
  },
  () => ({
    pdfFilterName: i18n.t("file.pdfFilter"),
    defaultPdfName: i18n.t("file.defaultPdfName"),
    defaultExportName: i18n.t("file.defaultExportName"),
    openFailed: i18n.t("file.openFailed"),
    loadFailed: i18n.t("file.openFailed"),
    exportFailed: i18n.t("file.exportFailed"),
    unsavedTitle: i18n.t("dialog.unsavedTitle"),
    unsavedMessage: i18n.t("dialog.unsavedChanges"),
    save: i18n.t("dialog.save"),
    discard: i18n.t("dialog.discard"),
    cancel: i18n.t("dialog.cancel"),
  }),
);
