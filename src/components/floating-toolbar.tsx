import { useEditorStore } from "@/stores/editor-store";
import {
  MousePointer2,
  Type,
  AlignLeft,
  Square,
  CircleDot,
} from "lucide-react";

const TOOLS = [
  { id: "select" as const, label: "Select", icon: MousePointer2 },
  { id: "input" as const, label: "Text", icon: Type },
  { id: "textarea" as const, label: "Multiline", icon: AlignLeft },
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
      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-neutral-900/90 px-1.5 py-1 shadow-lg backdrop-blur-sm">
        {TOOLS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTool(id)}
            title={label}
            className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${
              activeTool === id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
