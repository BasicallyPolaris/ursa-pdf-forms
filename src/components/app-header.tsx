import { useStore } from "zustand";
import { exportPdf } from "@/lib/export-pdf";
import {
  openPdfFile,
  saveProjectFile,
} from "@/lib/file-operations";
import {
  redo,
  undo,
  useEditorStore,
} from "@/stores/editor-store";
import { ZOOM_PRESETS } from "@/hooks/use-zoom";
import {
  FileDown,
  FolderOpen,
  Minus,
  Plus,
  Redo2,
  Save,
  Undo2,
} from "lucide-react";

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

function ZoomControls() {
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);

  return (
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
  );
}

export function AppHeader() {
  const hasPast = useStore(useEditorStore.temporal, (s) => s.pastStates.length > 0);
  const hasFuture = useStore(useEditorStore.temporal, (s) => s.futureStates.length > 0);
  const hasPdf = useEditorStore((s) => !!s.pdfBytes);

  return (
    <header className="grid h-11 grid-cols-[1fr_auto_1fr] items-center gap-0.5 border-b border-border bg-card px-2">
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={() => openPdfFile()}
          className="text-primary-foreground bg-primary hover:bg-primary/90 px-2.5"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          <span>Open</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => saveProjectFile()}>
          <Save className="h-3.5 w-3.5" />
          <span>Save</span>
        </ToolbarButton>
      </div>

      <ZoomControls />

      <div className="flex items-center justify-end gap-0.5">
        <ToolbarButton
          onClick={() => undo()}
          disabled={!(hasPdf && hasPast)}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => redo()}
          disabled={!(hasPdf && hasFuture)}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarSeparator />

        <button
          onClick={() => exportPdf()}
          className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <FileDown className="h-3.5 w-3.5" />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
}
