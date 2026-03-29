import { PdfCanvas } from "@/components/pdf-canvas";
import { PageSidebar } from "@/components/page-sidebar";
import { CanvasOverlay } from "@/components/canvas-overlay";
import { useEditorStore } from "@/stores/editor-store";
import { openPdfFile, saveProjectFile, openProjectFile } from "@/lib/file-operations";
import { exportPdf } from "@/lib/export-pdf";
import { useFileDrop } from "@/hooks/use-file-drop";

function App() {
  const { pdfFileName, activeTool } = useEditorStore();
  useFileDrop();

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

        {(["select", "text"] as const).map((tool) => (
          <button
            key={tool}
            onClick={() => useEditorStore.getState().setActiveTool(tool)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              activeTool === tool
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {tool === "select" ? "Select" : "Text Field"}
          </button>
        ))}

        <div className="flex-1" />

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

        <main data-testid="canvas-area" className="relative flex-1 bg-background">
          <PdfCanvas />
          <CanvasOverlay />
        </main>

        <aside
          data-testid="properties-panel"
          className="w-64 border-l border-border bg-card"
        />
      </div>
    </div>
  );
}

export default App;
