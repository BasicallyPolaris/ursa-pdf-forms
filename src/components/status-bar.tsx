import { Kbd } from "@/components/ui/kbd";
import { useEditorStore } from "@/stores/editor-store";
import { useSettingsStore } from "@/stores/settings-store";
import { Keyboard, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

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
    <div className="flex h-6 items-center border-t border-border bg-card px-3 select-none">
      <div className="flex flex-1 items-center gap-3">
        <span className="text-[10px] text-muted-foreground" role="status" aria-live="polite">
          {hints.join(" · ")}
        </span>
      </div>
      <div className="flex items-center gap-3 overflow-hidden min-w-0">
        {hasSelection && (
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground overflow-hidden whitespace-nowrap">
            <Kbd>Arrow</Kbd> {t("status.nudge1pt")}
            <Kbd>Shift</Kbd>+<Kbd>Arrow</Kbd> {t("status.nudge5pt")}
            <Kbd>Shift</Kbd> {t("status.snapToGrid")}
            <Kbd>Ctrl</Kbd> {t("status.freeMove")}
            <Kbd>Del</Kbd> {t("status.delete")}
            <Kbd>Esc</Kbd> {t("status.deselect")}
          </span>
        )}
        <button
          type="button"
          onClick={() => useSettingsStore.getState().openShortcuts()}
          className="flex items-center justify-center rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label={t("shortcuts.openShortcuts")}
        >
          <Keyboard className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => useSettingsStore.getState().openSettings()}
          className="flex items-center justify-center rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label={t("settings.title")}
        >
          <Settings className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
