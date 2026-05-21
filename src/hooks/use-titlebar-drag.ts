import {
  getAppWindow,
  isTauriRuntime,
  runWindowAction,
} from "@/lib/tauri-window";
import { useCallback } from "react";

const TITLEBAR_DRAG_BLOCKER =
  'button, a, input, textarea, select, [data-slot="dropdown-menu-trigger"]';

export function useTitlebarDrag() {
  return useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (!isTauriRuntime()) return;
    if ((e.target as HTMLElement).closest(TITLEBAR_DRAG_BLOCKER)) return;
    void runWindowAction(() => getAppWindow().startDragging(), "startDragging");
  }, []);
}
