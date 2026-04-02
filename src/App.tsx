import { AppHeader } from "@/components/app-header";
import { CanvasOverlay } from "@/components/canvas-overlay";
import { FloatingToolbar } from "@/components/floating-toolbar";
import { PageSidebar } from "@/components/page-sidebar";
import { PdfCanvas } from "@/components/pdf-canvas";
import { PropertiesPanel } from "@/components/properties-panel";
import { StatusBar } from "@/components/status-bar";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import {
  HorizontalRuler,
  RulerCorner,
  VerticalRuler,
} from "@/components/ruler";
import { useFileDrop } from "@/hooks/use-file-drop";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useZoom } from "@/hooks/use-zoom";
import { useCallback, useEffect, useRef, useState } from "react";

function App() {
  useFileDrop();
  useKeyboardShortcuts();
  useZoom();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hRulerRef = useRef<HTMLDivElement>(null);
  const vRulerRef = useRef<HTMLDivElement>(null);
  const [overlayWidth, setOverlayWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (hRulerRef.current) hRulerRef.current.scrollLeft = el.scrollLeft;
    if (vRulerRef.current) vRulerRef.current.scrollTop = el.scrollTop;
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
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
    <div className="dark flex h-screen flex-col" onContextMenu={(e) => e.preventDefault()}>
      <ErrorBoundary><AppHeader /></ErrorBoundary>

      <div className="flex flex-1 overflow-hidden">
        <ErrorBoundary fallback={<div className="w-14" />}><PageSidebar /></ErrorBoundary>

        <main
          data-testid="canvas-area"
          className="relative flex-1 overflow-hidden bg-background"
        >
          <div className="flex h-full">
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex">
                <RulerCorner />
                <HorizontalRuler
                  overlayWidth={overlayWidth}
                  containerRef={hRulerRef}
                />
              </div>
              <div className="flex flex-1 overflow-hidden">
                <VerticalRuler
                  canvasHeight={canvasHeight}
                  containerRef={vRulerRef}
                />
                <div
                  ref={scrollContainerRef}
                  className="relative flex-1 min-w-0 min-h-0 overflow-auto"
                  data-pdf-scroll-container
                >
                  <PdfCanvas>
                    <ErrorBoundary><CanvasOverlay /></ErrorBoundary>
                  </PdfCanvas>
                  <FloatingToolbar />
                </div>
              </div>
            </div>
          </div>
        </main>

        <aside
          data-testid="properties-panel"
          className="border-l border-border bg-card"
          style={{ width: "calc(11rem + 36px)" }}
        >
          <PropertiesPanel />
        </aside>
      </div>

      <StatusBar />
    </div>
  );
}

export default App;
