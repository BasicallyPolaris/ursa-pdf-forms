import { create } from "zustand";
import { temporal } from "zundo";

export interface PageInfo {
  width: number;
  height: number;
  pageNumber: number;
}

interface EditorState {
  pdfFileName: string | null;
  pdfBytes: Uint8Array | null;
  pages: PageInfo[];
  zoom: number;
  activeTool: "select" | "text" | "checkbox" | "radio";
  sidebarCollapsed: boolean;

  setPdf: (fileName: string, bytes: Uint8Array, pages: PageInfo[]) => void;
  setZoom: (zoom: number) => void;
  setActiveTool: (tool: EditorState["activeTool"]) => void;
  toggleSidebar: () => void;
  clearPdf: () => void;
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

      setPdf: (fileName, bytes, pages) =>
        set({ pdfFileName: fileName, pdfBytes: bytes, pages }),

      setZoom: (zoom) => set({ zoom }),

      setActiveTool: (activeTool) => set({ activeTool }),

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      clearPdf: () =>
        set({ pdfFileName: null, pdfBytes: null, pages: [] }),
    }),
    {
      limit: 50,
      partialize: (state) => ({
        pdfFileName: state.pdfFileName,
        pdfBytes: state.pdfBytes,
        pages: state.pages,
        zoom: state.zoom,
      }),
    },
  ),
);
