import { useEffect } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { fileIO } from "@/lib/file-io";
import { useEditorStore } from "@/stores/editor-store";

function hasPdf(paths: string[] | undefined): boolean {
  return !!paths?.some((p: string) => p.toLowerCase().endsWith(".pdf"));
}

export function useFileDrop() {
  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      const payload = event.payload;

      if (payload.type === "enter") {
        if (hasPdf(payload.paths)) {
          useEditorStore.getState().setFileDragOver(true);
        }
        return;
      }

      if (payload.type === "over") {
        useEditorStore.getState().setFileDragOver(true);
        return;
      }

      if (payload.type === "leave") {
        useEditorStore.getState().setFileDragOver(false);
        return;
      }

      if (payload.type === "drop") {
        useEditorStore.getState().setFileDragOver(false);

        const paths = payload.paths;
        const pdfPath = paths.find((p: string) =>
          p.toLowerCase().endsWith(".pdf"),
        );
        if (!pdfPath) return;

        const load = async () => {
          const action = await fileIO.confirmUnsavedChanges();
          if (action === "cancel") return;
          await fileIO.loadPdfFromPath(pdfPath);
        };

        load();
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
}
