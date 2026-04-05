import { create } from "zustand";
import { temporal } from "zundo";
import { type FormElement, getUniqueName, type ActiveTool } from "@/lib/form-element-model";
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
  centerOnPageH,
  centerOnPageV,
  matchWidthToWidest,
  matchWidthToNarrowest,
  matchHeightToTallest,
  matchHeightToShortest,
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

const docResetFields = {
  elements: [] as FormElement[],
  selectedIds: new Set<string>(),
  clipboard: [] as FormElement[],
  guides: [] as GuideLine[],
  selectedGuideId: null as string | null,
  previewGuide: null as {
    orientation: "horizontal" | "vertical";
    position: number;
  } | null,
  dragLivePositions: new Map<
    string,
    { x: number; y: number; width: number; height: number }
  >(),
  activeTool: "select" as const,
};

function resetTemporalAndMarkClean() {
  useEditorStore.temporal.getState().clear();
  _lastSavedElementsJson = "[]";
  _lastSavedGuidesJson = "[]";
}

function cloneElementsWithNewIds(
  source: FormElement[],
  existing: FormElement[],
  offsetFn: (el: FormElement, index: number) => {
    x: number;
    y: number;
    pageNumber?: number;
  },
): { cloned: FormElement[]; newIds: Set<string> } {
  const cloned: FormElement[] = [];
  const newIds = new Set<string>();
  for (let i = 0; i < source.length; i++) {
    const el = source[i];
    const offset = offsetFn(el, i);
    const newEl = {
      ...structuredClone(el),
      id: generatePastedId(),
      pageNumber: offset.pageNumber ?? el.pageNumber,
      x: offset.x,
      y: offset.y,
    } as FormElement;
    if ("name" in newEl) {
      const typed = newEl as FormElement & { name: string };
      typed.name = getUniqueName(typed.name, [...existing, ...cloned]);
    }
    cloned.push(newEl);
    newIds.add(newEl.id);
  }
  return { cloned, newIds };
}

export interface GuideLine {
  id: string;
  orientation: "horizontal" | "vertical";
  position: number;
}

interface EditorState {
  pdfFileName: string | null;
  pdfBytes: Uint8Array | null;
  renderPdfBytes: Uint8Array | null;
  pages: PageInfo[];
  zoom: number;
  activeTool: ActiveTool;

  elements: FormElement[];
  selectedIds: Set<string>;
  clipboard: FormElement[];
  gridSize: number;
  guides: GuideLine[];
  previewGuide: {
    orientation: "horizontal" | "vertical";
    position: number;
  } | null;
  selectedGuideId: string | null;
  isFileDragOver: boolean;
  dragLivePositions: Map<
    string,
    { x: number; y: number; width: number; height: number }
  >;

  setPdf: (fileName: string, bytes: Uint8Array, pages: PageInfo[]) => void;
  setPdfPages: (pages: PageInfo[]) => void;
  setZoom: (zoom: number) => void;
  setActiveTool: (tool: EditorState["activeTool"]) => void;

  clearPdf: () => void;
  setRenderPdfBytes: (bytes: Uint8Array) => void;
  setInitialElements: (elements: FormElement[]) => void;
  addElement: (element: FormElement) => void;
  updateElement: (id: string, updates: Partial<FormElement>) => void;
  moveElements: (
    updates: Array<{ id: string; x: number; y: number; pageNumber?: number }>,
  ) => void;
  removeElements: (ids: string[]) => void;
  selectElements: (ids: Set<string>) => void;
  clearSelection: () => void;
  toggleInSelection: (id: string) => void;
  addToSelection: (ids: string[]) => void;
  copySelection: () => void;
  pasteClipboard: (
    targetPage?: number,
    targetX?: number,
    targetY?: number,
  ) => void;
  cutSelection: () => void;
  duplicateSelection: (targetPage?: number) => void;
  addGuide: (orientation: "horizontal" | "vertical", position: number) => void;
  removeGuide: (id: string) => void;
  updateGuidePosition: (id: string, position: number) => void;
  batchUpdateElements: (
    updates: Array<{ id: string; changes: Partial<FormElement> }>,
  ) => void;
  setPreviewGuide: (
    guide: { orientation: "horizontal" | "vertical"; position: number } | null,
  ) => void;
  selectGuide: (id: string | null) => void;
  setDragLivePositions: (
    positions: Map<
      string,
      { x: number; y: number; width: number; height: number }
    > | null,
  ) => void;
  alignElements: (
    type: "left" | "right" | "top" | "bottom" | "centerH" | "centerV",
  ) => void;
  distributeElements: (direction: "horizontal" | "vertical") => void;
  centerSelectionOnPage: () => void;
  centerSelectionOnPageH: () => void;
  centerSelectionOnPageV: () => void;
  matchElementSize: (
    type: "widthWidest" | "widthNarrowest" | "heightTallest" | "heightShortest",
  ) => void;
  setFileDragOver: (value: boolean) => void;
}

export const useEditorStore = create<EditorState>()(
  temporal(
    (set, get) => ({
      pdfFileName: null,
      pdfBytes: null,
      renderPdfBytes: null,
      pages: [],
      zoom: 1,
      activeTool: "select",

      elements: [],
      selectedIds: new Set<string>(),
      clipboard: [],
      gridSize: 5,
      guides: [],
      previewGuide: null,
      selectedGuideId: null,
      dragLivePositions: new Map(),
      isFileDragOver: false,

      setPdf: (fileName, bytes, pages) => {
        set({
          pdfFileName: fileName,
          pdfBytes: bytes,
          renderPdfBytes: null,
          pages,
          ...docResetFields,
        });
        resetTemporalAndMarkClean();
      },

      setPdfPages: (pages) => set({ pages }),

      setZoom: (zoom) => set({ zoom }),

      setActiveTool: (activeTool) => set({ activeTool }),

      clearPdf: () => {
        set({
          pdfFileName: null,
          pdfBytes: null,
          renderPdfBytes: null,
          pages: [],
          ...docResetFields,
        });
        resetTemporalAndMarkClean();
      },

      setRenderPdfBytes: (bytes) => set({ renderPdfBytes: bytes }),

      setInitialElements: (elements: FormElement[]) => {
        set({ elements });
        useEditorStore.temporal.getState().clear();
        _lastSavedElementsJson = JSON.stringify(elements);
        _lastSavedGuidesJson = "[]";
      },

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
            if (!u) return el;
            return u.pageNumber !== undefined && u.pageNumber !== el.pageNumber
              ? ({
                  ...el,
                  x: u.x,
                  y: u.y,
                  pageNumber: u.pageNumber,
                } as FormElement)
              : { ...el, x: u.x, y: u.y };
          }),
        })),

      removeElements: (ids) =>
        set((s) => ({
          elements: s.elements.filter((el) => !ids.includes(el.id)),
          selectedIds: new Set(
            [...s.selectedIds].filter((id) => !ids.includes(id)),
          ),
        })),

      selectElements: (ids) => set({ selectedIds: ids, selectedGuideId: null }),

      clearSelection: () =>
        set({
          selectedIds: new Set<string>(),
          selectedGuideId: null,
          dragLivePositions: new Map(),
        }),

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
          return { clipboard: structuredClone(selected) };
        }),

      pasteClipboard: (
        targetPage?: number,
        targetX?: number,
        targetY?: number,
      ) =>
        set((s) => {
          if (s.clipboard.length === 0) return s;
          const baseEl = s.clipboard[0];
          const offX = targetX !== undefined ? targetX - baseEl.x : 0;
          const offY = targetY !== undefined ? targetY - baseEl.y : 0;
          const { cloned, newIds } = cloneElementsWithNewIds(
            s.clipboard,
            s.elements,
            (el) => {
              const samePage =
                targetPage === undefined || targetPage === el.pageNumber;
              return {
                x: samePage ? el.x + (offX || PASTE_OFFSET) : el.x + (offX || 0),
                y: samePage ? el.y + (offY || PASTE_OFFSET) : el.y + (offY || 0),
                pageNumber: targetPage ?? el.pageNumber,
              };
            },
          );
          return {
            elements: [...s.elements, ...cloned],
            selectedIds: newIds,
          };
        }),

      cutSelection: () =>
        set((s) => {
          const selected = s.elements.filter((el) => s.selectedIds.has(el.id));
          if (selected.length === 0) return s;
          return {
            clipboard: structuredClone(selected),
            elements: s.elements.filter((el) => !s.selectedIds.has(el.id)),
            selectedIds: new Set<string>(),
          };
        }),

      duplicateSelection: (targetPage?: number) =>
        set((s) => {
          const selected = s.elements.filter((el) => s.selectedIds.has(el.id));
          if (selected.length === 0) return s;
          const { cloned, newIds } = cloneElementsWithNewIds(
            selected,
            s.elements,
            (el) => {
              const samePage =
                targetPage === undefined || targetPage === el.pageNumber;
              return {
                x: samePage ? el.x + PASTE_OFFSET : el.x,
                y: samePage ? el.y + PASTE_OFFSET : el.y,
                pageNumber: samePage ? el.pageNumber : targetPage,
              };
            },
          );
          return {
            elements: [...s.elements, ...cloned],
            selectedIds: newIds,
          };
        }),

      addGuide: (orientation, position) =>
        set((s) => ({
          guides: [
            ...s.guides,
            { id: generateGuideId(), orientation, position },
          ],
        })),

      removeGuide: (id) =>
        set((s) => ({
          guides: s.guides.filter((g) => g.id !== id),
          selectedGuideId: s.selectedGuideId === id ? null : s.selectedGuideId,
        })),

      updateGuidePosition: (id, position) =>
        set((s) => ({
          guides: s.guides.map((g) => (g.id === id ? { ...g, position } : g)),
        })),

      batchUpdateElements: (
        updates: Array<{ id: string; changes: Partial<FormElement> }>,
      ) =>
        set((s) => ({
          elements: s.elements.map((el) => {
            const u = updates.find((u) => u.id === el.id);
            return u
              ? ({ ...el, ...u.changes } as FormElement)
              : el;
          }),
        })),

      setPreviewGuide: (guide) => set({ previewGuide: guide }),

      selectGuide: (id) =>
        set({ selectedGuideId: id, selectedIds: new Set<string>() }),

      setDragLivePositions: (positions) =>
        set({ dragLivePositions: positions ?? new Map() }),

      alignElements: (type) => {
        const state = get();
        if (state.selectedIds.size < 2) return;
        let updates: Array<{ id: string; x: number; y: number }> = [];
        switch (type) {
          case "left":
            updates = alignLeft(state.elements, state.selectedIds);
            break;
          case "right":
            updates = alignRight(state.elements, state.selectedIds);
            break;
          case "top":
            updates = alignTop(state.elements, state.selectedIds);
            break;
          case "bottom":
            updates = alignBottom(state.elements, state.selectedIds);
            break;
          case "centerH":
            updates = alignCenterH(state.elements, state.selectedIds);
            break;
          case "centerV":
            updates = alignCenterV(state.elements, state.selectedIds);
            break;
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
        const updates =
          direction === "horizontal"
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
        const updates = centerOnPage(
          state.elements,
          state.selectedIds,
          page.width,
          page.height,
        );
        if (updates.length > 0) {
          set((s) => ({
            elements: s.elements.map((el) => {
              const u = updates.find((u) => u.id === el.id);
              return u ? { ...el, x: u.x, y: u.y } : el;
            }),
          }));
        }
      },

      centerSelectionOnPageH: () => {
        const state = get();
        if (state.selectedIds.size === 0 || state.pages.length === 0) return;
        const page = state.pages[0];
        const updates = centerOnPageH(
          state.elements,
          state.selectedIds,
          page.width,
        );
        if (updates.length > 0) {
          set((s) => ({
            elements: s.elements.map((el) => {
              const u = updates.find((u) => u.id === el.id);
              return u ? { ...el, x: u.x, y: u.y } : el;
            }),
          }));
        }
      },

      centerSelectionOnPageV: () => {
        const state = get();
        if (state.selectedIds.size === 0 || state.pages.length === 0) return;
        const page = state.pages[0];
        const updates = centerOnPageV(
          state.elements,
          state.selectedIds,
          page.height,
        );
        if (updates.length > 0) {
          set((s) => ({
            elements: s.elements.map((el) => {
              const u = updates.find((u) => u.id === el.id);
              return u ? { ...el, x: u.x, y: u.y } : el;
            }),
          }));
        }
      },

      setFileDragOver: (value) => set({ isFileDragOver: value }),

      matchElementSize: (type) => {
        const state = get();
        if (state.selectedIds.size < 2) return;
        let updates: Array<{ id: string; width?: number; height?: number }> =
          [];
        switch (type) {
          case "widthWidest":
            updates = matchWidthToWidest(state.elements, state.selectedIds);
            break;
          case "widthNarrowest":
            updates = matchWidthToNarrowest(state.elements, state.selectedIds);
            break;
          case "heightTallest":
            updates = matchHeightToTallest(state.elements, state.selectedIds);
            break;
          case "heightShortest":
            updates = matchHeightToShortest(state.elements, state.selectedIds);
            break;
        }
        if (updates.length > 0) {
          set((s) => ({
            elements: s.elements.map((el) => {
              const u = updates.find((u) => u.id === el.id);
              if (!u) return el;
              const heightLocked =
                el.type === "text" &&
                !(el as import("@/lib/form-element-model").TextField).multiline;
              return {
                ...el,
                ...("width" in u ? { width: u.width } : {}),
                ...("height" in u && !heightLocked ? { height: u.height } : {}),
              };
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
      }),
      equality: (pastState, currentState) =>
        pastState.elements === currentState.elements &&
        pastState.guides === currentState.guides,
    },
  ),
);

function pruneSelectionAfterUndoRedo() {
  const state = useEditorStore.getState();
  const validIds = new Set(state.elements.map((e) => e.id));
  const current = state.selectedIds;
  const pruned = new Set([...current].filter((id) => validIds.has(id)));
  if (pruned.size !== current.size) {
    useEditorStore.setState({ selectedIds: pruned });
  }
}

export function undo() {
  if (!useEditorStore.getState().pdfBytes) return;
  useEditorStore.temporal.getState().undo();
  pruneSelectionAfterUndoRedo();
}

export function redo() {
  if (!useEditorStore.getState().pdfBytes) return;
  useEditorStore.temporal.getState().redo();
  pruneSelectionAfterUndoRedo();
}

export function canUndo(): boolean {
  if (!useEditorStore.getState().pdfBytes) return false;
  return useEditorStore.temporal.getState().pastStates.length > 0;
}

export function canRedo(): boolean {
  if (!useEditorStore.getState().pdfBytes) return false;
  return useEditorStore.temporal.getState().futureStates.length > 0;
}

let _lastSavedElementsJson: string = "[]";
let _lastSavedGuidesJson: string = "[]";

export function isDirty(): boolean {
  const state = useEditorStore.getState();
  if (!state.pdfBytes) return false;
  return (
    JSON.stringify(state.elements) !== _lastSavedElementsJson ||
    JSON.stringify(state.guides) !== _lastSavedGuidesJson
  );
}

export function markClean(): void {
  const state = useEditorStore.getState();
  _lastSavedElementsJson = JSON.stringify(state.elements);
  _lastSavedGuidesJson = JSON.stringify(state.guides);
}

export const selectEffectivePdfBytes = (s: EditorState) =>
  s.renderPdfBytes ?? s.pdfBytes;
