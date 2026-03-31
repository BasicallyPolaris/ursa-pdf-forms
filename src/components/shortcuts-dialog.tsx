import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import {
  getShortcutsByGroup,
  formatShortcut,
  type ShortcutGroup,
} from "@/lib/shortcuts";
import { Keyboard, X } from "lucide-react";

const GROUPS: { id: ShortcutGroup; labelKey: string }[] = [
  { id: "file", labelKey: "shortcuts.file" },
  { id: "edit", labelKey: "shortcuts.edit" },
  { id: "tools", labelKey: "shortcuts.tools" },
  { id: "view", labelKey: "shortcuts.view" },
];

export function ShortcutsDialog() {
  const { t } = useTranslation();

  return (
    <Dialog>
      <DialogTrigger
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label={t("shortcuts.openShortcuts")}
      >
        <Keyboard className="h-3 w-3" />
      </DialogTrigger>
      <DialogContent>
        <div className="px-5 pt-5 pb-2">
          <DialogHeader>
            <DialogTitle>{t("shortcuts.title")}</DialogTitle>
            <DialogClose aria-label="Close">
              <X className="h-3.5 w-3.5" />
            </DialogClose>
          </DialogHeader>
          <DialogDescription className="sr-only">
            {t("shortcuts.openShortcuts")}
          </DialogDescription>
        </div>
        <div className="px-5 pb-5">
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            {GROUPS.map(({ id, labelKey }) => (
              <div key={id}>
                <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                  {t(labelKey)}
                </h3>
                <div className="grid gap-1">
                  {getShortcutsByGroup(id).map((shortcut) => (
                    <div
                      key={shortcut.id}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="text-foreground/80">
                        {t(shortcut.i18nKey)}
                      </span>
                      <Kbd>{formatShortcut(shortcut.id)}</Kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
