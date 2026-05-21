import { clampZoom, ZOOM_PRESETS, ZOOM_STEP } from "@/hooks/use-zoom";
import { ZOOM_BAR_RULER_PADDING_CLASS } from "@/lib/shell-layout";
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
import { Minus, Plus } from "lucide-react";

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
  return (
    <TooltipProvider>
      <div className="flex shrink-0 flex-col border-b border-border bg-card select-none">
        <div
          className={`flex h-10 items-center justify-center ${ZOOM_BAR_RULER_PADDING_CLASS}`}
        >
          <ZoomControls />
        </div>
        {children}
      </div>
    </TooltipProvider>
  );
}
