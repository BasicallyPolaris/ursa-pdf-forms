import { fileIO } from "@/lib/file-io";
import { getPageAtViewportCenter } from "@/lib/page-layout";
import { redo, undo, useEditorStore } from "@/stores/editor-store";
import { useSettingsStore } from "@/stores/settings-store";

export function menuOpenPdf(): void {
  void fileIO.openPdf();
}

export function menuExportPdf(): void {
  void fileIO.exportPdf();
}

export function menuExportFormFields(): void {
  void fileIO.exportFormFields();
}

export function menuImportFormFields(): void {
  void fileIO.importFormFields();
}

export function menuUndo(): void {
  undo();
}

export function menuRedo(): void {
  redo();
}

export function menuCut(): void {
  useEditorStore.getState().cutSelection();
}

export function menuCopy(): void {
  useEditorStore.getState().copySelection();
}

export function menuPaste(): void {
  const store = useEditorStore.getState();
  const scrollEl = document.querySelector<HTMLElement>("[data-pdf-scroll-container]");
  if (!scrollEl) return;
  const page = getPageAtViewportCenter(scrollEl, store.pages, store.zoom);
  if (page !== undefined) store.pasteClipboard(page);
}

export function menuDuplicate(): void {
  const store = useEditorStore.getState();
  const scrollEl = document.querySelector<HTMLElement>("[data-pdf-scroll-container]");
  if (!scrollEl) return;
  const page = getPageAtViewportCenter(scrollEl, store.pages, store.zoom);
  if (page !== undefined) store.duplicateSelection(page);
}

export function menuSelectAll(): void {
  const store = useEditorStore.getState();
  store.selectElements(new Set(store.elements.map((e) => e.id)));
}

export function menuOpenSettings(): void {
  useSettingsStore.getState().openSettings();
}

export function menuOpenShortcuts(): void {
  useSettingsStore.getState().openShortcuts();
}

export function menuStartTour(): void {
  useSettingsStore.getState().startTour();
}

export function menuResetOnboarding(): void {
  useSettingsStore.getState().resetOnboarding();
  useSettingsStore.getState().openOnboarding();
}

export function menuTogglePropertiesPanel(): void {
  useEditorStore.getState().togglePropertiesPanel();
}
