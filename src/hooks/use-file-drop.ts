import { useEffect } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { readFile } from "@tauri-apps/plugin-fs";
import { extractFileName, loadPdfIntoStore } from "@/lib/file-operations";
import { confirmUnsavedChanges } from "@/lib/unsaved-guard";
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
          const action = await confirmUnsavedChanges();
          if (action === "cancel") return;

          const bytes = await readFile(pdfPath);
          const fileName = extractFileName(pdfPath, "document.pdf");
          const pdfBytes = new Uint8Array(bytes);
          await loadPdfIntoStore(pdfBytes, fileName);
        };

        load();
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
}
