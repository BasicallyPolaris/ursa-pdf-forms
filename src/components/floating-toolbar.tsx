import { useTranslation } from "react-i18next";
import { useEditorStore } from "@/stores/editor-store";
import {
  MousePointer2,
  Type,
  AlignLeft,
  Square,
  CircleDot,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToolButton } from "@/components/ui/tool-button";

const TOOL_KEYS = [
  { id: "select" as const, labelKey: "toolbar.select", icon: MousePointer2 },
  { id: "input" as const, labelKey: "toolbar.input", icon: Type },
  { id: "textarea" as const, labelKey: "toolbar.textarea", icon: AlignLeft },
  { id: "checkbox" as const, labelKey: "toolbar.checkbox", icon: Square },
  { id: "radio" as const, labelKey: "toolbar.radio", icon: CircleDot },
];

export function FloatingToolbar() {
  const { t } = useTranslation();
  const pdfBytes = useEditorStore((s) => s.pdfBytes);
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);

  if (!pdfBytes) return null;

  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-50 -translate-x-1/2">
      <TooltipProvider>
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-neutral-900/90 px-1.5 py-1 shadow-lg backdrop-blur-sm">
          {TOOL_KEYS.map(({ id, labelKey, icon: Icon }) => (
            <Tooltip key={id}>
              <TooltipTrigger>
                <ToolButton
                  variant="icon"
                  onClick={() => setActiveTool(id)}
                  active={activeTool === id}
                >
                  <Icon className="h-3.5 w-3.5" />
                </ToolButton>
              </TooltipTrigger>
              <TooltipContent>{t(labelKey)}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}
