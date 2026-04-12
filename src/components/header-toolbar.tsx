import { ShortcutKbd } from "@/components/ui/kbd";
import { ToolButton } from "@/components/ui/tool-button";
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
  SquareChevronDown,
  SquareMousePointer,
  Square,
  Type,
} from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { Separator } from "./ui/separator";

export const TOOL_KEYS = [
  {
    id: "select" as const,
    labelKey: "toolbar.select",
    icon: MousePointer2,
    separate: true,
  },
  { id: "input" as const, labelKey: "toolbar.input", icon: Type },
  { id: "textarea" as const, labelKey: "toolbar.textarea", icon: AlignLeft },
  { id: "checkbox" as const, labelKey: "toolbar.checkbox", icon: Square },
  { id: "radio" as const, labelKey: "toolbar.radio", icon: CircleDot },
  {
    id: "dropdown" as const,
    labelKey: "toolbar.dropdown",
    icon: SquareChevronDown,
    separate: true,
  },
  { id: "optionlist" as const, labelKey: "toolbar.optionlist", icon: List },
  {
    id: "button" as const,
    labelKey: "toolbar.button",
    icon: SquareMousePointer,
  },
];

export function HeaderToolbar() {
  const { t } = useTranslation();
  const pdfBytes = useEditorStore((s) => s.pdfBytes);
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);

  if (!pdfBytes) return null;

  return (
    <>
      <ToolbarSeparator />
      {TOOL_KEYS.map(({ id, labelKey, icon: Icon, separate }) => (
        <React.Fragment key={id}>
          <Tooltip>
            <TooltipTrigger
              render={
                <ToolButton
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
    </>
  );
}

function ToolbarSeparator() {
  return <div className="mx-0.5 h-6 w-px bg-border" />;
}
