import { useStore } from "zustand";
import { useTranslation } from "react-i18next";
import { exportPdf } from "@/lib/export-pdf";
import {
  openPdfFile,
  saveProjectFile,
} from "@/lib/file-operations";
import {
  redo,
  undo,
  useEditorStore,
} from "@/stores/editor-store";
import { ZOOM_PRESETS } from "@/hooks/use-zoom";
import {
  FileDown,
  FolderOpen,
  Minus,
  Plus,
  Redo2,
  Save,
  Undo2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToolButton, ToolbarSeparator } from "@/components/ui/tool-button";

function ZoomControls() {
  const { t } = useTranslation();
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger
          onClick={() =>
            setZoom(Math.round(Math.max(0.5, zoom - 0.1) * 100) / 100)
          }
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-card"
        >
          <Minus className="h-3 w-3" />
        </TooltipTrigger>
        <TooltipContent>{t("header.zoomOut")}</TooltipContent>
      </Tooltip>
      <select
        value={zoom}
        onChange={(e) => setZoom(Number(e.target.value))}
        className="h-7 rounded-md border border-border bg-card px-1 text-xs tabular-nums text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
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
            setZoom(Math.round(Math.min(4, zoom + 0.1) * 100) / 100)
          }
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-card"
        >
          <Plus className="h-3 w-3" />
        </TooltipTrigger>
        <TooltipContent>{t("header.zoomIn")}</TooltipContent>
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
      <header className="grid h-11 grid-cols-[1fr_auto_1fr] items-center gap-1 border-b border-border bg-card px-2">
        <div className="flex items-center gap-1">
          <ToolButton
            onClick={() => openPdfFile()}
            variant="primary"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span>{t("header.open")}</span>
          </ToolButton>
          <Tooltip>
            <TooltipTrigger>
              <ToolButton onClick={() => saveProjectFile()}>
                <Save className="h-3.5 w-3.5" />
                <span>{t("header.save")}</span>
              </ToolButton>
            </TooltipTrigger>
            <TooltipContent>{t("header.saveProject")}</TooltipContent>
          </Tooltip>
        </div>

        <ZoomControls />

        <div className="flex items-center justify-end gap-1">
          <Tooltip>
            <TooltipTrigger>
              <ToolButton
                onClick={() => undo()}
                disabled={!(hasPdf && hasPast)}
              >
                <Undo2 className="h-3.5 w-3.5" />
              </ToolButton>
            </TooltipTrigger>
            <TooltipContent>{t("header.undo")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger>
              <ToolButton
                onClick={() => redo()}
                disabled={!(hasPdf && hasFuture)}
              >
                <Redo2 className="h-3.5 w-3.5" />
              </ToolButton>
            </TooltipTrigger>
            <TooltipContent>{t("header.redo")}</TooltipContent>
          </Tooltip>

          <ToolbarSeparator />

          <ToolButton
            onClick={() => exportPdf()}
            variant="primary"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span>{t("header.export")}</span>
          </ToolButton>
        </div>
      </header>
    </TooltipProvider>
  );
}
