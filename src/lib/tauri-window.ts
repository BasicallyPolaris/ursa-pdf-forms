import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function getAppWindow() {
  return getCurrentWebviewWindow();
}

export async function runWindowAction(
  action: () => Promise<void>,
  label: string,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    console.error(`[window] ${label} failed:`, error);
  }
}
