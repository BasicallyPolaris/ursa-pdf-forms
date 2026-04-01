import i18n from "@/i18n";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { exportFormElements } from "@/lib/pdf-export-engine";
import { useEditorStore } from "@/stores/editor-store";

export async function exportPdf(): Promise<string | null> {
  const { pdfBytes, elements } = useEditorStore.getState();
  if (!pdfBytes) return null;

  try {
    const resultBytes = await exportFormElements(pdfBytes, elements);

    const filePath = await save({
      filters: [{ name: i18n.t("file.pdfFilter"), extensions: ["pdf"] }],
      defaultPath: i18n.t("file.defaultExportName"),
    });

    if (!filePath) return null;

    await writeFile(filePath, resultBytes);
    return null;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : i18n.t("file.exportFailed");
    console.error("Export failed:", error);
    return message;
  }
}
