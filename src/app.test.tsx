import { describe, it, expect, vi } from "vitest";

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: vi.fn(),
}));

import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App layout", () => {
  it("renders 3-panel layout with toolbar, sidebar, canvas, and properties panel", () => {
    render(<App />);

    expect(screen.getByText("PDF Form Maker")).toBeInTheDocument();
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
    expect(screen.getByText("Open a PDF file to get started")).toBeInTheDocument();
  });
});
