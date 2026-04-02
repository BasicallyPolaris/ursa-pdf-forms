import { useEffect } from "react";
import { useEditorStore, undo, redo } from "@/stores/editor-store";
import { openPdfFile, saveProjectFile } from "@/lib/file-operations";
import { exportPdf } from "@/lib/export-pdf";
import { TOP_PADDING, PAGE_GAP } from "@/lib/coordinates";

const TOOL_KEY_MAP: Record<string, string> = {
  v: "select",
  t: "input",
  c: "checkbox",
  r: "radio",
};

function isInputElement(e: KeyboardEvent): boolean {
  return (
    e.target instanceof HTMLElement &&
    ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)
  );
}

function getVisiblePage(): number | undefined {
  const scrollEl = document.querySelector("[data-pdf-scroll-container]");
  if (!scrollEl) return undefined;
  const store = useEditorStore.getState();
  if (store.pages.length === 0) return undefined;
  const scrollCenter = scrollEl.scrollTop + scrollEl.clientHeight / 2;
  const zoom = store.zoom;
  let closestPage = 1;
  let closestDist = Infinity;
  let yOffset = TOP_PADDING;
  for (const page of store.pages) {
    const pageScreenHeight = page.height * zoom;
    const pageCenter = yOffset + pageScreenHeight / 2;
    const dist = Math.abs(pageCenter - scrollCenter);
    if (dist < closestDist) {
      closestDist = dist;
      closestPage = page.pageNumber;
    }
    yOffset += pageScreenHeight + PAGE_GAP;
  }
  return closestPage;
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputElement(e)) return;

      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === "o") {
        e.preventDefault();
        openPdfFile();
        return;
      }

      if (mod && e.key === "s") {
        e.preventDefault();
        saveProjectFile();
        return;
      }

      if (mod && e.key === "e") {
        e.preventDefault();
        exportPdf();
        return;
      }

      const store = useEditorStore.getState();
      if (!store.pdfBytes) return;

      if (mod && e.key === "c") {
        e.preventDefault();
        store.copySelection();
      }

      if (mod && e.key === "x") {
        e.preventDefault();
        store.cutSelection();
      }

      if (mod && e.key === "d") {
        e.preventDefault();
        store.duplicateSelection(getVisiblePage());
      }

      if (mod && e.key === "v") {
        e.preventDefault();
        store.pasteClipboard(getVisiblePage());
      }

      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      if (mod && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }

      if (mod && e.key === "y") {
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

      if (!mod && e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        store.setActiveTool("textarea");
        return;
      }

      if (!mod && !e.shiftKey) {
        const tool = TOOL_KEY_MAP[e.key.toLowerCase()];
        if (tool) {
          e.preventDefault();
          store.setActiveTool(tool as "select" | "input" | "checkbox" | "radio");
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
