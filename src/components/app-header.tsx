import { clampZoom, ZOOM_PRESETS, ZOOM_STEP } from "@/hooks/use-zoom";
import { menuExportPdf, menuOpenPdf } from "@/lib/menu-actions";
import type { ShortcutId } from "@/lib/shortcuts";
import { getZoomEngine } from "@/lib/use-zoom-animation";
import { useEditorStore } from "@/stores/editor-store";
import { useTranslation } from "react-i18next";

import { ShortcutKbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileOutput, FolderOpen, Minus, Plus } from "lucide-react";

function FileToolbarButton({
  label,
  shortcutId,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string;
  shortcutId: ShortcutId;
  icon: typeof FolderOpen;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="flex h-8 max-w-full shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-card disabled:pointer-events-none disabled:opacity-30"
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="hidden truncate @[22rem]:inline">{label}</span>
      </TooltipTrigger>
      <TooltipContent>
        <span className="flex items-center gap-2">
          {label}
          <ShortcutKbd shortcutId={shortcutId} />
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

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
          aria-label={t("header.zoomOut")}
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
          aria-label={t("header.zoomIn")}
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

export function CanvasToolbar({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation();
  const hasPdf = useEditorStore((s) => !!s.pdfBytes);

  return (
    <TooltipProvider>
      <div className="flex shrink-0 flex-col border-b border-border bg-card select-none">
        <div className="@container flex h-10 items-center gap-2 px-3">
          <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="flex min-w-0 justify-start">
              <FileToolbarButton
                label={t("header.open")}
                shortcutId="open"
                icon={FolderOpen}
                onClick={menuOpenPdf}
              />
            </div>
            <ZoomControls />
            <div className="flex min-w-0 justify-end">
              <FileToolbarButton
                label={t("header.export")}
                shortcutId="export"
                icon={FileOutput}
                onClick={menuExportPdf}
                disabled={!hasPdf}
              />
            </div>
          </div>
        </div>
        {children}
      </div>
    </TooltipProvider>
  );
}
