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
  const grip = screen.getByRole("button", { name: "Move Second, position 2" });
  fireEvent.keyDown(grip, { key: "ArrowUp" });
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

it("moves a field across several rows on drop", async () => {
  const fields = ["First", "Second", "Third"].map((name, index) =>
    createTextField({ name, x: 10, y: 10 + index * 20, pageNumber: 1 }),
  );
  const editor = useEditorStore.getState();
  editor.setPdf("test.pdf", new Uint8Array([1]), []);
  editor.setInitialElements(fields);

  render(<AppMenubar />);
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Reorder Fields" }),
  );
  const list = screen.getByRole("list");
  list.setPointerCapture = vi.fn();
  screen.getAllByRole("listitem").forEach((row, index) => {
    vi.spyOn(row, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, index * 40, 200, 40),
    );
  });
  const grip = screen.getByRole("button", { name: "Move First, position 1" });
  fireEvent.pointerDown(grip, { button: 0, pointerId: 1, clientY: 20 });
  fireEvent.pointerMove(list, { pointerId: 1, clientY: 116 });
  expect(isDirty()).toBe(false);
  fireEvent.pointerUp(list, { pointerId: 1, clientY: 116 });
  expect(
    screen.getByRole("button", { name: "Move First, position 3" }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));

  expect(getFieldsInTabOrder(useEditorStore.getState().elements)).toEqual([
    { ...fields[1], tabOrder: 0 },
    { ...fields[2], tabOrder: 1 },
    { ...fields[0], tabOrder: 2 },
  ]);
});

it("offers every PDF page and keeps drafts when switching between pages", async () => {
  const fields = [
    createTextField({ name: "Only field", x: 10, y: 20, pageNumber: 1 }),
    createTextField({ name: "First", x: 30, y: 40, pageNumber: 2 }),
    createTextField({ name: "Second", x: 50, y: 60, pageNumber: 2 }),
  ];
  const editor = useEditorStore.getState();
  editor.setPdf(
    "test.pdf",
    new Uint8Array([1]),
    [1, 2, 3].map((pageNumber) => ({ pageNumber, width: 612, height: 792 })),
  );
  editor.setInitialElements(fields);

  render(<AppMenubar />);
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Reorder Fields" }),
  );
  const picker = screen.getByRole("combobox", { name: "Page" });
  expect(picker).toHaveValue("2");
  expect(screen.getAllByRole("option")).toHaveLength(3);
  fireEvent.keyDown(
    screen.getByRole("button", { name: "Move Second, position 2" }),
    {
      key: "ArrowUp",
    },
  );

  fireEvent.change(picker, { target: { value: "1" } });
  expect(
    screen.getByRole("button", { name: "Move Only field, position 1" }),
  ).toBeDisabled();
  expect(screen.getByRole("listitem")).toHaveTextContent(/X 10\s*Y 20/);
  fireEvent.change(picker, { target: { value: "3" } });
  expect(screen.getByText("This page has no fields.")).toBeVisible();
  fireEvent.change(picker, { target: { value: "2" } });
  expect(
    screen.getByRole("button", { name: "Move Second, position 1" }),
  ).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(useEditorStore.getState().elements).toEqual([
    fields[0],
    { ...fields[1], tabOrder: 1 },
    { ...fields[2], tabOrder: 0 },
  ]);
});
