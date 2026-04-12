import { TOOL_KEYS } from "@/components/header-toolbar";
import { ShortcutKbd } from "@/components/ui/kbd";
import { ToolButton } from "@/components/ui/tool-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ShortcutId } from "@/lib/shortcuts";
import { TOOL_SHORTCUT_MAP } from "@/lib/shortcuts";
import { useEditorStore } from "@/stores/editor-store";
import React from "react";
import { useTranslation } from "react-i18next";
import { Separator } from "./ui/separator";

export function FloatingToolbar() {
  const { t } = useTranslation();
  const pdfBytes = useEditorStore((s) => s.pdfBytes);
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);

  if (!pdfBytes) return null;

  return (
    <div
      className="pointer-events-auto fixed bottom-12 left-1/2 z-50 -translate-x-1/2"
      data-testid="floating-toolbar"
      data-tour="drawing-tools"
    >
      <TooltipProvider>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-toolbar-bg px-1.5 py-1 shadow-lg backdrop-blur-sm select-none">
          {TOOL_KEYS.map(({ id, labelKey, icon: Icon, separate }) => (
            <React.Fragment key={id}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <ToolButton
                      data-testid={`tool-${id}`}
                      variant="icon"
                      onClick={() => setActiveTool(id)}
                      active={activeTool === id}
                    />
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                </TooltipTrigger>
                <TooltipContent>
                  <span className="flex items-center gap-2">
                    {t(labelKey)}
                    <ShortcutKbd
                      shortcutId={TOOL_SHORTCUT_MAP[id] as ShortcutId}
                    />
                  </span>
                </TooltipContent>
              </Tooltip>
              {!!separate && <Separator orientation="vertical" />}
            </React.Fragment>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}
