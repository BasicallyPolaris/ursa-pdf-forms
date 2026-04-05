import { useEffect } from "react";
import { redo, undo, useEditorStore } from "@/stores/editor-store";
import { fileIO } from "@/lib/file-io";
import { TOP_PADDING, PAGE_GAP } from "@/lib/coordinates";
import {
  computePageLayouts,
  findPageAtScreenPoint,
  getLayoutContentWidth,
} from "@/lib/page-layout";

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

let lastMouseX = 0;
let lastMouseY = 0;

function getMousePage(): number | null {
  const scrollEl = document.querySelector("[data-pdf-scroll-container]");
  if (!scrollEl) return null;
  const store = useEditorStore.getState();
  if (store.pages.length === 0) return null;
  const scrollRect = scrollEl.getBoundingClientRect();
  const relX = lastMouseX - scrollRect.left + scrollEl.scrollLeft;
  const relY = lastMouseY - scrollRect.top + scrollEl.scrollTop;
  const layoutWidth = getLayoutContentWidth(
    store.pages,
    store.zoom,
    scrollEl.clientWidth,
  );
  const layouts = computePageLayouts(
    store.pages,
    store.zoom,
    layoutWidth,
  );
  return findPageAtScreenPoint(relX, relY, layouts);
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
    const trackMouse = (e: MouseEvent) => {
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };
    document.addEventListener("mousemove", trackMouse);
    return () => document.removeEventListener("mousemove", trackMouse);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputElement(e)) return;

      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === "o") {
        e.preventDefault();
        fileIO.openPdf();
        return;
      }

      if (mod && e.key === "e") {
        e.preventDefault();
        fileIO.exportPdf();
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
        const mousePage = getMousePage();
        store.pasteClipboard(mousePage ?? getVisiblePage());
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
