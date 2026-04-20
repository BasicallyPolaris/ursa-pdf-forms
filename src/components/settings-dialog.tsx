import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSettingsStore, type LayoutPreference } from "@/stores/settings-store";
import { Settings, Check, Monitor, LayoutGrid, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
export function SettingsDialog() {
  const { t } = useTranslation();
  const settingsOpen = useSettingsStore((s) => s.settingsOpen);
  const closeSettings = useSettingsStore((s) => s.closeSettings);
  const layoutPreference = useSettingsStore((s) => s.layoutPreference);
  const setLayoutPreference = useSettingsStore((s) => s.setLayoutPreference);
  const resetOnboarding = useSettingsStore((s) => s.resetOnboarding);
  const openOnboarding = useSettingsStore((s) => s.openOnboarding);
  const startTour = useSettingsStore((s) => s.startTour);

  function handleResetOnboarding() {
    resetOnboarding();
    closeSettings();
    openOnboarding();
  }

  function handleShowTour() {
    closeSettings();
    setTimeout(() => startTour(), 100);
  }

  return (
    <Dialog open={settingsOpen} onOpenChange={(v) => !v && closeSettings()}>
      <DialogBackdrop />
      <DialogContent className="max-w-sm">
        <div className="px-5 pt-5 pb-2 select-none">
          <DialogHeader>
            <DialogTitle>{t("settings.title")}</DialogTitle>
            <DialogClose aria-label={t("dialog.close")}>
              <span className="text-muted-foreground hover:text-foreground">×</span>
            </DialogClose>
          </DialogHeader>
          <DialogDescription className="sr-only">
            {t("settings.title")}
          </DialogDescription>
        </div>

        <div className="px-5 pb-5 space-y-5 select-none">
          <div>
            <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              {t("settings.layout")}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <LayoutOption
                id="figma"
                label={t("settings.figmaLayout")}
                description={t("settings.figmaLayoutDesc")}
                active={layoutPreference === "figma"}
                onClick={() => setLayoutPreference("figma")}
                icon={<LayoutGrid className="h-3.5 w-3.5" />}
              />
              <LayoutOption
                id="office"
                label={t("settings.officeLayout")}
                description={t("settings.officeLayoutDesc")}
                active={layoutPreference === "office"}
                onClick={() => setLayoutPreference("office")}
                icon={<Monitor className="h-3.5 w-3.5" />}
              />
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              {t("settings.help")}
            </h3>
            <div className="grid gap-1.5">
              <button
                type="button"
                onClick={handleShowTour}
                className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-foreground transition-colors hover:bg-accent/40"
              >
                <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                {t("settings.showTour")}
              </button>
              <button
                type="button"
                onClick={handleResetOnboarding}
                className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-foreground transition-colors hover:bg-accent/40"
              >
                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                {t("settings.resetOnboarding")}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LayoutOption({
  label,
  description,
  active,
  onClick,
  icon,
}: {
  id: LayoutPreference;
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-2 rounded-md border p-2.5 text-left transition-colors ${
        active
          ? "border-primary bg-primary/5"
          : "border-border hover:border-muted-foreground/30"
      }`}
    >
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted/50">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-foreground">{label}</span>
          {active && <Check className="h-3 w-3 text-primary" />}
        </div>
        <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </button>
  );
}
