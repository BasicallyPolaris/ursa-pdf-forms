import { createTextField } from "@/lib/form-element-model";
import { redo, undo, useEditorStore } from "@/stores/editor-store";
import { beforeEach, describe, expect, it } from "vitest";

const testPages = [
  { pageNumber: 1, width: 612, height: 792 },
  { pageNumber: 2, width: 612, height: 792 },
];

describe("pasteClipboard", () => {
  beforeEach(() => {
    useEditorStore.getState().clearPdf();
    useEditorStore
      .getState()
      .setPdf("test.pdf", new Uint8Array([1]), testPages);
  });

  it("offsets position when pasting on the same page", () => {
    const el = createTextField({ x: 100, y: 200, pageNumber: 1, name: "field_a" });
    const store = useEditorStore.getState();
    store.addElement(el);
    store.selectElements(new Set([el.id]));
    store.copySelection();
    store.pasteClipboard(1);

    const pasted = useEditorStore
      .getState()
      .elements.filter((e) => e.id !== el.id);
    expect(pasted).toHaveLength(1);
    expect(pasted[0].pageNumber).toBe(1);
    expect(pasted[0].x).toBe(110);
    expect(pasted[0].y).toBe(210);
  });

  it("offsets when target page matches clipboard source page", () => {
    const a = createTextField({ x: 10, y: 20, pageNumber: 1, name: "a" });
    const b = createTextField({ x: 50, y: 60, pageNumber: 2, name: "b" });
    const store = useEditorStore.getState();
    store.addElement(a);
    store.addElement(b);
    store.selectElements(new Set([a.id, b.id]));
    store.copySelection();
    store.pasteClipboard(1);

    const pasted = useEditorStore
      .getState()
      .elements.filter((e) => e.id !== a.id && e.id !== b.id);
    expect(pasted).toHaveLength(2);
    for (const p of pasted) {
      expect(p.pageNumber).toBe(1);
      expect(p.x).toBeGreaterThanOrEqual(10);
      expect(p.y).toBeGreaterThanOrEqual(20);
    }
  });

  it("stacks offset on repeated same-page paste", () => {
    const el = createTextField({ x: 100, y: 200, pageNumber: 1, name: "field_a" });
    const store = useEditorStore.getState();
    store.addElement(el);
    store.selectElements(new Set([el.id]));
    store.copySelection();
    store.pasteClipboard(1);
    store.pasteClipboard(1);
    store.pasteClipboard(1);

    const pasted = useEditorStore
      .getState()
      .elements.filter((e) => e.id !== el.id)
      .sort((a, b) => a.x - b.x);
    expect(pasted).toHaveLength(3);
    expect(pasted[0].x).toBe(110);
    expect(pasted[0].y).toBe(210);
    expect(pasted[1].x).toBe(120);
    expect(pasted[1].y).toBe(220);
    expect(pasted[2].x).toBe(130);
    expect(pasted[2].y).toBe(230);
  });

  it("stacks offset on repeated paste to the same target page", () => {
    const el = createTextField({ x: 100, y: 200, pageNumber: 1, name: "field_a" });
    const store = useEditorStore.getState();
    store.addElement(el);
    store.selectElements(new Set([el.id]));
    store.copySelection();
    store.pasteClipboard(2);
    store.pasteClipboard(2);

    const pasted = useEditorStore
      .getState()
      .elements.filter((e) => e.id !== el.id)
      .sort((a, b) => a.x - b.x);
    expect(pasted).toHaveLength(2);
    expect(pasted[0]).toMatchObject({ pageNumber: 2, x: 100, y: 200 });
    expect(pasted[1]).toMatchObject({ pageNumber: 2, x: 110, y: 210 });
  });

  it("does not carry stack offset from one page to another", () => {
    const el = createTextField({ x: 100, y: 200, pageNumber: 1, name: "field_a" });
    const store = useEditorStore.getState();
    store.addElement(el);
    store.selectElements(new Set([el.id]));
    store.copySelection();
    store.pasteClipboard(1);
    store.pasteClipboard(1);
    store.pasteClipboard(2);

    const onPage2 = useEditorStore
      .getState()
      .elements.filter((e) => e.pageNumber === 2);
    expect(onPage2).toHaveLength(1);
    expect(onPage2[0].x).toBe(100);
    expect(onPage2[0].y).toBe(200);
  });

  it("resets per-page stack when copying new content", () => {
    const el = createTextField({ x: 100, y: 200, pageNumber: 1, name: "field_a" });
    const other = createTextField({ x: 40, y: 50, pageNumber: 1, name: "field_b" });
    const store = useEditorStore.getState();
    store.addElement(el);
    store.addElement(other);
    store.selectElements(new Set([el.id]));
    store.copySelection();
    store.pasteClipboard(1);
    store.pasteClipboard(1);
    store.selectElements(new Set([other.id]));
    store.copySelection();
    store.pasteClipboard(1);

    const pasted = useEditorStore
      .getState()
      .elements.filter((e) => e.id !== el.id && e.id !== other.id);
    expect(pasted).toHaveLength(3);
    const fromOther = pasted.find((e) => e.x === 50);
    expect(fromOther).toBeDefined();
    expect(fromOther!.y).toBe(60);
  });

  it("continues stacked offset from restored paste stack after undo", () => {
    const el = createTextField({ x: 100, y: 200, pageNumber: 1, name: "field_a" });
    const store = useEditorStore.getState();
    store.addElement(el);
    store.selectElements(new Set([el.id]));
    store.copySelection();
    store.pasteClipboard(1);
    store.pasteClipboard(1);
    undo();
    store.pasteClipboard(1);

    const pasted = useEditorStore
      .getState()
      .elements.filter((e) => e.id !== el.id)
      .sort((a, b) => a.x - b.x);
    expect(pasted).toHaveLength(2);
    expect(pasted[0].x).toBe(110);
    expect(pasted[1].x).toBe(120);
  });

  it("restores stacked offset after redo following undo", () => {
    const el = createTextField({ x: 100, y: 200, pageNumber: 1, name: "field_a" });
    const store = useEditorStore.getState();
    store.addElement(el);
    store.selectElements(new Set([el.id]));
    store.copySelection();
    store.pasteClipboard(1);
    store.pasteClipboard(1);
    undo();
    redo();
    store.pasteClipboard(1);

    const pasted = useEditorStore
      .getState()
      .elements.filter((e) => e.id !== el.id)
      .sort((a, b) => a.x - b.x);
    expect(pasted).toHaveLength(3);
    expect(pasted[2].x).toBe(130);
    expect(pasted[2].y).toBe(230);
  });

  it("resets stacked offset to first paste step after undoing all pastes", () => {
    const el = createTextField({ x: 100, y: 200, pageNumber: 1, name: "field_a" });
    const store = useEditorStore.getState();
    store.addElement(el);
    store.selectElements(new Set([el.id]));
    store.copySelection();
    store.pasteClipboard(1);
    store.pasteClipboard(1);
    undo();
    undo();
    store.pasteClipboard(1);

    const pasted = useEditorStore
      .getState()
      .elements.filter((e) => e.id !== el.id)
      .sort((a, b) => a.x - b.x);
    expect(pasted).toHaveLength(1);
    expect(pasted[0].x).toBe(110);
    expect(pasted[0].y).toBe(210);
  });

  it("keeps position when pasting on a different page", () => {
    const el = createTextField({ x: 100, y: 200, pageNumber: 1, name: "field_a" });
    const store = useEditorStore.getState();
    store.addElement(el);
    store.selectElements(new Set([el.id]));
    store.copySelection();
    store.pasteClipboard(2);

    const pasted = useEditorStore
      .getState()
      .elements.filter((e) => e.id !== el.id);
    expect(pasted).toHaveLength(1);
    expect(pasted[0].pageNumber).toBe(2);
    expect(pasted[0].x).toBe(100);
    expect(pasted[0].y).toBe(200);
  });
});
