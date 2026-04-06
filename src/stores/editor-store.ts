import {
  alignBottom,
  alignCenterH,
  alignCenterV,
  alignLeft,
  alignRight,
  alignTop,
  centerOnPage,
  centerOnPageH,
  centerOnPageV,
  distributeH,
  distributeV,
  matchHeightToShortest,
  matchHeightToTallest,
  matchWidthToNarrowest,
  matchWidthToWidest,
} from "@/lib/alignment";
import { type FormElement, getUniqueName } from "@/lib/form-element-model";
import type { PageInfo } from "@/lib/pdf-loader";
import { temporal } from "zundo";
import { create } from "zustand";

function applyPositionUpdates(
  elements: FormElement[],
  updates: Array<{ id: string; x: number; y: number }>,
): FormElement[] {
  const map = new Map(updates.map((u) => [u.id, u]));
  return elements.map((el) => {
    const u = map.get(el.id);
    return u ? { ...el, x: u.x, y: u.y } : el;
  });
}

function mergeElement(
  el: FormElement,
  updates: Partial<FormElement>,
): FormElement {
  return { ...el, ...updates } as FormElement;
}

function cloneElementsWithNewIds(
  sources: FormElement[],
  existing: FormElement[],
  opts: {
    targetPage?: number;
    targetX?: number;
    targetY?: number;
    offsetIfSamePage: number;
  },
): { cloned: FormElement[]; newIds: Set<string> } {
  const cloned: FormElement[] = [];
  const newIds = new Set<string>();
  const baseEl = sources[0];
  const offX = opts.targetX !== undefined ? opts.targetX - baseEl.x : 0;
  const offY = opts.targetY !== undefined ? opts.targetY - baseEl.y : 0;

  for (const el of sources) {
    const samePage =
      opts.targetPage === undefined || opts.targetPage === el.pageNumber;
    const newX = samePage
      ? el.x + (offX || opts.offsetIfSamePage)
      : el.x + (offX || 0);
    const newY = samePage
      ? el.y + (offY || opts.offsetIfSamePage)
      : el.y + (offY || 0);
    const clone = structuredClone(el);
    const newEl = mergeElement(clone, {
      id: generatePastedId(),
      pageNumber: opts.targetPage ?? el.pageNumber,
      x: newX,
      y: newY,
    });
    if ("name" in newEl) {
      (newEl as FormElement & { name: string }).name = getUniqueName(
        (newEl as FormElement & { name: string }).name,
        [...existing, ...cloned],
      );
    }
    cloned.push(newEl);
    newIds.add(newEl.id);
  }
  return { cloned, newIds };
}

const PDF_RESET_STATE = {
  pdfFileName: null as string | null,
  pdfBytes: null as Uint8Array | null,
  renderPdfBytes: null as Uint8Array | null,
  pages: [] as PageInfo[],
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
  activeTool: "select" as EditorState["activeTool"],
};

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

export interface EditorState {
  pdfFileName: string | null;
  pdfBytes: Uint8Array | null;
  renderPdfBytes: Uint8Array | null;
  pages: PageInfo[];
  zoom: number;
  activeTool:
    | "select"
    | "input"
    | "textarea"
    | "checkbox"
    | "radio"
    | "dropdown"
    | "button"
    | "optionlist";
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
  isDragFileValid: boolean;
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
  setDragFileValid: (valid: boolean) => void;
}

function guidesEqual(a: GuideLine[], b: GuideLine[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    if (
      a[i].id !== b[i].id ||
      a[i].orientation !== b[i].orientation ||
      a[i].position !== b[i].position
    )
      return false;
  }
  return true;
}

function elementsEqual(a: FormElement[], b: FormElement[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ae = a[i];
    const be = b[i];
    if (ae === be) continue;
    if (ae.id !== be.id) return false;
    const keysA = Object.keys(ae) as (keyof FormElement)[];
    const keysB = Object.keys(be) as (keyof FormElement)[];
    if (keysA.length !== keysB.length) return false;
    for (const k of keysA) {
      const va = ae[k];
      const vb = be[k];
      if (va === vb) continue;
      if (Array.isArray(va) && Array.isArray(vb)) {
        if (va.length !== vb.length) return false;
        for (let j = 0; j < va.length; j++) {
          if (va[j] !== vb[j]) return false;
        }
        continue;
      }
      return false;
    }
  }
  return true;
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
      isDragFileValid: false,

      setPdf: (fileName, bytes, pages) => {
        set({
          ...PDF_RESET_STATE,
          pdfFileName: fileName,
          pdfBytes: bytes,
          pages,
        });
        useEditorStore.temporal.getState().clear();
        _mutationVersion++;
        _savedVersion = _mutationVersion;
      },

      setPdfPages: (pages) => set({ pages }),

      setZoom: (zoom) => set({ zoom }),

      setActiveTool: (activeTool) => set({ activeTool }),

      clearPdf: () => {
        set(PDF_RESET_STATE);
        useEditorStore.temporal.getState().clear();
        _mutationVersion++;
        _savedVersion = _mutationVersion;
      },

      setRenderPdfBytes: (bytes) => set({ renderPdfBytes: bytes }),

      setInitialElements: (elements: FormElement[]) => {
        set({ elements });
        useEditorStore.temporal.getState().clear();
        _mutationVersion++;
        _savedVersion = _mutationVersion;
      },

      addElement: (element) => {
        _mutationVersion++;
        set((s) => ({ elements: [...s.elements, element] }));
      },

      updateElement: (id, updates) => {
        set((s) => {
          const el = s.elements.find((e) => e.id === id);
          if (!el) return s;
          const changed = (Object.keys(updates) as (keyof FormElement)[]).some(
            (k) => el[k] !== updates[k],
          );
          if (!changed) return s;
          _mutationVersion++;
          return {
            elements: s.elements.map((e) =>
              e.id === id ? mergeElement(el, updates) : e,
            ),
          };
        });
      },

      moveElements: (updates) => {
        set((s) => {
          const changed = updates.some((u) => {
            const el = s.elements.find((e) => e.id === u.id);
            if (!el) return false;
            return (
              el.x !== u.x ||
              el.y !== u.y ||
              (u.pageNumber !== undefined && u.pageNumber !== el.pageNumber)
            );
          });
          if (!changed) return s;
          _mutationVersion++;
          const map = new Map(updates.map((u) => [u.id, u]));
          return {
            elements: s.elements.map((el) => {
              const u = map.get(el.id);
              if (!u) return el;
              return u.pageNumber !== undefined &&
                u.pageNumber !== el.pageNumber
                ? mergeElement(el, { x: u.x, y: u.y, pageNumber: u.pageNumber })
                : { ...el, x: u.x, y: u.y };
            }),
          };
        });
      },

      removeElements: (ids) => {
        set((s) => {
          const remaining = s.elements.filter((el) => !ids.includes(el.id));
          if (remaining.length === s.elements.length) return s;
          _mutationVersion++;
          return {
            elements: remaining,
            selectedIds: new Set(
              [...s.selectedIds].filter((id) => !ids.includes(id)),
            ),
          };
        });
      },

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
      ) => {
        _mutationVersion++;
        set((s) => {
          if (s.clipboard.length === 0) return s;
          const { cloned, newIds } = cloneElementsWithNewIds(
            s.clipboard,
            s.elements,
            {
              targetPage,
              targetX,
              targetY,
              offsetIfSamePage: PASTE_OFFSET,
            },
          );
          return {
            elements: [...s.elements, ...cloned],
            selectedIds: newIds,
          };
        });
      },

      cutSelection: () => {
        _mutationVersion++;
        set((s) => {
          const selected = s.elements.filter((el) => s.selectedIds.has(el.id));
          if (selected.length === 0) return s;
          return {
            clipboard: structuredClone(selected),
            elements: s.elements.filter((el) => !s.selectedIds.has(el.id)),
            selectedIds: new Set<string>(),
          };
        });
      },

      duplicateSelection: (targetPage?: number) => {
        _mutationVersion++;
        set((s) => {
          const selected = s.elements.filter((el) => s.selectedIds.has(el.id));
          if (selected.length === 0) return s;
          const { cloned, newIds } = cloneElementsWithNewIds(
            selected,
            s.elements,
            {
              targetPage,
              offsetIfSamePage: PASTE_OFFSET,
            },
          );
          return {
            elements: [...s.elements, ...cloned],
            selectedIds: newIds,
          };
        });
      },

      addGuide: (orientation, position) => {
        _mutationVersion++;
        set((s) => ({
          guides: [
            ...s.guides,
            { id: generateGuideId(), orientation, position },
          ],
        }));
      },

      removeGuide: (id) => {
        set((s) => {
          const remaining = s.guides.filter((g) => g.id !== id);
          if (remaining.length === s.guides.length) return s;
          _mutationVersion++;
          return {
            guides: remaining,
            selectedGuideId:
              s.selectedGuideId === id ? null : s.selectedGuideId,
          };
        });
      },

      updateGuidePosition: (id, position) => {
        set((s) => {
          const guide = s.guides.find((g) => g.id === id);
          if (!guide || guide.position === position) return s;
          _mutationVersion++;
          return {
            guides: s.guides.map((g) =>
              g.id === id ? { ...g, position } : g,
            ),
          };
        });
      },

      batchUpdateElements: (
        updates: Array<{ id: string; changes: Partial<FormElement> }>,
      ) => {
        set((s) => {
          const map = new Map(updates.map((u) => [u.id, u.changes]));
          let anyChanged = false;
          const newElements = s.elements.map((el) => {
            const changes = map.get(el.id);
            if (!changes) return el;
            const changed = (Object.keys(changes) as (keyof FormElement)[]).some(
              (k) => el[k] !== changes[k],
            );
            if (!changed) return el;
            anyChanged = true;
            return mergeElement(el, changes);
          });
          if (!anyChanged) return s;
          _mutationVersion++;
          return { elements: newElements };
        });
      },

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
          _mutationVersion++;
          set((s) => ({ elements: applyPositionUpdates(s.elements, updates) }));
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
          _mutationVersion++;
          set((s) => ({ elements: applyPositionUpdates(s.elements, updates) }));
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
          _mutationVersion++;
          set((s) => ({ elements: applyPositionUpdates(s.elements, updates) }));
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
          _mutationVersion++;
          set((s) => ({ elements: applyPositionUpdates(s.elements, updates) }));
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
          _mutationVersion++;
          set((s) => ({ elements: applyPositionUpdates(s.elements, updates) }));
        }
      },

      setFileDragOver: (value) => set({ isFileDragOver: value }),

      setDragFileValid: (valid) => set({ isDragFileValid: valid }),

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
          _mutationVersion++;
          const map = new Map(updates.map((u) => [u.id, u]));
          set((s) => ({
            elements: s.elements.map((el) => {
              const u = map.get(el.id);
              if (!u) return el;
              const heightLocked =
                el.type === "text" &&
                !(el as import("@/lib/form-element-model").TextField).multiline;
              return {
                ...el,
                ...(u.width !== undefined ? { width: u.width } : {}),
                ...(u.height !== undefined && !heightLocked
                  ? { height: u.height }
                  : {}),
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
        elementsEqual(pastState.elements, currentState.elements) &&
        guidesEqual(pastState.guides, currentState.guides),
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
  _mutationVersion++;
  pruneSelectionAfterUndoRedo();
}

export function redo() {
  if (!useEditorStore.getState().pdfBytes) return;
  useEditorStore.temporal.getState().redo();
  _mutationVersion++;
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

let _mutationVersion = 0;
let _savedVersion = 0;

export function isDirty(): boolean {
  const state = useEditorStore.getState();
  if (!state.pdfBytes) return false;
  return _mutationVersion !== _savedVersion;
}

export function markClean(): void {
  _savedVersion = _mutationVersion;
}
