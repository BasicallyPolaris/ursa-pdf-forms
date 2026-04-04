import { useStore } from "zustand";
import { useTranslation } from "react-i18next";
import { exportPdf } from "@/lib/export-pdf";
import {
  openPdfFile,
} from "@/lib/file-operations";
import {
  redo,
  undo,
  useEditorStore,
} from "@/stores/editor-store";
import {
  clampZoom,
  ZOOM_PRESETS,
  ZOOM_STEP,
} from "@/hooks/use-zoom";
import { getZoomEngine } from "@/lib/use-zoom-animation";

import {
  FileDown,
  FolderOpen,
  Minus,
  Plus,
  Redo2,
  Undo2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToolButton, ToolbarSeparator } from "@/components/ui/tool-button";
import { Kbd } from "@/components/ui/kbd";
import { formatShortcut } from "@/lib/shortcuts";

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
            <Kbd>{formatShortcut("zoomOut")}</Kbd>
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
            <Kbd>{formatShortcut("zoomIn")}</Kbd>
          </span>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function AppHeader() {
  const { t } = useTranslation();
  const hasPast = useStore(useEditorStore.temporal, (s) => s.pastStates.length > 0);
  const hasFuture = useStore(useEditorStore.temporal, (s) => s.futureStates.length > 0);
  const hasPdf = useEditorStore((s) => !!s.pdfBytes);

  return (
    <TooltipProvider>
      <header className="grid h-11 grid-cols-[1fr_auto_1fr] items-center gap-1 border-b border-border bg-card px-2 select-none">
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger render={<ToolButton onClick={() => openPdfFile()} variant="primary" />}>
              <FolderOpen className="h-3.5 w-3.5" />
              <span>{t("header.open")}</span>
            </TooltipTrigger>
            <TooltipContent>
              <span className="flex items-center gap-2">
                {t("header.open")}
                <Kbd>{formatShortcut("open")}</Kbd>
              </span>
            </TooltipContent>
          </Tooltip>
        </div>

        <ZoomControls />

        <div className="flex items-center justify-end gap-1">
          <Tooltip>
            <TooltipTrigger render={<ToolButton onClick={() => undo()} disabled={!(hasPdf && hasPast)} />}>
              <Undo2 className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent>
              <span className="flex items-center gap-2">
                {t("header.undo")}
                <Kbd>{formatShortcut("undo")}</Kbd>
              </span>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<ToolButton onClick={() => redo()} disabled={!(hasPdf && hasFuture)} />}>
              <Redo2 className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent>
              <span className="flex items-center gap-2">
                {t("header.redo")}
                <Kbd>{formatShortcut("redo")}</Kbd>
              </span>
            </TooltipContent>
          </Tooltip>

          <ToolbarSeparator />

          <Tooltip>
            <TooltipTrigger render={<ToolButton onClick={() => exportPdf()} variant="primary" />}>
              <FileDown className="h-3.5 w-3.5" />
              <span>{t("header.export")}</span>
            </TooltipTrigger>
            <TooltipContent>
              <span className="flex items-center gap-2">
                {t("header.export")}
                <Kbd>{formatShortcut("export")}</Kbd>
              </span>
            </TooltipContent>
          </Tooltip>
        </div>
      </header>
    </TooltipProvider>
  );
}
