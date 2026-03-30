import { AppHeader } from "@/components/app-header";
import { CanvasOverlay } from "@/components/canvas-overlay";
import { FloatingToolbar } from "@/components/floating-toolbar";
import { PageSidebar } from "@/components/page-sidebar";
import { PdfCanvas } from "@/components/pdf-canvas";
import { PropertiesPanel } from "@/components/properties-panel";
import { StatusBar } from "@/components/status-bar";
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
      <AppHeader />

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

      <StatusBar />
    </div>
  );
}

export default App;
