import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppMenubar } from "@/components/app-menubar";
import { getFieldsInTabOrder } from "@/lib/field-tab-order";
import { createTextField } from "@/lib/form-element-model";
import { isDirty, undo, useEditorStore } from "@/stores/editor-store";

vi.mock("@/lib/pdf-loader", () => ({ loadPdfDocument: vi.fn() }));

afterEach(() => {
  cleanup();
  useEditorStore.getState().clearPdf();
});

it("opens from Edit and applies a single undoable field-order change", async () => {
  const first = createTextField({ x: 10, y: 10, pageNumber: 1, name: "First" });
  const second = createTextField({
    x: 20,
    y: 20,
    pageNumber: 1,
    name: "Second",
  });
  const editor = useEditorStore.getState();
  editor.setPdf("test.pdf", new Uint8Array([1]), []);
  editor.setInitialElements([first, second]);

  render(<AppMenubar />);
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  const orderItem = await screen.findByRole("menuitem", {
    name: "Reorder Fields",
  });
  fireEvent.click(orderItem);
  await screen.findByRole("dialog", { name: "Reorder Fields" });
  fireEvent.click(screen.getByRole("button", { name: "Move Second up" }));
  expect(isDirty()).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));

  const elements = useEditorStore.getState().elements;
  expect(elements.map((field) => field.id)).toEqual([first.id, second.id]);
  expect(getFieldsInTabOrder(elements).map((field) => field.id)).toEqual([
    second.id,
    first.id,
  ]);
  expect(isDirty()).toBe(true);
  act(() => undo());
  expect(useEditorStore.getState().elements).toEqual([first, second]);
  expect(isDirty()).toBe(false);
});
