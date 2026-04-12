import { pdfToScreen, screenToPdf } from "@/lib/coordinates";
import { lockCursor, unlockCursor } from "@/lib/cursor";
import type { FormElement } from "@/lib/form-element-model";
import type { PageLayout } from "@/lib/page-layout";
import type { PageInfo } from "@/lib/pdf-loader";
import {
  snapPosition,
  type SnapContext,
  type SnapGuide,
} from "@/lib/snap-engine";
import { useEditorStore } from "@/stores/editor-store";
import { useCallback, useRef, useState } from "react";

interface ElementDragConfig {
  zoom: number;
  layouts: Map<number, PageLayout>;
  pages: PageInfo[];
  buildSnapContext: (
    excludedIds: Set<string>,
    pageNumber: number,
    modifiers: { shiftKey: boolean; ctrlKey: boolean },
  ) => SnapContext;
  resolveTargetPage: (
    pdfX: number,
    pdfY: number,
    width: number,
    height: number,
    originalPageNumber: number,
    layouts: Map<number, PageLayout>,
  ) => number;
  setActiveGuides: (guides: SnapGuide[]) => void;
  setDragLivePositions: (
    positions: Map<
      string,
      { x: number; y: number; width: number; height: number }
    > | null,
  ) => void;
}

export function useElementDrag(config: ElementDragConfig) {
  const dragStartPositions = useRef<Map<
    string,
    { x: number; y: number }
  > | null>(null);
  const draggingId = useRef<string | null>(null);
  const pendingToggleId = useRef<string | null>(null);
  const prevSnapRef = useRef<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{
    dx: number;
    dy: number;
  } | null>(null);
  const [dragSnapCorrection, setDragSnapCorrection] = useState<{
    dx: number;
    dy: number;
  } | null>(null);

  const handleDragStart = useCallback(
    (el: FormElement, mouseEvent: React.MouseEvent) => {
      const store = useEditorStore.getState();
      const shiftOrCtrl =
        mouseEvent.shiftKey || mouseEvent.ctrlKey || mouseEvent.metaKey;
      const isSelected = store.selectedIds.has(el.id);

      if (!isSelected) {
        if (shiftOrCtrl) {
          const next = new Set(store.selectedIds);
          next.add(el.id);
          store.selectElements(next);
        } else {
          store.selectElements(new Set([el.id]));
        }
      } else if (shiftOrCtrl) {
        pendingToggleId.current = el.id;
      }
      lockCursor("grab");

      const positions = new Map<string, { x: number; y: number }>();
      for (const e of store.elements) {
        positions.set(e.id, { x: e.x, y: e.y });
      }
      dragStartPositions.current = positions;
      draggingId.current = el.id;
      setDragOffset(null);
      setDragSnapCorrection(null);
      config.setActiveGuides([]);
    },
    [config],
  );

  const handleDrag = useCallback(
    (
      el: FormElement,
      screen: { x: number; y: number },
      d: { x: number; y: number },
      me: MouseEvent,
    ) => {
      if (pendingToggleId.current) pendingToggleId.current = null;

      const { zoom } = config;
      const deltaX = d.x - screen.x;
      const deltaY = d.y - screen.y;
      const rawDx = deltaX / zoom;
      const rawDy = deltaY / zoom;

      const store = useEditorStore.getState();
      const currentSelectedIds = store.selectedIds;
      const isMultiDrag =
        currentSelectedIds.size > 1 && currentSelectedIds.has(el.id);

      const livePositions = new Map<
        string,
        { x: number; y: number; width: number; height: number }
      >();
      let correctionDx = 0;
      let correctionDy = 0;
      let guides: SnapGuide[] = [];

      const snapCtx = config.buildSnapContext(
        isMultiDrag ? currentSelectedIds : new Set([el.id]),
        el.pageNumber,
        { shiftKey: me.shiftKey, ctrlKey: me.ctrlKey || me.metaKey },
      );

      if (snapCtx.hasAnySnap) {
        const snapOpts = prevSnapRef.current
          ? {
              previousSnappedX: prevSnapRef.current.x,
              previousSnappedY: prevSnapRef.current.y,
            }
          : undefined;

        if (isMultiDrag) {
          const elements = store.elements;
          const selectedOnPage = elements.filter(
            (e) =>
              currentSelectedIds.has(e.id) && e.pageNumber === el.pageNumber,
          );
          if (selectedOnPage.length >= 2) {
            let minBX = Infinity,
              minBY = Infinity,
              maxBX = -Infinity,
              maxBY = -Infinity;
            for (const selEl of selectedOnPage) {
              const sp = dragStartPositions.current?.get(selEl.id);
              if (!sp) continue;
              const px = sp.x + rawDx;
              const py = sp.y + rawDy;
              if (px < minBX) minBX = px;
              if (py < minBY) minBY = py;
              if (px + selEl.width > maxBX) maxBX = px + selEl.width;
              if (py + selEl.height > maxBY) maxBY = py + selEl.height;
            }
            const result = snapPosition(
              minBX,
              minBY,
              maxBX - minBX,
              maxBY - minBY,
              snapCtx,
              snapOpts,
            );
            correctionDx = result.x - minBX;
            correctionDy = result.y - minBY;
            guides = result.guides;
            prevSnapRef.current = { x: result.x, y: result.y };
          } else {
            const proposedX = el.x + rawDx;
            const proposedY = el.y + rawDy;
            const result = snapPosition(
              proposedX,
              proposedY,
              el.width,
              el.height,
              snapCtx,
              snapOpts,
            );
            correctionDx = result.x - proposedX;
            correctionDy = result.y - proposedY;
            guides = result.guides;
            prevSnapRef.current = { x: result.x, y: result.y };
          }
        } else {
          const proposedX = el.x + rawDx;
          const proposedY = el.y + rawDy;
          const result = snapPosition(
            proposedX,
            proposedY,
            el.width,
            el.height,
            snapCtx,
            snapOpts,
          );
          correctionDx = result.x - proposedX;
          correctionDy = result.y - proposedY;
          guides = result.guides;
          prevSnapRef.current = { x: result.x, y: result.y };
        }
      }

      setDragOffset({
        dx: deltaX + correctionDx * zoom,
        dy: deltaY + correctionDy * zoom,
      });
      setDragSnapCorrection(
        snapCtx.hasAnySnap
          ? { dx: correctionDx * zoom, dy: correctionDy * zoom }
          : null,
      );
      config.setActiveGuides(
        snapCtx.snapToGrid ? guides.filter((g) => g.type !== "grid") : guides,
      );

      const elements = store.elements;
      if (isMultiDrag) {
        for (const selEl of elements) {
          if (!currentSelectedIds.has(selEl.id)) continue;
          const sp = dragStartPositions.current?.get(selEl.id);
          if (!sp) continue;
          livePositions.set(selEl.id, {
            x: sp.x + rawDx + correctionDx,
            y: sp.y + rawDy + correctionDy,
            width: selEl.width,
            height: selEl.height,
          });
        }
      } else {
        livePositions.set(el.id, {
          x: el.x + rawDx + correctionDx,
          y: el.y + rawDy + correctionDy,
          width: el.width,
          height: el.height,
        });
      }
      config.setDragLivePositions(livePositions);
    },
    [config],
  );

  const handleDragStop = useCallback(
    (
      el: FormElement,
      screen: { x: number; y: number },
      d: { x: number; y: number },
      me: MouseEvent,
    ) => {
      const store = useEditorStore.getState();
      const { zoom, layouts, pages, resolveTargetPage } = config;

      if (pendingToggleId.current === el.id) {
        store.toggleInSelection(el.id);
        pendingToggleId.current = null;
        cleanup();
        unlockCursor();
        return;
      }

      const dragDx = d.x - screen.x;
      const dragDy = d.y - screen.y;
      if (Math.abs(dragDx) < 0.5 && Math.abs(dragDy) < 0.5) {
        cleanup();
        unlockCursor();
        return;
      }

      const currentSelectedIds = store.selectedIds;

      if (currentSelectedIds.size > 1 && currentSelectedIds.has(el.id)) {
        const rawDx = (d.x - screen.x) / zoom;
        const rawDy = (d.y - screen.y) / zoom;
        const elements = store.elements;
        const selectedOnPage = elements.filter(
          (e) => currentSelectedIds.has(e.id) && e.pageNumber === el.pageNumber,
        );

        let correctionDx = 0;
        let correctionDy = 0;
        const snapCtx = config.buildSnapContext(
          currentSelectedIds,
          el.pageNumber,
          {
            shiftKey: me.shiftKey,
            ctrlKey: me.ctrlKey || me.metaKey,
          },
        );

        if (snapCtx.hasAnySnap) {
          const snapOpts = prevSnapRef.current
            ? {
                previousSnappedX: prevSnapRef.current.x,
                previousSnappedY: prevSnapRef.current.y,
              }
            : undefined;
          if (selectedOnPage.length >= 2) {
            let minBX = Infinity,
              minBY = Infinity,
              maxBX = -Infinity,
              maxBY = -Infinity;
            for (const selEl of selectedOnPage) {
              const sp = dragStartPositions.current?.get(selEl.id);
              if (!sp) continue;
              const px = sp.x + rawDx;
              const py = sp.y + rawDy;
              if (px < minBX) minBX = px;
              if (py < minBY) minBY = py;
              if (px + selEl.width > maxBX) maxBX = px + selEl.width;
              if (py + selEl.height > maxBY) maxBY = py + selEl.height;
            }
            const result = snapPosition(
              minBX,
              minBY,
              maxBX - minBX,
              maxBY - minBY,
              snapCtx,
              snapOpts,
            );
            correctionDx = result.x - minBX;
            correctionDy = result.y - minBY;
          } else {
            const proposedX = el.x + rawDx;
            const proposedY = el.y + rawDy;
            const result = snapPosition(
              proposedX,
              proposedY,
              el.width,
              el.height,
              snapCtx,
              snapOpts,
            );
            correctionDx = result.x - proposedX;
            correctionDy = result.y - proposedY;
          }
        }

        const updates: Array<{
          id: string;
          x: number;
          y: number;
          pageNumber?: number;
        }> = [];
        for (const otherEl of elements) {
          if (!currentSelectedIds.has(otherEl.id)) continue;
          const startPos = dragStartPositions.current?.get(otherEl.id);
          if (startPos) {
            const newX = startPos.x + rawDx + correctionDx;
            const newY = startPos.y + rawDy + correctionDy;
            const tp = resolveTargetPage(
              newX,
              newY,
              otherEl.width,
              otherEl.height,
              otherEl.pageNumber,
              layouts,
            );
            if (tp !== otherEl.pageNumber) {
              const oldLayout = layouts.get(otherEl.pageNumber)!;
              const newLayout = layouts.get(tp)!;
              const targetPageInfo = pages.find((p) => p.pageNumber === tp)!;
              const sPt = pdfToScreen(
                { x: newX + otherEl.width / 2, y: newY + otherEl.height / 2 },
                { zoom, pageX: oldLayout.xOffset, pageY: oldLayout.yOffset },
              );
              const newPdf = screenToPdf(sPt, {
                zoom,
                pageX: newLayout.xOffset,
                pageY: newLayout.yOffset,
              });
              updates.push({
                id: otherEl.id,
                x: Math.max(
                  0,
                  Math.min(
                    newPdf.x - otherEl.width / 2,
                    targetPageInfo.width - otherEl.width,
                  ),
                ),
                y: Math.max(
                  0,
                  Math.min(
                    newPdf.y - otherEl.height / 2,
                    targetPageInfo.height - otherEl.height,
                  ),
                ),
                pageNumber: tp,
              });
            } else {
              updates.push({ id: otherEl.id, x: newX, y: newY });
            }
          }
        }
        store.moveElements(updates);
      } else {
        const snapCtx = config.buildSnapContext(
          new Set([el.id]),
          el.pageNumber,
          {
            shiftKey: me.shiftKey,
            ctrlKey: me.ctrlKey || me.metaKey,
          },
        );
        const proposedX = el.x + (d.x - screen.x) / zoom;
        const proposedY = el.y + (d.y - screen.y) / zoom;
        let finalX = proposedX;
        let finalY = proposedY;
        if (snapCtx.hasAnySnap) {
          const snapOpts = prevSnapRef.current
            ? {
                previousSnappedX: prevSnapRef.current.x,
                previousSnappedY: prevSnapRef.current.y,
              }
            : undefined;
          const result = snapPosition(
            proposedX,
            proposedY,
            el.width,
            el.height,
            snapCtx,
            snapOpts,
          );
          finalX = result.x;
          finalY = result.y;
        }
        const targetPage = resolveTargetPage(
          finalX,
          finalY,
          el.width,
          el.height,
          el.pageNumber,
          layouts,
        );
        if (targetPage !== el.pageNumber) {
          const oldLayout = layouts.get(el.pageNumber)!;
          const newLayout = layouts.get(targetPage)!;
          const targetPageInfo = pages.find(
            (p) => p.pageNumber === targetPage,
          )!;
          const screenPt = pdfToScreen(
            { x: finalX + el.width / 2, y: finalY + el.height / 2 },
            { zoom, pageX: oldLayout.xOffset, pageY: oldLayout.yOffset },
          );
          const newPdf = screenToPdf(screenPt, {
            zoom,
            pageX: newLayout.xOffset,
            pageY: newLayout.yOffset,
          });
          store.updateElement(el.id, {
            x: Math.max(
              0,
              Math.min(
                newPdf.x - el.width / 2,
                targetPageInfo.width - el.width,
              ),
            ),
            y: Math.max(
              0,
              Math.min(
                newPdf.y - el.height / 2,
                targetPageInfo.height - el.height,
              ),
            ),
            pageNumber: targetPage,
          });
        } else {
          store.updateElement(el.id, { x: finalX, y: finalY });
        }
      }

      cleanup();
      unlockCursor();
    },
    [config],
  );

  function cleanup() {
    dragStartPositions.current = null;
    draggingId.current = null;
    setDragOffset(null);
    setDragSnapCorrection(null);
    config.setActiveGuides([]);
    config.setDragLivePositions(null);
    prevSnapRef.current = null;
  }

  return {
    draggingId,
    dragOffset,
    dragSnapCorrection,
    handleDragStart,
    handleDrag,
    handleDragStop,
    cleanup,
  };
}
