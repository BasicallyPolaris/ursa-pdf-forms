import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: vi.fn().mockReturnValue({ promise: Promise.resolve({ numPages: 0 }) }),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: () => Promise.resolve(() => {}),
  }),
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

    expect(screen.getByText("Open")).toBeInTheDocument();
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
  });

  it("renders tool buttons in floating toolbar when PDF is loaded", async () => {
    render(<App />);
    expect(screen.queryByText("Select")).not.toBeInTheDocument();

    useEditorStore.getState().setPdf("test.pdf", new Uint8Array([1, 2, 3]), [
      { pageNumber: 1, width: 612, height: 792 },
    ]);

    await waitFor(() => {
      expect(screen.getByText("Select")).toBeInTheDocument();
    });
    expect(screen.getByText("Text")).toBeInTheDocument();
    expect(screen.getByText("Multiline")).toBeInTheDocument();
  });

  it("renders export button", () => {
    render(<App />);
    expect(screen.getByText("Export PDF")).toBeInTheDocument();
  });
});
