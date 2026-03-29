import { PdfCanvas } from "@/components/pdf-canvas";
import { useEditorStore } from "@/stores/editor-store";
import { openPdfFile } from "@/lib/file-operations";

function App() {
  const pdfFileName = useEditorStore((s) => s.pdfFileName);

  return (
    <div className="dark flex h-screen flex-col">
      <header className="flex h-12 items-center gap-4 border-b border-border bg-card px-4">
        <h1 className="text-sm font-semibold text-foreground">PDF Form Maker</h1>
        <button
          onClick={() => openPdfFile()}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Open PDF
        </button>
        {pdfFileName && (
          <span className="text-xs text-muted-foreground">{pdfFileName}</span>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          data-testid="left-sidebar"
          className="w-48 border-r border-border bg-card"
        />

        <main data-testid="canvas-area" className="flex-1 bg-background">
          <PdfCanvas />
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
