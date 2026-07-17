import { act, renderHook } from "@testing-library/react";
import { createTextField } from "@/lib/form-element-model";
import type { PageLayout } from "@/lib/page-layout";
import type { SnapContext } from "@/lib/snap-engine";
import { useElementDrag } from "@/hooks/use-element-drag";
import {
  createPropertyEditKey,
  getDisplayElements,
  useEditorStore,
} from "@/stores/editor-store";
import { beforeEach, describe, expect, it } from "vitest";

describe("useElementDrag", () => {
  beforeEach(() => {
    useEditorStore.getState().clearPdf();
  });

  it("starts a multi-drag from focused property preview geometry", () => {
    const first = createTextField({
      x: 10,
      y: 10,
      pageNumber: 1,
      name: "first",
    });
    const second = createTextField({
      x: 20,
      y: 20,
      pageNumber: 1,
      name: "second",
    });
    const store = useEditorStore.getState();
    store.setInitialElements([first, second]);
    store.selectElements(new Set([first.id, second.id]));
    store.beginPropertyEdit(
      createPropertyEditKey("x", [first.id, second.id]),
      "100",
    );
    store.previewPropertyEdit("100", {
      elementUpdates: [
        { id: first.id, changes: { x: 100 } },
        { id: second.id, changes: { x: 100 } },
      ],
    });

    const layouts = new Map<number, PageLayout>([
      [
        1,
        {
          xOffset: 0,
          yOffset: 0,
          screenWidth: 612,
          screenHeight: 792,
        },
      ],
    ]);
    const noSnapContext: SnapContext = {
      gridSize: 10,
      snapThreshold: 5,
      pageWidth: 612,
      pageHeight: 792,
      otherElements: [],
      rulerGuides: [],
      snapToGrid: false,
      snapToPageEdges: false,
      snapToElements: false,
      snapToGuides: false,
      hasAnySnap: false,
    };
    const { result } = renderHook(() =>
      useElementDrag({
        zoom: 1,
        layouts,
        pages: [{ pageNumber: 1, width: 612, height: 792 }],
        buildSnapContext: () => noSnapContext,
        resolveTargetPage: () => 1,
        setActiveGuides: () => {},
        setDragLivePositions: () => {},
      }),
    );
    const previewFirst = getDisplayElements(useEditorStore.getState())[0];

    act(() => {
      result.current.handleDragStart(previewFirst, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      } as React.MouseEvent);
      result.current.handleDragStop(
        previewFirst,
        { x: 100, y: 10 },
        { x: 105, y: 10 },
        new MouseEvent("mouseup"),
      );
    });

    expect(useEditorStore.getState().elements).toEqual([
      expect.objectContaining({ id: first.id, x: 105 }),
      expect.objectContaining({ id: second.id, x: 105 }),
    ]);
  });
});
