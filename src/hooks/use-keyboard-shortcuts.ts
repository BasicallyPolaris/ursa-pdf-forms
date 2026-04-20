import { PAGE_GAP, V_PADDING } from "@/lib/coordinates";
import { fileIO } from "@/lib/file-io";
import {
  computePageLayouts,
  findPageAtScreenPoint,
  getLayoutContentWidth,
} from "@/lib/page-layout";
import {
  type EditorState,
  redo,
  undo,
  useEditorStore,
} from "@/stores/editor-store";
import { useEffect } from "react";
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

let lastMouseX = 0;
let lastMouseY = 0;

function getMousePage(scrollEl: HTMLElement): number | null {
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
  const layouts = computePageLayouts(store.pages, store.zoom, layoutWidth);
  return findPageAtScreenPoint(relX, relY, layouts);
}

function getVisiblePage(scrollEl: HTMLElement): number | undefined {
  const store = useEditorStore.getState();
  if (store.pages.length === 0) return undefined;
  const scrollCenter = scrollEl.scrollTop + scrollEl.clientHeight / 2;
  const zoom = store.zoom;
  let closestPage = 1;
  let closestDist = Infinity;
  let yOffset = V_PADDING;
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
  const scrollRef = useScrollContainerRef();

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
        const scrollEl = scrollRef.current;
        if (scrollEl) store.duplicateSelection(getVisiblePage(scrollEl));
      }

      if (mod && e.key.toLowerCase() === "v") {
        e.preventDefault();
        const scrollEl = scrollRef.current;
        const mousePage = scrollEl ? getMousePage(scrollEl) : null;
        store.pasteClipboard(mousePage ?? (scrollEl ? getVisiblePage(scrollEl) : undefined));
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
