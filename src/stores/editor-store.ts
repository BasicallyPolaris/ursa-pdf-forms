import { create } from "zustand";
import { temporal } from "zundo";
import type { FormElement } from "@/lib/form-element-model";
import type { PageInfo } from "@/lib/pdf-loader";

export type { PageInfo };

interface EditorState {
  pdfFileName: string | null;
  pdfBytes: Uint8Array | null;
  pages: PageInfo[];
  zoom: number;
  activeTool: "select" | "text";
  sidebarCollapsed: boolean;
  elements: FormElement[];
  selectedIds: Set<string>;

  setPdf: (fileName: string, bytes: Uint8Array, pages: PageInfo[]) => void;
  setZoom: (zoom: number) => void;
  setActiveTool: (tool: EditorState["activeTool"]) => void;
  toggleSidebar: () => void;
  clearPdf: () => void;
  addElement: (element: FormElement) => void;
  updateElement: (id: string, updates: Partial<FormElement>) => void;
  removeElements: (ids: string[]) => void;
  selectElements: (ids: Set<string>) => void;
  clearSelection: () => void;
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

      removeElements: (ids) =>
        set((s) => ({
          elements: s.elements.filter((el) => !ids.includes(el.id)),
          selectedIds: new Set([...s.selectedIds].filter((id) => !ids.includes(id))),
        })),

      selectElements: (ids) => set({ selectedIds: ids }),

      clearSelection: () => set({ selectedIds: new Set<string>() }),
    }),
    {
      limit: 50,
      partialize: (state) => ({
        pdfFileName: state.pdfFileName,
        pdfBytes: state.pdfBytes,
        pages: state.pages,
        zoom: state.zoom,
        elements: state.elements,
      }),
    },
  ),
);
