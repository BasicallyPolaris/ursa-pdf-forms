import { useEffect } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { readFile } from "@tauri-apps/plugin-fs";
import { useEditorStore } from "@/stores/editor-store";

export function useFileDrop() {
  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type !== "drop") return;

      const paths = event.payload.paths;
      const pdfPath = paths.find((p: string) => p.toLowerCase().endsWith(".pdf"));

      if (!pdfPath) return;

      const load = async () => {
        const bytes = await readFile(pdfPath);
        const fileName = pdfPath.split(/[/\\]/).pop() ?? "document.pdf";
        useEditorStore.getState().setPdf(fileName, new Uint8Array(bytes), []);
      };

      load();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
}
