import { PdfCanvas } from "@/components/pdf-canvas";
import { PageSidebar } from "@/components/page-sidebar";
import { CanvasOverlay } from "@/components/canvas-overlay";
import { PropertiesPanel } from "@/components/properties-panel";
import { useEditorStore, undo, redo, canUndo, canRedo } from "@/stores/editor-store";
import { openPdfFile, saveProjectFile, openProjectFile } from "@/lib/file-operations";
import { exportPdf } from "@/lib/export-pdf";
import { useFileDrop } from "@/hooks/use-file-drop";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useZoom, ZOOM_PRESETS } from "@/hooks/use-zoom";

function App() {
  const { pdfFileName, activeTool, setActiveTool, zoom } = useEditorStore();
  const setZoom = useEditorStore((s) => s.setZoom);
  useFileDrop();
  useKeyboardShortcuts();
  useZoom();

  return (
    <div className="dark flex h-screen flex-col">
      <header className="flex h-12 items-center gap-4 border-b border-border bg-card px-4">
        <h1 className="text-sm font-semibold text-foreground">PDF Form Maker</h1>

        <div className="mx-2 h-6 w-px bg-border" />

        <button
          onClick={() => openPdfFile()}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Open PDF
        </button>
        <button
          onClick={() => openProjectFile()}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          Open Project
        </button>
        <button
          onClick={() => saveProjectFile()}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          Save Project
        </button>

        <div className="mx-2 h-6 w-px bg-border" />

        <button
          onClick={() => undo()}
          disabled={!canUndo()}
          className="rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30 disabled:pointer-events-none"
          title="Undo (Ctrl+Z)"
        >
          ↩
        </button>
        <button
          onClick={() => redo()}
          disabled={!canRedo()}
          className="rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30 disabled:pointer-events-none"
          title="Redo (Ctrl+Y)"
        >
          ↪
        </button>

        <div className="mx-2 h-6 w-px bg-border" />

        {([
          ["select", "Select"],
          ["input", "Input"],
          ["textarea", "Textarea"],
          ["checkbox", "Checkbox"],
          ["radio", "Radio"],
        ] as const).map(([tool, label]) => (
          <button
            key={tool}
            onClick={() => setActiveTool(tool)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              activeTool === tool
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {label}
          </button>
        ))}

        <div className="flex-1" />

        <select
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="h-7 rounded-md border border-border bg-card px-1 text-xs text-foreground"
          title="Zoom level"
        >
          {ZOOM_PRESETS.map((z) => (
            <option key={z} value={z}>
              {Math.round(z * 100)}%
            </option>
          ))}
        </select>

        <span className="text-[10px] text-muted-foreground min-w-[3rem] text-center">
          {Math.round(zoom * 100)}%
        </span>

        <div className="mx-2 h-6 w-px bg-border" />

        <button
          onClick={() => exportPdf()}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Export PDF
        </button>

        {pdfFileName && (
          <span className="text-xs text-muted-foreground">{pdfFileName}</span>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <PageSidebar />

        <main data-testid="canvas-area" className="relative flex-1 overflow-hidden bg-background">
          <PdfCanvas>
            <CanvasOverlay />
          </PdfCanvas>
        </main>

        <aside
          data-testid="properties-panel"
          className="w-64 border-l border-border bg-card"
        >
          <PropertiesPanel />
        </aside>
      </div>
    </div>
  );
}

export default App;
