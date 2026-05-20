export type UnsavedAction = "save" | "discard" | "cancel";

export interface FileIO {
  openPdf(): Promise<string | null>;
  loadPdfFromBytes(bytes: Uint8Array, fileName: string): Promise<void>;
  loadPdfFromPath(path: string): Promise<string | null>;
  exportPdf(): Promise<string | null>;
  exportFormFields(): Promise<string | null>;
  importFormFields(): Promise<string | null>;
  confirmUnsavedChanges(): Promise<UnsavedAction>;
  registerCloseGuard(): () => void;
}

export interface FileIOLabels {
  pdfFilterName: string;
  defaultPdfName: string;
  defaultExportName: string;
  openFailed: string;
  loadFailed: string;
  exportFailed: string;
  unsavedTitle: string;
  unsavedMessage: string;
  save: string;
  discard: string;
  cancel: string;
  fileTooLarge?: string;
  operationInProgress?: string;
  formFieldsFilterName: string;
  defaultFormFieldsExportName: string;
  formFieldsExportFailed: string;
  formFieldsImportFailed: string;
  formFieldsInvalidJson: string;
  formFieldsInvalidFormat: string;
  formFieldsUnsupportedVersion: string;
  formFieldsNoValidFields: string;
  formFieldsNoPdfOpen: string;
  formFieldsImportConfirmTitle: string;
  formFieldsImportConfirmMessage: string;
  formFieldsReplace: string;
}
