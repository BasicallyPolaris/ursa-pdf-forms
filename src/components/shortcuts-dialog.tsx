import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShortcutKbd } from "@/components/ui/kbd";
import {
  getShortcutsByGroup,
  type ShortcutDef,
  type ShortcutGroup,
} from "@/lib/shortcuts";
import { useSettingsStore } from "@/stores/settings-store";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

const GROUPS: { id: ShortcutGroup; labelKey: string }[] = [
  { id: "file", labelKey: "shortcuts.file" },
  { id: "edit", labelKey: "shortcuts.edit" },
  { id: "tools", labelKey: "shortcuts.tools" },
  { id: "view", labelKey: "shortcuts.view" },
];

export function ShortcutsDialog() {
  const { t } = useTranslation();
  const open = useSettingsStore((s) => s.shortcutsOpen);
  const closeShortcuts = useSettingsStore((s) => s.closeShortcuts);
  const openShortcuts = useSettingsStore((s) => s.openShortcuts);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) openShortcuts();
        else closeShortcuts();
      }}
    >
      <DialogContent className="max-w-xl">
        <div className="px-5 pt-5 pb-2 select-none">
          <DialogHeader>
            <DialogTitle>{t("shortcuts.title")}</DialogTitle>
            <DialogClose aria-label={t("dialog.close")}>
              <X className="h-3.5 w-3.5" />
            </DialogClose>
          </DialogHeader>
          <DialogDescription className="sr-only">
            {t("shortcuts.openShortcuts")}
          </DialogDescription>
        </div>
        <div className="px-5 pb-5 select-none overflow-x-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
            {GROUPS.map(({ id, labelKey }) => (
              <div key={id}>
                <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                  {t(labelKey)}
                </h3>
                <div className="grid gap-1">
                  {getShortcutsByGroup(id)
                    .filter(
                      (s, i, arr) =>
                        s.id !== "redoAlt" ||
                        arr.findIndex((x) => x.i18nKey === s.i18nKey) === i,
                    )
                    .map((shortcut) => {
                      const isRedo = shortcut.id === "redo";
                      const altShortcut: ShortcutDef | undefined = isRedo
                        ? getShortcutsByGroup(id).find(
                            (s) => s.id === "redoAlt",
                          )
                        : undefined;
                      return (
                        <div
                          key={shortcut.id}
                          className="flex items-center justify-between gap-3 text-xs min-w-0"
                        >
                          <span className="text-foreground/80 truncate">
                            {t(shortcut.i18nKey)}
                          </span>
                          <span className="inline-flex items-center gap-1 shrink-0">
                            <ShortcutKbd shortcutId={shortcut.id} />
                            {altShortcut && (
                              <>
                                <span className="text-muted-foreground/50 text-[10px]">
                                  {t("shortcuts.or")}
                                </span>
                                <ShortcutKbd shortcutId={altShortcut.id} />
                              </>
                            )}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
