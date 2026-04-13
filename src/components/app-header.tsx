import { clampZoom, ZOOM_PRESETS, ZOOM_STEP } from "@/hooks/use-zoom";
import { fileIO } from "@/lib/file-io";
import { getZoomEngine } from "@/lib/use-zoom-animation";
import { redo, undo, useEditorStore } from "@/stores/editor-store";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import { ShortcutKbd } from "@/components/ui/kbd";
import { ToolbarSeparator, ToolButton } from "@/components/ui/tool-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileDown, FolderOpen, Minus, Plus, Redo2, Undo2 } from "lucide-react";

function ZoomControls() {
  const { t } = useTranslation();
  const zoom = useEditorStore((s) => s.zoom);
  const pdfBytes = useEditorStore((s) => s.pdfBytes);

  const zoomFromUi = (next: number) => {
    if (!pdfBytes) return;
    const engine = getZoomEngine();
    engine.setTarget(clampZoom(next));
  };

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger
          onClick={() =>
            zoomFromUi(getZoomEngine().getTargetZoom() - ZOOM_STEP)
          }
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-card"
        >
          <Minus className="h-3 w-3" />
        </TooltipTrigger>
        <TooltipContent>
          <span className="flex items-center gap-2">
            {t("header.zoomOut")}
            <ShortcutKbd shortcutId="zoomOut" />
          </span>
        </TooltipContent>
      </Tooltip>
      <select
        aria-label={t("header.zoomLevel")}
        value={zoom}
        onChange={(e) => zoomFromUi(Number(e.target.value))}
        className="h-7 rounded-md border border-border bg-card px-1 text-xs tabular-nums text-foreground outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-1 focus:ring-offset-card"
      >
        {!ZOOM_PRESETS.includes(zoom) && (
          <option value={zoom}>{Math.round(zoom * 100)}%</option>
        )}
        {ZOOM_PRESETS.map((z) => (
          <option key={z} value={z}>
            {Math.round(z * 100)}%
          </option>
        ))}
      </select>
      <Tooltip>
        <TooltipTrigger
          onClick={() =>
            zoomFromUi(getZoomEngine().getTargetZoom() + ZOOM_STEP)
          }
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-card"
        >
          <Plus className="h-3 w-3" />
        </TooltipTrigger>
        <TooltipContent>
          <span className="flex items-center gap-2">
            {t("header.zoomIn")}
            <ShortcutKbd shortcutId="zoomIn" />
          </span>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function AppHeader({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation();
  const hasPast = useStore(
    useEditorStore.temporal,
    (s) => s.pastStates.length > 0,
  );
  const hasFuture = useStore(
    useEditorStore.temporal,
    (s) => s.futureStates.length > 0,
  );
  const hasPdf = useEditorStore((s) => !!s.pdfBytes);

  return (
    <TooltipProvider>
      <header className="flex flex-col border-b border-border bg-card select-none">
        <div className="grid h-11 grid-cols-[1fr_auto_1fr] items-center gap-1 px-2 select-none">
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <ToolButton
                    onClick={() => fileIO.openPdf()}
                    variant="primary"
                  />
                }
              >
                <FolderOpen className="h-3.5 w-3.5" />
                <span>{t("header.open")}</span>
              </TooltipTrigger>
              <TooltipContent>
                <span className="flex items-center gap-2">
                  {t("header.open")}
                  <ShortcutKbd shortcutId="open" />
                </span>
              </TooltipContent>
            </Tooltip>
          </div>

          <ZoomControls />

          <div className="flex items-center justify-end gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <ToolButton
                    onClick={() => undo()}
                    disabled={!(hasPdf && hasPast)}
                  />
                }
              >
                <Undo2 className="h-3.5 w-3.5" />
              </TooltipTrigger>
              <TooltipContent>
                <span className="flex items-center gap-2">
                  {t("header.undo")}
                  <ShortcutKbd shortcutId="undo" />
                </span>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <ToolButton
                    onClick={() => redo()}
                    disabled={!(hasPdf && hasFuture)}
                  />
                }
              >
                <Redo2 className="h-3.5 w-3.5" />
              </TooltipTrigger>
              <TooltipContent>
                <span className="flex items-center gap-2">
                  {t("header.redo")}
                  <ShortcutKbd shortcutId="redo" />
                </span>
              </TooltipContent>
            </Tooltip>

            <ToolbarSeparator />

            <Tooltip>
              <TooltipTrigger
                render={
                  <ToolButton
                    onClick={() => fileIO.exportPdf()}
                    variant="primary"
                    data-tour="export-button"
                  />
                }
              >
                <FileDown className="h-3.5 w-3.5" />
                <span>{t("header.export")}</span>
              </TooltipTrigger>
              <TooltipContent>
                <span className="flex items-center gap-2">
                  {t("header.export")}
                  <ShortcutKbd shortcutId="export" />
                </span>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {children}
      </header>
    </TooltipProvider>
  );
}
