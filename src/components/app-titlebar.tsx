import { AppMenubar } from "@/components/app-menubar";
import { WindowControls } from "@/components/window-controls";
import {
  stopTitlebarDrag,
  useTitlebarDrag,
} from "@/hooks/use-titlebar-drag";
import { useTranslation } from "react-i18next";

export function AppTitleBar() {
  const { t } = useTranslation();
  const onTitlebarMouseDown = useTitlebarDrag();

  return (
    <header className="relative h-9 shrink-0 border-b border-border bg-card select-none">
      <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center px-4">
        <span className="max-w-[50%] truncate text-[11px] font-medium tracking-wide text-muted-foreground/70">
          {t("app.title")}
        </span>
      </div>
      <div className="relative z-10 flex h-full w-full items-stretch">
        <div className="shrink-0" onMouseDown={stopTitlebarDrag}>
          <AppMenubar />
        </div>
        <div
          className="min-w-0 flex-1"
          aria-hidden
          onMouseDown={onTitlebarMouseDown}
        />
        <WindowControls className="pointer-events-auto" />
      </div>
    </header>
  );
}
