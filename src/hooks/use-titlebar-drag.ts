import {
  getAppWindow,
  isTauriRuntime,
  runWindowAction,
} from "@/lib/tauri-window";
import { useCallback, type MouseEvent as ReactMouseEvent } from "react";

export function stopTitlebarDrag(e: ReactMouseEvent) {
  e.stopPropagation();
}

export function useTitlebarDrag() {
  return useCallback((e: ReactMouseEvent) => {
    if (e.button !== 0) return;
    if (!isTauriRuntime()) return;
    void runWindowAction(() => getAppWindow().startDragging(), "startDragging");
  }, []);
}
