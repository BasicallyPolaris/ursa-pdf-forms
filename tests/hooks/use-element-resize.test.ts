import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createTextField } from "@/lib/form-element-model";
import type { PageLayout } from "@/lib/page-layout";
import type { SnapContext } from "@/lib/snap-engine";
import { useElementResize } from "@/hooks/use-element-resize";
import { useEditorStore } from "@/stores/editor-store";

describe("useElementResize", () => {
  it("commits the raw geometry when Ctrl disables snapping", () => {
    const element = createTextField({
      x: 100,
      y: 200,
      pageNumber: 1,
      width: 150,
      height: 30,
    });
    useEditorStore.getState().setInitialElements([element]);

    const layouts = new Map<number, PageLayout>([
      [
        1,
        {
          xOffset: 10,
          yOffset: 20,
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
      useElementResize({
        zoom: 1,
        layouts,
        buildSnapContext: () => noSnapContext,
        setActiveGuides: () => {},
        setDragLivePositions: () => {},
      }),
    );
    const ref = document.createElement("div");
    ref.style.width = "210px";
    ref.style.height = "30px";

    act(() => {
      result.current.handleResize(
        element,
        "left",
        ref,
        { x: 70, y: 220 },
        new MouseEvent("mousemove", { ctrlKey: true }),
      );
      result.current.handleResizeStop(element);
    });

    expect(useEditorStore.getState().elements[0]).toMatchObject({
      x: 60,
      y: 200,
      width: 210,
      height: 30,
    });
  });
});
