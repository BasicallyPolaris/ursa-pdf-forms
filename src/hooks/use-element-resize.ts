import { screenToPdf } from "@/lib/coordinates";
import { lockCursor, unlockCursor, type CursorType } from "@/lib/cursor";
import type { FormElement } from "@/lib/form-element-model";
import type { PageLayout } from "@/lib/page-layout";
import {
  snapResizeBounds,
  type SnapContext,
  type SnapGuide,
} from "@/lib/snap-engine";
import { useEditorStore } from "@/stores/editor-store";
import { useCallback, useRef, useState } from "react";

const MIN_SIZE = 10;

interface ElementResizeConfig {
  zoom: number;
  layouts: Map<number, PageLayout>;
  buildSnapContext: (
    excludedIds: Set<string>,
    pageNumber: number,
    modifiers: { shiftKey: boolean; ctrlKey: boolean },
  ) => SnapContext;
  setActiveGuides: (guides: SnapGuide[]) => void;
  setDragLivePositions: (
    positions: Map<
      string,
      { x: number; y: number; width: number; height: number }
    > | null,
  ) => void;
}

function dirToCursor(dir: string): CursorType {
  switch (dir) {
    case "left":
    case "right":
      return "ew";
    case "top":
    case "bottom":
      return "ns";
    case "topLeft":
    case "bottomRight":
      return "nwse";
    case "topRight":
    case "bottomLeft":
      return "nesw";
    default:
      return "nwse";
  }
}

export function useElementResize(config: ElementResizeConfig) {
  const resizingId = useRef<string | null>(null);
  const resizeHappenedRef = useRef(false);
  const lastResizeSnap = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const prevSnapRef = useRef<{ x: number; y: number } | null>(null);
  const [resizeSnapCorrection, setResizeSnapCorrection] = useState<{
    dx: number;
    dy: number;
    dw: number;
    dh: number;
  } | null>(null);

  const handleResize = useCallback(
    (
      el: FormElement,
      dir: string,
      ref: HTMLElement,
      position: { x: number; y: number },
      resizeEvent: MouseEvent,
    ) => {
      const isSingleInput =
        (el.type === "text" && !el.multiline) ||
        el.type === "dropdown" ||
        el.type === "optionlist";
      resizeHappenedRef.current = true;
      lockCursor(isSingleInput ? "ew" : dirToCursor(dir));
      resizingId.current = el.id;

      const pl = config.layouts.get(el.pageNumber);
      if (!pl) return;

      const { zoom } = config;
      const rawWidth = parseFloat(ref.style.width) / zoom;
      const rawHeight = parseFloat(ref.style.height) / zoom;
      const rawPdf = screenToPdf(
        { x: position.x, y: position.y },
        { zoom, pageX: pl.xOffset, pageY: pl.yOffset },
      );

      const snapCtx = config.buildSnapContext(new Set([el.id]), el.pageNumber, {
        shiftKey: resizeEvent.shiftKey,
        ctrlKey: resizeEvent.ctrlKey || resizeEvent.metaKey,
      });

      if (snapCtx.hasAnySnap) {
        const snapOpts = prevSnapRef.current
          ? {
              previousSnappedX: prevSnapRef.current.x,
              previousSnappedY: prevSnapRef.current.y,
            }
          : undefined;
        const result = snapResizeBounds(
          rawPdf.x,
          rawPdf.y,
          rawWidth,
          rawHeight,
          dir,
          snapCtx,
          snapOpts,
        );
        const snappedW = Math.max(MIN_SIZE / zoom, result.width);
        const snappedH = Math.max(MIN_SIZE / zoom, result.height);

        lastResizeSnap.current = {
          x: result.x,
          y: result.y,
          width: snappedW,
          height: snappedH,
        };
        prevSnapRef.current = { x: result.x, y: result.y };

        const dx = (result.x - rawPdf.x) * zoom;
        const dy = (result.y - rawPdf.y) * zoom;
        const dw = (snappedW - rawWidth) * zoom;
        const dh = (snappedH - rawHeight) * zoom;
        setResizeSnapCorrection({ dx, dy, dw, dh });
        config.setActiveGuides(
          snapCtx.snapToGrid
            ? result.guides.filter((g) => g.type !== "grid")
            : result.guides,
        );

        const livePositions = new Map<
          string,
          { x: number; y: number; width: number; height: number }
        >();
        livePositions.set(el.id, {
          x: result.x,
          y: result.y,
          width: snappedW,
          height: snappedH,
        });
        config.setDragLivePositions(livePositions);
      } else {
        lastResizeSnap.current = null;
        setResizeSnapCorrection(null);
        config.setActiveGuides([]);
      }
    },
    [config],
  );

  const handleResizeStop = useCallback(
    (el: FormElement) => {
      if (!resizeHappenedRef.current) {
        resizeHappenedRef.current = false;
        const store = useEditorStore.getState();
        if (!store.selectedIds.has(el.id)) {
          store.selectElements(new Set([el.id]));
        }
        resizingId.current = null;
        unlockCursor();
        return;
      }
      resizeHappenedRef.current = false;
      const snap = lastResizeSnap.current;
      if (snap) {
        useEditorStore.getState().updateElement(el.id, {
          x: snap.x,
          y: snap.y,
          width: snap.width,
          height: snap.height,
        });
      }
      lastResizeSnap.current = null;
      setResizeSnapCorrection(null);
      config.setActiveGuides([]);
      config.setDragLivePositions(null);
      resizingId.current = null;
      prevSnapRef.current = null;
      unlockCursor();
    },
    [config],
  );

  const resetState = useCallback(() => {
    resizeHappenedRef.current = false;
    lastResizeSnap.current = null;
    setResizeSnapCorrection(null);
    resizingId.current = null;
    prevSnapRef.current = null;
  }, []);

  return {
    resizingId,
    resizeSnapCorrection,
    handleResize,
    handleResizeStop,
    resetState,
  };
}
