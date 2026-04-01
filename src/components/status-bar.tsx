import { useTranslation } from "react-i18next";
import { useEditorStore } from "@/stores/editor-store";
import { Kbd } from "@/components/ui/kbd";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";

export function StatusBar() {
  const { t } = useTranslation();
  const pdfBytes = useEditorStore((s) => s.pdfBytes);
  const activeTool = useEditorStore((s) => s.activeTool);
  const selectedIds = useEditorStore((s) => s.selectedIds);

  const hasSelection = pdfBytes && selectedIds.size > 0;

  const hints: string[] = [];

  if (pdfBytes) {
    if (activeTool === "select") {
      hints.push(t("status.clickToSelect"));
      hints.push(t("status.dragToMarquee"));
    } else if (activeTool === "input") {
      hints.push(t("status.dragToDrawTextField"));
    } else if (activeTool === "textarea") {
      hints.push(t("status.dragToDrawMultilineField"));
    } else if (activeTool === "checkbox" || activeTool === "radio") {
      hints.push(t("status.clickToPlace"));
    }

    if (selectedIds.size > 0) {
      hints.push(t("status.selected", { count: selectedIds.size }));
    }
  }

  return (
    <div className="flex h-6 items-center border-t border-border bg-card px-3">
      <div className="flex flex-1 items-center gap-3">
        <span className="text-[10px] text-muted-foreground">
          {hints.join(" · ")}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {hasSelection && (
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Kbd>Arrow</Kbd> {t("status.nudge1pt")}
            <Kbd>Shift+Arrow</Kbd> {t("status.nudge5pt")}
            <Kbd>Shift</Kbd> {t("status.snapToGrid")}
            <Kbd>Ctrl</Kbd> {t("status.freeMove")}
            <Kbd>Del</Kbd> {t("status.delete")}
            <Kbd>Esc</Kbd> {t("status.deselect")}
          </span>
        )}
        <ShortcutsDialog />
      </div>
    </div>
  );
}
