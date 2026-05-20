import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: vi.fn().mockReturnValue({
    promise: Promise.resolve({
      numPages: 0,
      fingerprint: "mock-doc",
      getPage: vi.fn(),
      destroy: vi.fn(),
    }),
    destroy: vi.fn(),
  }),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-cli", () => ({
  getMatches: vi.fn().mockResolvedValue({ args: {}, subcommand: null }),
}));

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: () => Promise.resolve(() => {}),
  }),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onCloseRequested: () => Promise.resolve(() => {}),
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "app.title": "Ursa PDF Forms",
        "header.open": "Open",
        "menu.file": "File",
        "menu.edit": "Edit",
        "menu.view": "View",
        "menu.help": "Help",
        "menu.ariaLabel": "Application menu",
        "header.save": "Save",
        "header.saveProject": "Save project",
        "header.export": "Export",
        "header.zoomOut": "Zoom out",
        "header.zoomIn": "Zoom in",
        "header.undo": "Undo (Ctrl+Z)",
        "header.redo": "Redo (Ctrl+Y)",
        "header.language": "Language",
        "toolbar.select": "Select",
        "toolbar.input": "Input",
        "toolbar.textarea": "Textarea",
        "toolbar.checkbox": "Checkbox",
        "toolbar.radio": "Radio",
        "toolbar.dropdown": "Dropdown",
        "toolbar.button": "Button",
        "toolbar.optionlist": "Option List",
        "fieldTypes.textField": "Text Field",
        "fieldTypes.checkbox": "Checkbox",
        "fieldTypes.radioButton": "Radio Button",
        "fieldTypes.multiline": "Multiline",
        "canvas.emptyTitle": "Open a PDF to get started",
        "canvas.emptyDescription":
          "Drag and drop a file, or use the Open button",
        "canvas.openPdf": "Open PDF",
        "canvas.zoom": "Zoom",
        "canvas.removeField": "Remove field",
        "sidebar.pages": "Pages",
        "properties.noSelection": "Select an element to edit properties",
        "status.clickToSelect": "Click to select",
        "status.dragToMarquee": "Drag to marquee",
      };
      let result = translations[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          result = result.replace(`{{${k}}}`, String(v));
        }
      }
      return result;
    },
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

import { render, screen, waitFor } from "@testing-library/react";
import App from "@/App";
import { useEditorStore } from "@/stores/editor-store";

describe("App layout", () => {
  beforeEach(() => {
    useEditorStore.getState().clearPdf();
  });

  it("renders 3-panel layout with toolbar, sidebar, canvas, and properties panel", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "File" })).toBeInTheDocument();
    expect(screen.getByText("Export")).toBeInTheDocument();
    expect(screen.getByTestId("left-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-area")).toBeInTheDocument();
    expect(screen.getByTestId("properties-panel")).toBeInTheDocument();
  });

  it("applies dark mode class to root element", () => {
    const { container } = render(<App />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.classList.contains("dark")).toBe(true);
  });

  it("shows empty state when no PDF is loaded", () => {
    render(<App />);
    expect(screen.getByText("Open a PDF to get started")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open PDF" })).toBeInTheDocument();
  });

  it("renders tool buttons in floating toolbar when PDF is loaded", async () => {
    render(<App />);
    expect(screen.queryByTestId("tool-select")).not.toBeInTheDocument();

    useEditorStore
      .getState()
      .setPdf("test.pdf", new Uint8Array([1, 2, 3]), [
        { pageNumber: 1, width: 612, height: 792 },
      ]);

    await waitFor(() => {
      expect(screen.getByTestId("tool-select")).toBeInTheDocument();
    });
    expect(screen.getByTestId("tool-input")).toBeInTheDocument();
    expect(screen.getByTestId("tool-textarea")).toBeInTheDocument();
  });

  it("renders export button", () => {
    render(<App />);
    expect(screen.getByText("Export")).toBeInTheDocument();
  });
});
