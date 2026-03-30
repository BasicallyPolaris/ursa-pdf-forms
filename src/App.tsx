import { CanvasOverlay } from "@/components/canvas-overlay";
import { FloatingToolbar } from "@/components/floating-toolbar";
import { PageSidebar } from "@/components/page-sidebar";
import { PdfCanvas } from "@/components/pdf-canvas";
import { PropertiesPanel } from "@/components/properties-panel";
import {
  HorizontalRuler,
  RulerCorner,
  VerticalRuler,
} from "@/components/ruler";
import { useFileDrop } from "@/hooks/use-file-drop";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useZoom, ZOOM_PRESETS } from "@/hooks/use-zoom";
import { exportPdf } from "@/lib/export-pdf";
import {
  openPdfFile,
  openProjectFile,
  saveProjectFile,
} from "@/lib/file-operations";
import {
  canRedo,
  canUndo,
  redo,
  undo,
  useEditorStore,
} from "@/stores/editor-store";
import {
  Eye,
  FileDown,
  FileText,
  FolderOpen,
  Grid3x3,
  Minus,
  Plus,
  Redo2,
  Save,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

function ToolbarSeparator() {
  return <div className="mx-1 h-6 w-px bg-border" />;
}

function ToolbarButton({
  children,
  onClick,
  disabled,
  active,
  title,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors ${
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground"
      } disabled:opacity-30 disabled:pointer-events-none ${className}`}
    >
      {children}
    </button>
  );
}

function App() {
  const {
    pdfFileName,
    zoom,
    gridEnabled,
    showGrid,
    gridSize,
  } = useEditorStore();
  const setZoom = useEditorStore((s) => s.setZoom);
  const toggleGrid = useEditorStore((s) => s.toggleGrid);
  const setGridSize = useEditorStore((s) => s.setGridSize);
  const toggleShowGrid = useEditorStore((s) => s.toggleShowGrid);
  useFileDrop();
  useKeyboardShortcuts();
  useZoom();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [overlayWidth, setOverlayWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setScrollLeft(el.scrollLeft);
    setScrollTop(el.scrollTop);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setScrollLeft(el.scrollLeft);
    setScrollTop(el.scrollTop);
    setOverlayWidth(el.clientWidth);
    setCanvasHeight(el.clientHeight);
    const observer = new ResizeObserver((entries) => {
      setOverlayWidth(entries[0].contentRect.width);
      setCanvasHeight(entries[0].contentRect.height);
    });
    observer.observe(el);
    el.addEventListener("scroll", handleScroll);
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  return (
    <div className="dark flex h-screen flex-col">
      <header className="flex h-11 items-center gap-0.5 border-b border-border bg-card px-2">
        <ToolbarButton
          onClick={() => openPdfFile()}
          className="text-primary-foreground bg-primary hover:bg-primary/90 px-2.5"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          <span>Open</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => openProjectFile()}>
          <FileText className="h-3.5 w-3.5" />
          <span>Project</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => saveProjectFile()}>
          <Save className="h-3.5 w-3.5" />
          <span>Save</span>
        </ToolbarButton>

        <ToolbarSeparator />

        <ToolbarButton
          onClick={() => undo()}
          disabled={!canUndo()}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => redo()}
          disabled={!canRedo()}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarSeparator />

        <ToolbarButton
          active={gridEnabled}
          onClick={() => toggleGrid()}
          title="Toggle grid snap"
        >
          <Grid3x3 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={showGrid}
          onClick={() => toggleShowGrid()}
          title="Toggle grid visibility"
        >
          <Eye className="h-3.5 w-3.5" />
        </ToolbarButton>
        <select
          value={gridSize}
          onChange={(e) => setGridSize(Number(e.target.value))}
          className="h-7 rounded-md border border-border bg-card px-1 text-xs text-foreground"
          title="Grid size"
        >
          {[5, 10, 15, 20, 25, 50].map((s) => (
            <option key={s} value={s}>
              {s}pt
            </option>
          ))}
        </select>

        <div className="flex-1" />

        <div className="flex items-center gap-0.5">
          <button
            onClick={() =>
              setZoom(Math.round(Math.max(0.5, zoom - 0.1) * 100) / 100)
            }
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground"
            title="Zoom out"
          >
            <Minus className="h-3 w-3" />
          </button>
          <select
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-7 rounded-md border border-border bg-card px-1 text-xs tabular-nums text-foreground"
            title="Zoom level"
          >
            {!ZOOM_PRESETS.includes(zoom) && (
              <option value={zoom}>{Math.round(zoom * 100)}%</option>
            )}
            {ZOOM_PRESETS.map((z) => (
              <option key={z} value={z}>
                {Math.round(z * 100)}%
              </option>
            ))}
          </select>
          <button
            onClick={() =>
              setZoom(Math.round(Math.min(4, zoom + 0.1) * 100) / 100)
            }
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground"
            title="Zoom in"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        <ToolbarSeparator />

        <button
          onClick={() => exportPdf()}
          className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <FileDown className="h-3.5 w-3.5" />
          <span>Export PDF</span>
        </button>

        {pdfFileName && (
          <span className="ml-2 max-w-32 truncate text-[10px] text-muted-foreground">
            {pdfFileName}
          </span>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <PageSidebar />

        <main
          data-testid="canvas-area"
          className="relative flex-1 overflow-hidden bg-background"
        >
          <div className="flex h-full">
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex">
                <RulerCorner />
                <HorizontalRuler
                  scrollLeft={scrollLeft}
                  scrollTop={scrollTop}
                  overlayWidth={overlayWidth}
                  canvasHeight={canvasHeight}
                />
              </div>
              <div className="flex flex-1 overflow-hidden">
                <VerticalRuler
                  scrollTop={scrollTop}
                  canvasHeight={canvasHeight}
                  overlayWidth={overlayWidth}
                  scrollLeft={scrollLeft}
                />
                <div
                  ref={scrollContainerRef}
                  className="relative flex-1 min-w-0 min-h-0 overflow-auto"
                  data-pdf-scroll-container
                >
                  <PdfCanvas>
                    <CanvasOverlay />
                  </PdfCanvas>
                </div>
              </div>
            </div>
          </div>
          <FloatingToolbar />
        </main>

        <aside
          data-testid="properties-panel"
          className="border-l border-border bg-card"
          style={{ width: "calc(11rem + 36px)" }}
        >
          <PropertiesPanel />
        </aside>
      </div>
    </div>
  );
}

export default App;
