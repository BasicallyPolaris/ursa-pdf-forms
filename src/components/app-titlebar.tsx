import { AppMenubar } from "@/components/app-menubar";
import { WindowControls } from "@/components/window-controls";
import { useTranslation } from "react-i18next";

export function AppTitleBar() {
  const { t } = useTranslation();

  return (
    <header className="relative h-9 shrink-0 border-b border-border bg-card select-none">
      <div data-tauri-drag-region className="absolute inset-0 z-0" aria-hidden />
      <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center px-4">
        <span className="max-w-[50%] truncate text-[11px] font-medium tracking-wide text-muted-foreground/70">
          {t("app.title")}
        </span>
      </div>
      <div className="relative z-10 flex h-full w-full items-stretch">
        <AppMenubar />
        <div
          data-tauri-drag-region
          className="min-w-0 flex-1"
          aria-hidden
        />
        <WindowControls className="pointer-events-auto" />
      </div>
    </header>
  );
}
