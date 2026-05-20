import { fileIO } from "@/lib/file-io";
import { getPageAtViewportCenter } from "@/lib/page-layout";
import {
  type EditorState,
  redo,
  undo,
  useEditorStore,
} from "@/stores/editor-store";
import { useEffect, type RefObject } from "react";
import { useScrollContainerRef } from "@/contexts/scroll-container-context";

const TOOL_KEY_MAP: Record<string, string> = {
  v: "select",
  t: "input",
  c: "checkbox",
  r: "radio",
  d: "dropdown",
  b: "button",
};

const SHIFT_TOOL_KEY_MAP: Record<string, string> = {
  t: "textarea",
  o: "optionlist",
};

function isInputElement(e: KeyboardEvent): boolean {
  return (
    e.target instanceof HTMLElement &&
    ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)
  );
}

function getScrollContainer(
  scrollRef: RefObject<HTMLElement | null>,
): HTMLElement | null {
  return (
    scrollRef.current ??
    document.querySelector<HTMLElement>("[data-pdf-scroll-container]")
  );
}

export function useKeyboardShortcuts() {
  const scrollRef = useScrollContainerRef();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputElement(e)) return;

      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "o") {
        e.preventDefault();
        fileIO.openPdf();
        return;
      }

      if (mod && e.key.toLowerCase() === "e") {
        e.preventDefault();
        fileIO.exportPdf();
        return;
      }

      const store = useEditorStore.getState();
      if (!store.pdfBytes) return;

      if (mod && e.key.toLowerCase() === "c") {
        e.preventDefault();
        store.copySelection();
      }

      if (mod && e.key.toLowerCase() === "x") {
        e.preventDefault();
        store.cutSelection();
      }

      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const scrollEl = getScrollContainer(scrollRef);
        const { pages, zoom } = useEditorStore.getState();
        if (scrollEl) {
          const page = getPageAtViewportCenter(scrollEl, pages, zoom);
          if (page !== undefined) store.duplicateSelection(page);
        }
      }

      if (mod && e.key.toLowerCase() === "v") {
        e.preventDefault();
        const scrollEl = getScrollContainer(scrollRef);
        const { pages, zoom } = useEditorStore.getState();
        if (scrollEl) {
          const page = getPageAtViewportCenter(scrollEl, pages, zoom);
          if (page !== undefined) store.pasteClipboard(page);
        }
      }

      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      if (mod && e.key.toLowerCase() === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }

      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (store.selectedGuideId) {
          store.removeGuide(store.selectedGuideId);
        } else {
          const ids = [...store.selectedIds];
          if (ids.length > 0) {
            store.removeElements(ids);
          }
        }
      }

      if (e.key === "Escape") {
        store.clearSelection();
      }

      if (!mod && e.shiftKey) {
        const tool = SHIFT_TOOL_KEY_MAP[e.key.toLowerCase()];
        if (tool) {
          e.preventDefault();
          store.setActiveTool(tool as EditorState["activeTool"]);
          return;
        }
      }

      if (!mod && !e.shiftKey) {
        const tool = TOOL_KEY_MAP[e.key.toLowerCase()];
        if (tool) {
          e.preventDefault();
          store.setActiveTool(tool as EditorState["activeTool"]);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
