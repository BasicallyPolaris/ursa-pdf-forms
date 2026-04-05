import { message } from "@tauri-apps/plugin-dialog";
import i18n from "@/i18n";
import { isDirty, markClean } from "@/stores/editor-store";
import { exportPdf } from "@/lib/export-pdf";

export type UnsavedAction = "save" | "discard" | "cancel";

export async function confirmUnsavedChanges(): Promise<UnsavedAction> {
  if (!isDirty()) return "discard";

  try {
    const result = await message(
      i18n.t("dialog.unsavedChanges"),
      {
        title: i18n.t("dialog.unsavedTitle"),
        kind: "warning",
        buttons: {
          yes: i18n.t("dialog.save"),
          no: i18n.t("dialog.discard"),
          cancel: i18n.t("dialog.cancel"),
        },
      },
    );

    if (result === "Yes" || result === i18n.t("dialog.save")) {
      const error = await exportPdf();
      if (error) return "cancel";
      markClean();
      return "save";
    }

    if (result === "Cancel") return "cancel";

    return "discard";
  } catch {
    return "discard";
  }
}
