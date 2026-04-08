import { pdfToScreen, screenToPdf } from "@/lib/coordinates";
import { lockCursor, unlockCursor } from "@/lib/cursor";
import type { FormElement, TextField } from "@/lib/form-element-model";
import type { PageLayout } from "@/lib/page-layout";
import {
  snapResizeBounds,
  type SnapContext,
  type SnapGuide,
} from "@/lib/snap-engine";
import { useEditorStore } from "@/stores/editor-store";
import { useCallback, useRef } from "react";

const MIN_SCREEN = 10;

interface MultiResizeConfig {
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

interface OriginalElement {
  id: string;
  pageNumber: number;
  screenX: number;
  screenY: number;
  screenW: number;
  screenH: number;
  heightLocked: boolean;
}

interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function useMultiResize(config: MultiResizeConfig) {
  const activeRef = useRef(false);
  const originalsRef = useRef<OriginalElement[]>([]);
  const origBboxRef = useRef<ScreenRect | null>(null);
  const currentBboxRef = useRef<ScreenRect | null>(null);
  const primaryPageRef = useRef(1);
  const prevSnapRef = useRef<{ x: number; y: number } | null>(null);
  const allHeightLockedRef = useRef(false);
  const snapOffsetRef = useRef({ dx: 0, dy: 0 });
  const resizableElRef = useRef<HTMLElement | null>(null);

  const handleResizeStart = useCallback(() => {
    const store = useEditorStore.getState();
    const selected = store.elements.filter((el) =>
      store.selectedIds.has(el.id),
    );
    if (selected.length < 2) return;

    const { zoom } = config;
    const screenData: OriginalElement[] = [];
    for (const el of selected) {
      const pl = config.layouts.get(el.pageNumber);
      if (!pl) continue;
      const screen = pdfToScreen(
        { x: el.x, y: el.y },
        { zoom, pageX: pl.xOffset, pageY: pl.yOffset },
      );
      screenData.push({
        id: el.id,
        pageNumber: el.pageNumber,
        screenX: screen.x,
        screenY: screen.y,
        screenW: el.width * zoom,
        screenH: el.height * zoom,
        heightLocked:
          (el.type === "text" && !(el as TextField).multiline) ||
          el.type === "dropdown" ||
          el.type === "optionlist",
      });
    }
    if (screenData.length < 2) return;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const s of screenData) {
      if (s.screenX < minX) minX = s.screenX;
      if (s.screenY < minY) minY = s.screenY;
      if (s.screenX + s.screenW > maxX) maxX = s.screenX + s.screenW;
      if (s.screenY + s.screenH > maxY) maxY = s.screenY + s.screenH;
    }
    const bbox: ScreenRect = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };

    const pageCount = new Map<number, number>();
    for (const s of screenData) {
      pageCount.set(s.pageNumber, (pageCount.get(s.pageNumber) ?? 0) + 1);
    }
    const primaryPage = [...pageCount.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0][0];

    const anyLocked = screenData.some((s) => s.heightLocked);
    activeRef.current = true;
    originalsRef.current = screenData;
    origBboxRef.current = bbox;
    currentBboxRef.current = bbox;
    primaryPageRef.current = primaryPage;
    prevSnapRef.current = null;
    allHeightLockedRef.current = anyLocked;
    snapOffsetRef.current = { dx: 0, dy: 0 };
  }, [config]);

  const handleResize = useCallback(
    (
      _dir: string,
      ref: HTMLElement,
      position: { x: number; y: number },
      resizeEvent: MouseEvent,
    ) => {
      if (!activeRef.current || !origBboxRef.current) return;
      const orig = origBboxRef.current;
      const { zoom } = config;
      const primaryLayout = config.layouts.get(primaryPageRef.current);

      const isHorizontal = _dir === "left" || _dir === "right";
      lockCursor(allHeightLockedRef.current || isHorizontal ? "ew" : "nwse");
      resizableElRef.current = ref;

      let sx = position.x;
      let sy = position.y;
      let sw = parseFloat(ref.style.width);
      let sh = parseFloat(ref.style.height);

      if (primaryLayout) {
        const prev = snapOffsetRef.current;
        const cleanX = position.x - prev.dx;
        const cleanY = position.y - prev.dy;
        const cleanW = sw;
        const cleanH = sh;
        const rawPdf = screenToPdf(
          { x: cleanX, y: cleanY },
          {
            zoom,
            pageX: primaryLayout.xOffset,
            pageY: primaryLayout.yOffset,
          },
        );
        const rawW = cleanW / zoom;
        const rawH = cleanH / zoom;

        const excludedIds = new Set(originalsRef.current.map((e) => e.id));
        const snapCtx = config.buildSnapContext(
          excludedIds,
          primaryPageRef.current,
          {
            shiftKey: resizeEvent.shiftKey,
            ctrlKey: resizeEvent.ctrlKey || resizeEvent.metaKey,
          },
        );

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
            rawW,
            rawH,
            _dir,
            snapCtx,
            snapOpts,
          );
          const snW = Math.max(MIN_SCREEN / zoom, result.width);
          const snH = Math.max(MIN_SCREEN / zoom, result.height);
          const snScreen = pdfToScreen(
            { x: result.x, y: result.y },
            {
              zoom,
              pageX: primaryLayout.xOffset,
              pageY: primaryLayout.yOffset,
            },
          );
          sx = snScreen.x;
          sy = snScreen.y;
          sw = snW * zoom;
          sh = snH * zoom;
          prevSnapRef.current = { x: result.x, y: result.y };

          const dx = snScreen.x - cleanX;
          const dy = snScreen.y - cleanY;
          ref.style.width = `${snW * zoom}px`;
          ref.style.height = `${snH * zoom}px`;
          ref.style.transform =
            dx !== 0 || dy !== 0 ? `translate(${dx}px, ${dy}px)` : "";
          snapOffsetRef.current = { dx, dy };

          config.setActiveGuides(
            snapCtx.snapToGrid
              ? result.guides.filter((g) => g.type !== "grid")
              : result.guides,
          );
        } else {
          prevSnapRef.current = null;
          ref.style.transform = "";
          snapOffsetRef.current = { dx: 0, dy: 0 };
          config.setActiveGuides([]);
        }
      }

      currentBboxRef.current = { x: sx, y: sy, width: sw, height: sh };

      const scaleX = orig.width > 0 ? sw / orig.width : 1;
      const scaleY = orig.height > 0 ? sh / orig.height : 1;

      const livePositions = new Map<
        string,
        { x: number; y: number; width: number; height: number }
      >();
      for (const o of originalsRef.current) {
        const elSx = sx + (o.screenX - orig.x) * scaleX;
        const elSy = sy + (o.screenY - orig.y) * scaleY;
        const elSw = o.screenW * scaleX;
        const elSh = o.heightLocked ? o.screenH : o.screenH * scaleY;
        const pl = config.layouts.get(o.pageNumber);
        if (!pl) continue;
        const pdf = screenToPdf(
          { x: elSx, y: elSy },
          { zoom, pageX: pl.xOffset, pageY: pl.yOffset },
        );
        livePositions.set(o.id, {
          x: pdf.x,
          y: pdf.y,
          width: elSw / zoom,
          height: elSh / zoom,
        });
      }
      config.setDragLivePositions(livePositions);
    },
    [config],
  );

  const handleResizeStop = useCallback(() => {
    if (!activeRef.current) return;
    const cur = currentBboxRef.current;
    const orig = origBboxRef.current;
    if (cur && orig) {
      const { zoom } = config;
      const scaleX = orig.width > 0 ? cur.width / orig.width : 1;
      const scaleY = orig.height > 0 ? cur.height / orig.height : 1;
      const store = useEditorStore.getState();
      const updates: Array<{ id: string; changes: Partial<FormElement> }> = [];
      for (const o of originalsRef.current) {
        const elSx = cur.x + (o.screenX - orig.x) * scaleX;
        const elSy = cur.y + (o.screenY - orig.y) * scaleY;
        const elSw = o.screenW * scaleX;
        const elSh = o.heightLocked ? o.screenH : o.screenH * scaleY;
        const pl = config.layouts.get(o.pageNumber);
        if (!pl) continue;
        const pdf = screenToPdf(
          { x: elSx, y: elSy },
          { zoom, pageX: pl.xOffset, pageY: pl.yOffset },
        );
        updates.push({
          id: o.id,
          changes: {
            x: pdf.x,
            y: pdf.y,
            width: elSw / zoom,
            ...(o.heightLocked ? {} : { height: elSh / zoom }),
          },
        });
      }
      if (updates.length > 0) store.batchUpdateElements(updates);
    }
    activeRef.current = false;
    originalsRef.current = [];
    origBboxRef.current = null;
    currentBboxRef.current = null;
    prevSnapRef.current = null;
    allHeightLockedRef.current = false;
    snapOffsetRef.current = { dx: 0, dy: 0 };
    if (resizableElRef.current) {
      resizableElRef.current.style.transform = "";
      resizableElRef.current = null;
    }
    unlockCursor();
    config.setActiveGuides([]);
    config.setDragLivePositions(null);
  }, [config]);

  return {
    isActive: activeRef,
    currentBbox: currentBboxRef,
    allHeightLocked: allHeightLockedRef,
    handleResizeStart,
    handleResize,
    handleResizeStop,
  };
}
