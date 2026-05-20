import { cn } from "@/lib/utils";
import {
  getAppWindow,
  isTauriRuntime,
  runWindowAction,
} from "@/lib/tauri-window";
import { Minus, Square, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

function stopTitlebarDrag(e: React.MouseEvent) {
  e.stopPropagation();
}

export function WindowControls({ className }: { className?: string }) {
  const { t } = useTranslation();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let unlisten: (() => void) | undefined;
    void (async () => {
      const win = getAppWindow();
      setMaximized(await win.isMaximized());
      unlisten = await win.onResized(async () => {
        setMaximized(await win.isMaximized());
      });
    })();
    return () => unlisten?.();
  }, []);

  const minimize = useCallback(() => {
    void runWindowAction(() => getAppWindow().minimize(), "minimize");
  }, []);

  const toggleMaximize = useCallback(() => {
    void runWindowAction(
      () => getAppWindow().toggleMaximize(),
      "toggleMaximize",
    );
  }, []);

  const close = useCallback(() => {
    void runWindowAction(() => getAppWindow().close(), "close");
  }, []);

  if (!isTauriRuntime()) return null;

  const controlClass =
    "relative z-10 flex h-full w-11 shrink-0 items-center justify-center text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset";

  return (
    <div
      className={cn("relative z-10 flex h-full shrink-0", className)}
      data-tauri-drag-region={false}
    >
      <button
        type="button"
        onMouseDown={stopTitlebarDrag}
        onClick={minimize}
        aria-label={t("window.minimize")}
        className={cn(controlClass, "hover:bg-accent/60 hover:text-foreground")}
      >
        <Minus className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onMouseDown={stopTitlebarDrag}
        onClick={toggleMaximize}
        aria-label={
          maximized ? t("window.restore") : t("window.maximize")
        }
        className={cn(controlClass, "hover:bg-accent/60 hover:text-foreground")}
      >
        <Square className="h-3 w-3 shrink-0" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onMouseDown={stopTitlebarDrag}
        onClick={close}
        aria-label={t("window.close")}
        className={cn(
          controlClass,
          "hover:bg-red-700 hover:text-white",
        )}
      >
        <X className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
      </button>
    </div>
  );
}
