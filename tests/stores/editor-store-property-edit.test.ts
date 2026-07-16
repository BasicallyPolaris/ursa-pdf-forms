import { createTextField } from "@/lib/form-element-model";
import {
  createPropertyEditKey,
  getDisplayElements,
  getDisplayGuides,
  isDirty,
  undo,
  useEditorStore,
} from "@/stores/editor-store";
import { beforeEach, describe, expect, it } from "vitest";

describe("property edit sessions", () => {
  beforeEach(() => {
    useEditorStore.getState().clearPdf();
    useEditorStore
      .getState()
      .setPdf("test.pdf", new Uint8Array([1]), [
        { pageNumber: 1, width: 612, height: 792 },
      ]);
  });

  it("previews an element change without mutating the document or history", () => {
    const field = createTextField({
      x: 10,
      y: 10,
      pageNumber: 1,
      name: "original",
    });
    const store = useEditorStore.getState();
    store.setInitialElements([field]);

    store.beginPropertyEdit(
      createPropertyEditKey("name", [field.id]),
      "original",
    );
    store.previewPropertyEdit("preview", {
      elementUpdates: [{ id: field.id, changes: { name: "preview" } }],
    });

    expect(useEditorStore.getState().elements[0]).toMatchObject({
      name: "original",
    });
    expect(getDisplayElements(useEditorStore.getState())[0]).toMatchObject({
      name: "preview",
    });
    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(0);
  });

  it("commits a preview as one undoable document change", () => {
    const field = createTextField({
      x: 10,
      y: 10,
      pageNumber: 1,
      name: "original",
    });
    const store = useEditorStore.getState();
    store.setInitialElements([field]);

    store.beginPropertyEdit(
      createPropertyEditKey("name", [field.id]),
      "original",
    );
    store.previewPropertyEdit("preview", {
      elementUpdates: [{ id: field.id, changes: { name: "preview" } }],
    });
    store.previewPropertyEdit("committed", {
      elementUpdates: [{ id: field.id, changes: { name: "committed" } }],
    });
    store.commitPropertyEdit();

    expect(useEditorStore.getState().elements[0]).toMatchObject({
      name: "committed",
    });
    undo();
    expect(useEditorStore.getState().elements[0]).toMatchObject({
      name: "original",
    });
  });

  it("discards a preview without changing the document", () => {
    const field = createTextField({
      x: 10,
      y: 10,
      pageNumber: 1,
      name: "original",
    });
    const store = useEditorStore.getState();
    store.setInitialElements([field]);

    store.beginPropertyEdit(
      createPropertyEditKey("name", [field.id]),
      "original",
    );
    store.previewPropertyEdit("preview", {
      elementUpdates: [{ id: field.id, changes: { name: "preview" } }],
    });
    store.discardPropertyEdit();

    expect(getDisplayElements(useEditorStore.getState())[0]).toMatchObject({
      name: "original",
    });
    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(0);
  });

  it("commits the active preview before a persistent edit", () => {
    const field = createTextField({
      x: 10,
      y: 10,
      pageNumber: 1,
      name: "original",
    });
    const store = useEditorStore.getState();
    store.setInitialElements([field]);

    store.beginPropertyEdit(
      createPropertyEditKey("name", [field.id]),
      "original",
    );
    store.previewPropertyEdit("committed", {
      elementUpdates: [{ id: field.id, changes: { name: "committed" } }],
    });
    store.moveElements([{ id: field.id, x: 20, y: 20 }]);

    expect(useEditorStore.getState().elements[0]).toMatchObject({
      name: "committed",
      x: 20,
      y: 20,
    });
    undo();
    expect(useEditorStore.getState().elements[0]).toMatchObject({
      name: "committed",
      x: 10,
      y: 10,
    });
    undo();
    expect(useEditorStore.getState().elements[0]).toMatchObject({
      name: "original",
      x: 10,
      y: 10,
    });
  });

  it("previews and commits guide changes through the same interface", () => {
    const store = useEditorStore.getState();
    store.addGuide("horizontal", 25);
    useEditorStore.temporal.getState().clear();
    const guide = useEditorStore.getState().guides[0];

    store.beginPropertyEdit(
      createPropertyEditKey("position", [guide.id]),
      "25",
    );
    store.previewPropertyEdit("50", {
      guideUpdates: [{ id: guide.id, position: 50 }],
    });

    expect(useEditorStore.getState().guides[0].position).toBe(25);
    expect(getDisplayGuides(useEditorStore.getState())[0].position).toBe(50);

    store.commitPropertyEdit();
    expect(useEditorStore.getState().guides[0].position).toBe(50);
    undo();
    expect(useEditorStore.getState().guides[0].position).toBe(25);
  });

  it("drops a preview when the PDF is cleared", () => {
    const field = createTextField({
      x: 10,
      y: 10,
      pageNumber: 1,
      name: "original",
    });
    const store = useEditorStore.getState();
    store.setInitialElements([field]);
    store.beginPropertyEdit(
      createPropertyEditKey("name", [field.id]),
      "original",
    );
    store.previewPropertyEdit("preview", {
      elementUpdates: [{ id: field.id, changes: { name: "preview" } }],
    });

    store.clearPdf();

    expect(getDisplayElements(useEditorStore.getState())).toEqual([]);
    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(0);
  });

  it("treats an uncommitted preview as a dirty document", () => {
    const field = createTextField({
      x: 10,
      y: 10,
      pageNumber: 1,
      name: "original",
    });
    const store = useEditorStore.getState();
    store.setInitialElements([field]);

    store.beginPropertyEdit(
      createPropertyEditKey("name", [field.id]),
      "original",
    );
    store.previewPropertyEdit("preview", {
      elementUpdates: [{ id: field.id, changes: { name: "preview" } }],
    });

    expect(isDirty()).toBe(true);
    store.discardPropertyEdit();
    expect(isDirty()).toBe(false);
  });
});
