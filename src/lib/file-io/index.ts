import i18n from "@/i18n";
import {
  tauriDialogs,
  tauriFileSystem,
  tauriWindow,
  zustandStore,
} from "./adapters/tauri";
import { createFileIO } from "./orchestrator";

export {
  createTestDialogs,
  createTestFileSystem,
  createTestStore,
  createTestWindow,
} from "./adapters/test";
export { createFileIO } from "./orchestrator";
export type {
  DialogPort,
  FileFilter,
  FileSystemPort,
  StorePort,
  WindowPort,
} from "./ports";
export type { FileIO, FileIOLabels, UnsavedAction } from "./types";

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
    fileTooLarge: i18n.t("file.fileTooLarge"),
    operationInProgress: i18n.t("file.operationInProgress"),
    formFieldsFilterName: i18n.t("file.formFieldsFilter"),
    defaultFormFieldsExportName: i18n.t("file.defaultFormFieldsExportName"),
    formFieldsExportFailed: i18n.t("file.formFieldsExportFailed"),
    formFieldsImportFailed: i18n.t("file.formFieldsImportFailed"),
    formFieldsInvalidJson: i18n.t("file.formFieldsInvalidJson"),
    formFieldsInvalidFormat: i18n.t("file.formFieldsInvalidFormat"),
    formFieldsUnsupportedVersion: i18n.t("file.formFieldsUnsupportedVersion"),
    formFieldsNoValidFields: i18n.t("file.formFieldsNoValidFields"),
    formFieldsNoPdfOpen: i18n.t("file.formFieldsNoPdfOpen"),
    formFieldsImportConfirmTitle: i18n.t("dialog.formFieldsImportTitle"),
    formFieldsImportConfirmMessage: i18n.t("dialog.formFieldsImportMessage"),
    formFieldsReplace: i18n.t("dialog.formFieldsReplace"),
    formFieldsKeepExisting: i18n.t("dialog.formFieldsKeepExisting"),
    unsavedTitle: i18n.t("dialog.unsavedTitle"),
    unsavedMessage: i18n.t("dialog.unsavedChanges"),
    save: i18n.t("dialog.save"),
    discard: i18n.t("dialog.discard"),
    cancel: i18n.t("dialog.cancel"),
  }),
);
