import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

import { PropertiesPanel } from "@/components/properties-panel";
import { createButtonField, createTextField } from "@/lib/form-element-model";
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

  it("sets and removes number formatting on a text field", () => {
    const quantity = createTextField({
      name: "Quantity",
      pageNumber: 1,
      x: 10,
      y: 10,
    });
    const store = useEditorStore.getState();
    store.setPdf("test.pdf", new Uint8Array([1]), []);
    store.setInitialElements([quantity]);
    store.selectElements(new Set([quantity.id]));

    render(<PropertiesPanel />);
    const type = screen.getByRole("combobox", { name: "Input type" });
    expect(type).toHaveValue("text");
    fireEvent.change(type, { target: { value: "number" } });
    const decimals = screen.getByRole("combobox", { name: "Decimal places" });
    expect(decimals).toHaveValue("2");
    fireEvent.change(decimals, { target: { value: "0" } });
    expect(useEditorStore.getState().elements[0]).toMatchObject({ numberDecimals: 0 });
    fireEvent.change(type, { target: { value: "text" } });
    expect(screen.queryByRole("combobox", { name: "Decimal places" })).toBeNull();
    expect(useEditorStore.getState().elements[0]).toMatchObject({ numberDecimals: undefined });
  });

  it("inserts a preset into the calculation draft before saving linked widgets", () => {
    const quantity = createTextField({
      name: "Quantity", x: 10, y: 10, pageNumber: 1,
    });
    const price = createTextField({
      name: "Unit price", x: 10, y: 40, pageNumber: 1,
    });
    const total = createTextField({
      name: "Total", x: 10, y: 70, pageNumber: 1,
    });
    const linked = { ...total, id: "linked-total", x: 200 };
    const store = useEditorStore.getState();
    store.setPdf("test.pdf", new Uint8Array([1]), [
      { pageNumber: 1, width: 612, height: 792 },
    ]);
    store.setInitialElements([quantity, price, total, linked]);
    store.selectElements(new Set([linked.id]));

    render(<PropertiesPanel />);
    expect(screen.queryByRole("combobox", { name: "Operation" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add Calculation" }));
    const editor = within(screen.getByRole("dialog", { name: "Add Calculation" }));
    fireEvent.click(editor.getByRole("button", { name: "Use preset" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Operation" }), {
      target: { value: "PRD" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Quantity" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Unit price" }));
    fireEvent.click(screen.getByRole("button", { name: "Insert code" }));
    const script = 'AFSimple_Calculate("PRD", ["Quantity","Unit price"]);';
    expect(editor.getByRole("textbox", { name: "JavaScript" })).toHaveValue(script);
    expect(useEditorStore.getState().elements.slice(2)).toEqual([total, linked]);
    fireEvent.click(editor.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("button", { name: "Edit Calculation" })).toBeVisible();
    expect(useEditorStore.getState().elements.slice(2)).toMatchObject([
      { id: total.id, calculationScript: script },
      { id: linked.id, calculationScript: script },
    ]);
    act(() => undo());
    fireEvent.click(screen.getByRole("button", { name: "Add Calculation" }));
    expect(screen.getByRole("textbox", { name: "JavaScript" })).toHaveValue("");
  });

  it("saves or discards a multiline button script from the editor dialog", () => {
    const button = createButtonField({
      name: "Update", x: 10, y: 10, pageNumber: 1,
    });
    const store = useEditorStore.getState();
    store.setPdf("test.pdf", new Uint8Array([1]), [
      { pageNumber: 1, width: 612, height: 792 },
    ]);
    store.setInitialElements([button]);
    store.selectElements(new Set([button.id]));

    render(<PropertiesPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Add JavaScript" }));
    const dialog = within(screen.getByRole("dialog", { name: "Button JavaScript" }));
    expect(dialog.getByRole("link", { name: "Acrobat JavaScript reference" }))
      .toHaveAttribute("href", "https://developer.adobe.com/acrobat-pdfl-sdk/guides/jsapiref/");
    const input = dialog.getByRole("textbox", { name: "JavaScript" });
    const script = 'this.getField("Quantity").value = 4;\nthis.calculateNow();';
    fireEvent.change(input, { target: { value: script } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(canUndo()).toBe(false);
    fireEvent.click(dialog.getByRole("button", { name: "Save" }));
    expect(useEditorStore.getState().elements[0]).toMatchObject({ actionScript: script });
    expect(canUndo()).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Edit JavaScript" }));
    fireEvent.change(screen.getByRole("textbox", { name: "JavaScript" }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(useEditorStore.getState().elements[0]).toMatchObject({ actionScript: script });
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

  it("does not carry a pending page edit to the next selected field", () => {
    const first = createTextField({
      x: 10,
      y: 10,
      pageNumber: 1,
      name: "first-field",
    });
    const second = createTextField({
      x: 50,
      y: 50,
      pageNumber: 2,
      name: "second-field",
    });
    const store = useEditorStore.getState();
    store.setPdf(
      "test.pdf",
      new Uint8Array([1]),
      [1, 2, 3].map((pageNumber) => ({ pageNumber, width: 612, height: 792 })),
    );
    store.setInitialElements([first, second]);
    store.selectElements(new Set([first.id]));

    render(<PropertiesPanel />);
    const pageLabel = /edit page number/i;
    fireEvent.click(screen.getByRole("button", { name: pageLabel }));
    const pageInput = screen.getByRole("textbox", { name: pageLabel });
    act(() => pageInput.focus());
    fireEvent.change(pageInput, { target: { value: "3" } });

    act(() => store.selectElements(new Set([second.id])));

    expect(screen.queryByRole("textbox", { name: pageLabel })).toBeNull();
    const pageButton = screen.getByRole("button", { name: pageLabel });
    expect(pageButton).toHaveTextContent("2");
    expect(useEditorStore.getState().elements).toEqual([first, second]);
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
