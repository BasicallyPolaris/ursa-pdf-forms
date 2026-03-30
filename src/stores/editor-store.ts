import { create } from "zustand";
import { temporal } from "zundo";
import {
  type FormElement,
  getUniqueName,
} from "@/lib/form-element-model";
import type { PageInfo } from "@/lib/pdf-loader";

export type { PageInfo };

let nextPasteId = 1;
function generatePastedId(): string {
  return `el_paste_${nextPasteId++}_${Date.now().toString(36)}`;
}

const PASTE_OFFSET = 10;

interface EditorState {
  pdfFileName: string | null;
  pdfBytes: Uint8Array | null;
  pages: PageInfo[];
  zoom: number;
  activeTool: "select" | "input" | "textarea" | "checkbox" | "radio";
  sidebarCollapsed: boolean;
  elements: FormElement[];
  selectedIds: Set<string>;
  clipboard: FormElement[];

  setPdf: (fileName: string, bytes: Uint8Array, pages: PageInfo[]) => void;
  setZoom: (zoom: number) => void;
  setActiveTool: (tool: EditorState["activeTool"]) => void;
  toggleSidebar: () => void;
  clearPdf: () => void;
  addElement: (element: FormElement) => void;
  updateElement: (id: string, updates: Partial<FormElement>) => void;
  moveElements: (updates: Array<{ id: string; x: number; y: number }>) => void;
  removeElements: (ids: string[]) => void;
  selectElements: (ids: Set<string>) => void;
  clearSelection: () => void;
  toggleInSelection: (id: string) => void;
  addToSelection: (ids: string[]) => void;
  copySelection: () => void;
  pasteClipboard: () => void;
}

export const useEditorStore = create<EditorState>()(
  temporal(
    (set) => ({
      pdfFileName: null,
      pdfBytes: null,
      pages: [],
      zoom: 1,
      activeTool: "select",
      sidebarCollapsed: false,
      elements: [],
      selectedIds: new Set<string>(),
      clipboard: [],

      setPdf: (fileName, bytes, pages) =>
        set({ pdfFileName: fileName, pdfBytes: bytes, pages }),

      setZoom: (zoom) => set({ zoom }),

      setActiveTool: (activeTool) => set({ activeTool }),

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      clearPdf: () =>
        set({ pdfFileName: null, pdfBytes: null, pages: [] }),

      addElement: (element) =>
        set((s) => ({ elements: [...s.elements, element] })),

      updateElement: (id, updates) =>
        set((s) => ({
          elements: s.elements.map((el) =>
            el.id === id ? ({ ...el, ...updates } as FormElement) : el,
          ),
        })),

      moveElements: (updates) =>
        set((s) => ({
          elements: s.elements.map((el) => {
            const u = updates.find((u) => u.id === el.id);
            return u ? { ...el, x: u.x, y: u.y } : el;
          }),
        })),

      removeElements: (ids) =>
        set((s) => ({
          elements: s.elements.filter((el) => !ids.includes(el.id)),
          selectedIds: new Set([...s.selectedIds].filter((id) => !ids.includes(id))),
        })),

      selectElements: (ids) => set({ selectedIds: ids }),

      clearSelection: () => set({ selectedIds: new Set<string>() }),

      toggleInSelection: (id) =>
        set((s) => {
          const next = new Set(s.selectedIds);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return { selectedIds: next };
        }),

      addToSelection: (ids) =>
        set((s) => {
          const next = new Set(s.selectedIds);
          for (const id of ids) {
            next.add(id);
          }
          return { selectedIds: next };
        }),

      copySelection: () =>
        set((s) => {
          const selected = s.elements.filter((el) => s.selectedIds.has(el.id));
          return { clipboard: JSON.parse(JSON.stringify(selected)) };
        }),

      pasteClipboard: () =>
        set((s) => {
          if (s.clipboard.length === 0) return s;
          const pasted: FormElement[] = [];
          const newIds = new Set<string>();
          for (const el of s.clipboard) {
            const newEl = {
              ...JSON.parse(JSON.stringify(el)),
              id: generatePastedId(),
              x: el.x + PASTE_OFFSET,
              y: el.y + PASTE_OFFSET,
            } as FormElement;
            if ("name" in newEl) {
              const typed = newEl as FormElement & { name: string };
              typed.name = getUniqueName(
                typed.name,
                [...s.elements, ...pasted],
              );
            }
            pasted.push(newEl);
            newIds.add(newEl.id);
          }
          return {
            elements: [...s.elements, ...pasted],
            selectedIds: newIds,
          };
        }),
    }),
    {
      limit: 50,
      partialize: (state) => ({
        elements: state.elements,
      }),
    },
  ),
);

export function undo() {
  if (!useEditorStore.getState().pdfBytes) return;
  useEditorStore.temporal.getState().undo();
}

export function redo() {
  if (!useEditorStore.getState().pdfBytes) return;
  useEditorStore.temporal.getState().redo();
}

export function canUndo(): boolean {
  if (!useEditorStore.getState().pdfBytes) return false;
  return useEditorStore.temporal.getState().pastStates.length > 0;
}

export function canRedo(): boolean {
  if (!useEditorStore.getState().pdfBytes) return false;
  return useEditorStore.temporal.getState().futureStates.length > 0;
}
