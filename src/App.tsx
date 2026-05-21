import { CanvasToolbar } from "@/components/app-header";
import { AppTitleBar } from "@/components/app-titlebar";
import { CanvasOverlay } from "@/components/canvas-overlay";
import { FloatingToolbar } from "@/components/floating-toolbar";
import { OfficeRibbon } from "@/components/header-toolbar";
import { PageSidebar } from "@/components/page-sidebar";
import { PdfCanvas } from "@/components/pdf-canvas";
import { PropertiesPanel } from "@/components/properties-panel";
import {
  HorizontalRuler,
  RulerCorner,
  VerticalRuler,
} from "@/components/ruler";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { StatusBar } from "@/components/status-bar";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { ScrollContainerProvider } from "@/contexts/scroll-container-context";
import { useFileDrop } from "@/hooks/use-file-drop";
import { useLaunchPdfArg } from "@/hooks/use-launch-pdf-arg";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useMiddleClickPan } from "@/hooks/use-middle-click-pan";
import { useZoom } from "@/hooks/use-zoom";
import { fileIO } from "@/lib/file-io";
import {
  PAGE_SIDEBAR_WIDTH_CLASS,
  PROPERTIES_PANEL_WIDTH_CLASS,
} from "@/lib/shell-layout";
import { useEditorStore } from "@/stores/editor-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useAnnouncementStore } from "@/stores/announcement-store";
import { FileDown, FileX } from "lucide-react";
import { lazy, useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useTranslation } from "react-i18next";

const OnboardingDialog = lazy(() =>
  import("@/components/onboarding-dialog").then((m) => ({ default: m.OnboardingDialog })),
);
const SettingsDialog = lazy(() =>
  import("@/components/settings-dialog").then((m) => ({ default: m.SettingsDialog })),
);
const TourSpotlight = lazy(() =>
  import("@/components/tour-spotlight").then((m) => ({ default: m.TourSpotlight })),
);

function ZoomController() {
  useZoom();
  return null;
}

function App() {
  useFileDrop();
  useLaunchPdfArg();
  useKeyboardShortcuts();

  useEffect(() => fileIO.registerCloseGuard(), []);

  const { t } = useTranslation();
  const isFileDragOver = useEditorStore((s) => s.isFileDragOver);
  const isDragFileValid = useEditorStore((s) => s.isDragFileValid);
  const pdfBytes = useEditorStore((s) => s.pdfBytes);
  const layoutPreference = useSettingsStore((s) => s.layoutPreference);
  const tourPending = useSettingsStore((s) => s.tourPending);
  const startTour = useSettingsStore((s) => s.startTour);
  const announcement = useAnnouncementStore((s) => s.message);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useMiddleClickPan(scrollContainerRef);
  const hRulerRef = useRef<HTMLDivElement>(null);
  const vRulerRef = useRef<HTMLDivElement>(null);
  const [overlayWidth, setOverlayWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);

  useEffect(() => {
    if (tourPending && pdfBytes) {
      startTour();
    }
  }, [tourPending, pdfBytes, startTour]);

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
    <ScrollContainerProvider scrollContainerRef={scrollContainerRef}>
    <ZoomController />
    <div
      className="dark flex h-screen flex-col"
      onContextMenu={(e) => e.preventDefault()}
    >
      <h1 className="sr-only">{t("app.title")}</h1>
      <div role="status" aria-live="polite" className="sr-only">{announcement}</div>
      <ErrorBoundary>
        <AppTitleBar />
      </ErrorBoundary>
      <div className="flex flex-1 overflow-hidden">
        <ErrorBoundary fallback={<div className={`${PAGE_SIDEBAR_WIDTH_CLASS} shrink-0`} />}>
          <PageSidebar />
        </ErrorBoundary>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <ErrorBoundary>
            <CanvasToolbar>
              {layoutPreference === "office" && <OfficeRibbon />}
            </CanvasToolbar>
          </ErrorBoundary>

          <main
            data-testid="canvas-area"
            className="relative min-h-0 flex-1 overflow-hidden bg-background"
          >
          <h2 className="sr-only">{t("canvas.canvasArea")}</h2>
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
                  style={{ overflowAnchor: "none" }}
                  data-pdf-scroll-container
                >
                  <PdfCanvas>
                    <ErrorBoundary>
                      <CanvasOverlay />
                    </ErrorBoundary>
                  </PdfCanvas>
                  {layoutPreference === "figma" && <FloatingToolbar />}
                </div>
              </div>
            </div>
          </div>
          {isFileDragOver && (
            <div className="absolute inset-0 z-60 pointer-events-none animate-in fade-in-0 duration-150" aria-hidden="true">
              <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px]" />
              <div
                className={`absolute inset-4 rounded-lg border-2 border-dashed ${isDragFileValid ? "border-foreground/20" : "border-destructive/30"}`}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border ${isDragFileValid ? "border-border bg-muted/50" : "border-destructive/30 bg-destructive/10"}`}
                  >
                    {isDragFileValid ? (
                      <FileDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <FileX className="h-5 w-5 text-destructive" />
                    )}
                  </div>
                  <p
                    className={`text-sm font-medium ${isDragFileValid ? "text-foreground" : "text-destructive"}`}
                  >
                    {isDragFileValid
                      ? pdfBytes
                        ? t("canvas.dropToReplace")
                        : t("canvas.dropToOpen")
                      : t("canvas.dropInvalidFile")}
                  </p>
                </div>
              </div>
            </div>
          )}
          </main>
        </div>

        <aside
          data-testid="properties-panel"
          data-tour="properties-panel"
          className={`${PROPERTIES_PANEL_WIDTH_CLASS} shrink-0 border-l border-border bg-card overflow-hidden`}
        >
          <h2 className="sr-only">{t("properties.panelTitle")}</h2>
          <PropertiesPanel />
        </aside>
      </div>

      <StatusBar />
      <Suspense fallback={null}>
        <OnboardingDialog />
      </Suspense>
      <Suspense fallback={null}>
        <SettingsDialog />
        <ShortcutsDialog />
      </Suspense>
      <Suspense fallback={null}>
        <TourSpotlight />
      </Suspense>
      </div>
    </ScrollContainerProvider>
  );
}

export default App;
