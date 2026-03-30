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

const TOOLS = [
  { id: "select" as const, label: "Select", icon: MousePointer2 },
  { id: "input" as const, label: "Input", icon: Type },
  { id: "textarea" as const, label: "Textarea", icon: AlignLeft },
  { id: "checkbox" as const, label: "Checkbox", icon: Square },
  { id: "radio" as const, label: "Radio", icon: CircleDot },
];

export function FloatingToolbar() {
  const pdfBytes = useEditorStore((s) => s.pdfBytes);
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);

  if (!pdfBytes) return null;

  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-50 -translate-x-1/2">
      <TooltipProvider>
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-neutral-900/90 px-1.5 py-1 shadow-lg backdrop-blur-sm">
          {TOOLS.map(({ id, label, icon: Icon }) => (
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
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}
