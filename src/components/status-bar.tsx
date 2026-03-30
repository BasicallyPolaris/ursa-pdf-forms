import { useEditorStore } from "@/stores/editor-store";
import { Kbd } from "@/components/ui/kbd";

export function StatusBar() {
  const pdfBytes = useEditorStore((s) => s.pdfBytes);
  const activeTool = useEditorStore((s) => s.activeTool);
  const selectedIds = useEditorStore((s) => s.selectedIds);

  if (!pdfBytes) return null;

  const hasSelection = selectedIds.size > 0;

  const hints: string[] = [];

  if (activeTool === "select") {
    hints.push("Click to select");
    hints.push("Drag to marquee");
  } else if (activeTool === "input") {
    hints.push("Drag to draw text field");
  } else if (activeTool === "textarea") {
    hints.push("Drag to draw multiline field");
  } else if (activeTool === "checkbox" || activeTool === "radio") {
    hints.push("Click to place");
  }

  if (hasSelection) {
    hints.push(`${selectedIds.size} selected`);
  }

  return (
    <div className="flex h-6 items-center border-t border-border bg-card px-3">
      <div className="flex flex-1 items-center gap-3">
        <span className="text-[10px] text-muted-foreground/60">
          {hints.join(" · ")}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {hasSelection && (
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
            <Kbd>Arrow</Kbd> nudge 1pt
            <Kbd>Shift+Arrow</Kbd> nudge 5pt
            <Kbd>Shift</Kbd> snap to grid
            <Kbd>Ctrl</Kbd> free move
            <Kbd>Del</Kbd> delete
            <Kbd>Esc</Kbd> deselect
          </span>
        )}
      </div>
    </div>
  );
}
