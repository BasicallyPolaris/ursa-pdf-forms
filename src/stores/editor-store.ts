import { create } from "zustand";
import { temporal } from "zundo";
import {
  type FormElement,
  getUniqueName,
} from "@/lib/form-element-model";
import type { PageInfo } from "@/lib/pdf-loader";
import {
  alignLeft,
  alignRight,
  alignTop,
  alignBottom,
  alignCenterH,
  alignCenterV,
  distributeH,
  distributeV,
  centerOnPage,
} from "@/lib/alignment";

export type { PageInfo };

let nextPasteId = 1;
function generatePastedId(): string {
  return `el_paste_${nextPasteId++}_${Date.now().toString(36)}`;
}

let nextGuideId = 1;
function generateGuideId(): string {
  return `guide_${nextGuideId++}_${Date.now().toString(36)}`;
}

const PASTE_OFFSET = 10;

export interface GuideLine {
  id: string;
  orientation: "horizontal" | "vertical";
  position: number;
}

interface EditorState {
  pdfFileName: string | null;
  pdfBytes: Uint8Array | null;
  pages: PageInfo[];
  zoom: number;
  activeTool: "select" | "input" | "textarea" | "checkbox" | "radio";

  elements: FormElement[];
  selectedIds: Set<string>;
  clipboard: FormElement[];
  gridEnabled: boolean;
  gridSize: number;
  showGrid: boolean;
  guides: GuideLine[];
  previewGuide: { orientation: "horizontal" | "vertical"; position: number } | null;

  setPdf: (fileName: string, bytes: Uint8Array, pages: PageInfo[]) => void;
  setZoom: (zoom: number) => void;
  setActiveTool: (tool: EditorState["activeTool"]) => void;

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
  toggleGrid: () => void;
  setGridSize: (size: number) => void;
  toggleShowGrid: () => void;
  addGuide: (orientation: "horizontal" | "vertical", position: number) => void;
  removeGuide: (id: string) => void;
  updateGuidePosition: (id: string, position: number) => void;
  setPreviewGuide: (guide: { orientation: "horizontal" | "vertical"; position: number } | null) => void;
  alignElements: (type: "left" | "right" | "top" | "bottom" | "centerH" | "centerV") => void;
  distributeElements: (direction: "horizontal" | "vertical") => void;
  centerSelectionOnPage: () => void;
}

export const useEditorStore = create<EditorState>()(
  temporal(
    (set, get) => ({
      pdfFileName: null,
      pdfBytes: null,
      pages: [],
      zoom: 1,
      activeTool: "select",

      elements: [],
      selectedIds: new Set<string>(),
      clipboard: [],
      gridEnabled: true,
      gridSize: 10,
      showGrid: true,
      guides: [],
      previewGuide: null,

      setPdf: (fileName, bytes, pages) =>
        set({ pdfFileName: fileName, pdfBytes: bytes, pages }),

      setZoom: (zoom) => set({ zoom }),

      setActiveTool: (activeTool) => set({ activeTool }),


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

      toggleGrid: () => set((s) => ({ gridEnabled: !s.gridEnabled })),

      setGridSize: (size) => set({ gridSize: size }),

      toggleShowGrid: () => set((s) => ({ showGrid: !s.showGrid })),

      addGuide: (orientation, position) =>
        set((s) => ({
          guides: [...s.guides, { id: generateGuideId(), orientation, position }],
        })),

      removeGuide: (id) =>
        set((s) => ({ guides: s.guides.filter((g) => g.id !== id) })),

      updateGuidePosition: (id, position) =>
        set((s) => ({
          guides: s.guides.map((g) => (g.id === id ? { ...g, position } : g)),
        })),

      setPreviewGuide: (guide) => set({ previewGuide: guide }),

      alignElements: (type) => {
        const state = get();
        if (state.selectedIds.size < 2) return;
        let updates: Array<{ id: string; x: number; y: number }> = [];
        switch (type) {
          case "left": updates = alignLeft(state.elements, state.selectedIds); break;
          case "right": updates = alignRight(state.elements, state.selectedIds); break;
          case "top": updates = alignTop(state.elements, state.selectedIds); break;
          case "bottom": updates = alignBottom(state.elements, state.selectedIds); break;
          case "centerH": updates = alignCenterH(state.elements, state.selectedIds); break;
          case "centerV": updates = alignCenterV(state.elements, state.selectedIds); break;
        }
        if (updates.length > 0) {
          set((s) => ({
            elements: s.elements.map((el) => {
              const u = updates.find((u) => u.id === el.id);
              return u ? { ...el, x: u.x, y: u.y } : el;
            }),
          }));
        }
      },

      distributeElements: (direction) => {
        const state = get();
        if (state.selectedIds.size < 3) return;
        const updates = direction === "horizontal"
          ? distributeH(state.elements, state.selectedIds)
          : distributeV(state.elements, state.selectedIds);
        if (updates.length > 0) {
          set((s) => ({
            elements: s.elements.map((el) => {
              const u = updates.find((u) => u.id === el.id);
              return u ? { ...el, x: u.x, y: u.y } : el;
            }),
          }));
        }
      },

      centerSelectionOnPage: () => {
        const state = get();
        if (state.selectedIds.size === 0 || state.pages.length === 0) return;
        const page = state.pages[0];
        const updates = centerOnPage(state.elements, state.selectedIds, page.width, page.height);
        if (updates.length > 0) {
          set((s) => ({
            elements: s.elements.map((el) => {
              const u = updates.find((u) => u.id === el.id);
              return u ? { ...el, x: u.x, y: u.y } : el;
            }),
          }));
        }
      },
    }),
    {
      limit: 50,
      partialize: (state) => ({
        elements: state.elements,
        guides: state.guides,
        gridEnabled: state.gridEnabled,
        gridSize: state.gridSize,
        showGrid: state.showGrid,
      }),
      equality: (pastState, currentState) =>
        pastState.elements === currentState.elements &&
        pastState.guides === currentState.guides &&
        pastState.gridEnabled === currentState.gridEnabled &&
        pastState.gridSize === currentState.gridSize &&
        pastState.showGrid === currentState.showGrid,
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
