import { ShortcutKbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ShortcutId } from "@/lib/shortcuts";
import { TOOL_SHORTCUT_MAP } from "@/lib/shortcuts";
import { useEditorStore } from "@/stores/editor-store";
import {
  AlignLeft,
  CircleDot,
  List,
  MousePointer2,
  SquareCheck,
  SquareChevronDown,
  SquareMousePointer,
  Type,
} from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";

export const TOOL_KEYS = [
  {
    id: "select" as const,
    labelKey: "toolbar.select",
    icon: MousePointer2,
    group: 0,
  },
  { id: "input" as const, labelKey: "toolbar.input", icon: Type, group: 1 },
  {
    id: "textarea" as const,
    labelKey: "toolbar.textarea",
    icon: AlignLeft,
    group: 1,
  },
  {
    id: "checkbox" as const,
    labelKey: "toolbar.checkbox",
    icon: SquareCheck,
    group: 1,
  },
  {
    id: "radio" as const,
    labelKey: "toolbar.radio",
    icon: CircleDot,
    group: 1,
  },
  {
    id: "dropdown" as const,
    labelKey: "toolbar.dropdown",
    icon: SquareChevronDown,
    group: 2,
  },
  {
    id: "optionlist" as const,
    labelKey: "toolbar.optionlist",
    icon: List,
    group: 2,
  },
  {
    id: "button" as const,
    labelKey: "toolbar.button",
    icon: SquareMousePointer,
    group: 2,
  },
];

export function OfficeRibbon() {
  const { t } = useTranslation();
  const pdfBytes = useEditorStore((s) => s.pdfBytes);
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);

  if (!pdfBytes) return null;

  return (
    <div
      data-tour="drawing-tools"
      className="flex items-center border-t border-border bg-background px-2 py-1 overflow-x-auto select-none"
    >
      {TOOL_KEYS.map(({ id, labelKey, icon: Icon, group }, i) => (
        <React.Fragment key={id}>
          {i > 0 && group !== TOOL_KEYS[i - 1].group && (
            <div className="mx-1.5 h-6 w-px bg-border" />
          )}
          <Tooltip>
            <TooltipTrigger
              onClick={() => setActiveTool(id)}
              className={
                "flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 whitespace-nowrap " +
                (activeTool === id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/40 hover:text-accent-foreground")
              }
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{t(labelKey)}</span>
            </TooltipTrigger>
            <TooltipContent>
              <span className="flex items-center gap-2">
                {t(labelKey)}
                <ShortcutKbd shortcutId={TOOL_SHORTCUT_MAP[id] as ShortcutId} />
              </span>
            </TooltipContent>
          </Tooltip>
        </React.Fragment>
      ))}
    </div>
  );
}
