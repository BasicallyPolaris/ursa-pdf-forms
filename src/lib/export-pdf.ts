import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { exportFormElements } from "@/lib/pdf-export-engine";
import { useEditorStore } from "@/stores/editor-store";

export async function exportPdf() {
  const { pdfBytes, elements } = useEditorStore.getState();
  if (!pdfBytes) return;

  try {
    const resultBytes = await exportFormElements(pdfBytes, elements);

    const filePath = await save({
      filters: [{ name: "PDF", extensions: ["pdf"] }],
      defaultPath: "form-output.pdf",
    });

    if (!filePath) return;

    await writeFile(filePath, resultBytes);
  } catch (error) {
    console.error("Export failed:", error);
  }
}
