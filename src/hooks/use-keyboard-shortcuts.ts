import { useEffect } from "react";
import { useEditorStore, undo, redo } from "@/stores/editor-store";

function isInputElement(e: KeyboardEvent): boolean {
  return (
    e.target instanceof HTMLElement &&
    ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)
  );
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputElement(e)) return;

      const store = useEditorStore.getState();
      if (!store.pdfBytes) return;

      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === "c") {
        e.preventDefault();
        store.copySelection();
      }

      if (mod && e.key === "v") {
        e.preventDefault();
        store.pasteClipboard();
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
        const ids = [...store.selectedIds];
        if (ids.length > 0) {
          store.removeElements(ids);
        }
      }

      if (e.key === "Escape") {
        store.clearSelection();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
