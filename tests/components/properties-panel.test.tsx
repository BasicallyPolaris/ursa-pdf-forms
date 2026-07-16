import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

import { PropertiesPanel } from "@/components/properties-panel";
import { createTextField } from "@/lib/form-element-model";
import {
  canUndo,
  getDisplayElements,
  undo,
  useEditorStore,
} from "@/stores/editor-store";

describe("PropertiesPanel", () => {
  beforeEach(() => {
    useEditorStore.getState().clearPdf();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the selected field properties when changing selection from a focused editor", async () => {
    const first = createTextField({
      x: 10,
      y: 10,
      pageNumber: 1,
      name: "first-field",
    });
    const second = createTextField({
      x: 50,
      y: 50,
      pageNumber: 1,
      name: "second-field",
    });

    useEditorStore
      .getState()
      .setPdf("test.pdf", new Uint8Array([1]), [
        { pageNumber: 1, width: 612, height: 792 },
      ]);
    useEditorStore.getState().setInitialElements([first, second]);
    useEditorStore.getState().selectElements(new Set([first.id]));

    render(<PropertiesPanel />);

    const nameInput = screen.getByDisplayValue("first-field");
    nameInput.focus();
    fireEvent.change(nameInput, { target: { value: "renamed-first" } });

    useEditorStore.getState().selectElements(new Set([second.id]));

    await waitFor(() => {
      expect(screen.getByDisplayValue("second-field")).toBeInTheDocument();
    });
    expect(screen.queryByDisplayValue("renamed-first")).not.toBeInTheDocument();
    expect(useEditorStore.getState().elements[0]).toMatchObject({
      id: first.id,
      name: "renamed-first",
    });
    expect(canUndo()).toBe(true);
    act(() => undo());
    expect(useEditorStore.getState().elements[0]).toMatchObject({
      id: first.id,
      name: "first-field",
    });
  });

  it("discards a focused property preview on Escape", () => {
    const field = createTextField({
      x: 10,
      y: 10,
      pageNumber: 1,
      name: "field",
    });

    useEditorStore
      .getState()
      .setPdf("test.pdf", new Uint8Array([1]), [
        { pageNumber: 1, width: 612, height: 792 },
      ]);
    useEditorStore.getState().setInitialElements([field]);
    useEditorStore.getState().selectElements(new Set([field.id]));

    render(<PropertiesPanel />);

    const nameInput = screen.getByDisplayValue("field");
    nameInput.focus();
    fireEvent.change(nameInput, { target: { value: "preview" } });

    expect(getDisplayElements(useEditorStore.getState())[0]).toMatchObject({
      name: "preview",
    });
    expect(useEditorStore.getState().elements[0]).toMatchObject({
      name: "field",
    });

    fireEvent.keyDown(nameInput, { key: "Escape" });

    expect(screen.getByDisplayValue("field")).toBeInTheDocument();
    expect(getDisplayElements(useEditorStore.getState())[0]).toMatchObject({
      name: "field",
    });
    expect(canUndo()).toBe(false);
  });

  it("does not restore edit history after the PDF is cleared", () => {
    const field = createTextField({
      x: 10,
      y: 10,
      pageNumber: 1,
      name: "field",
    });

    useEditorStore
      .getState()
      .setPdf("test.pdf", new Uint8Array([1]), [
        { pageNumber: 1, width: 612, height: 792 },
      ]);
    useEditorStore.getState().setInitialElements([field]);
    useEditorStore.getState().selectElements(new Set([field.id]));

    render(<PropertiesPanel />);

    const nameInput = screen.getByDisplayValue("field");
    nameInput.focus();
    fireEvent.change(nameInput, { target: { value: "edited-field" } });

    act(() => {
      useEditorStore.getState().clearPdf();
    });

    expect(canUndo()).toBe(false);
  });
});
