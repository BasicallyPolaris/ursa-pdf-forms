import type { FormElement } from "@/lib/form-element-model";
import type { PageInfo } from "@/lib/pdf-loader";

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface FileSystemPort {
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
}

export interface DialogPort {
  pickOpenFile(filters: FileFilter[]): Promise<string | null>;
  pickSaveFile(
    filters: FileFilter[],
    defaultPath: string,
  ): Promise<string | null>;
  showConfirm(options: {
    title: string;
    message: string;
    kind: "warning" | "info" | "error";
    labels: { yes: string; no: string; cancel: string };
  }): Promise<"yes" | "no" | "cancel">;
}

export interface StorePort {
  getPdfBytes(): Uint8Array | null;
  getPdfFilePath(): string | null;
  getPdfFileName(): string | null;
  getElements(): FormElement[];
  getPages(): PageInfo[];
  setPdf(fileName: string, bytes: Uint8Array, pages: PageInfo[]): void;
  setPdfPages(pages: PageInfo[]): void;
  setPdfFilePath(path: string | null): void;
  setInitialElements(elements: FormElement[]): void;
  replaceFormElements(elements: FormElement[]): void;
  setRenderPdfBytes(bytes: Uint8Array): void;
  isDirty(): boolean;
  markClean(): void;
}

export interface WindowPort {
  onCloseRequested(handler: () => Promise<boolean>): () => void;
}
