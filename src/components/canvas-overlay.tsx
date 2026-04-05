import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { useEditorStore } from "@/stores/editor-store";
import {
  type FormElement,
  getElementName,
} from "@/lib/form-element-model";
import { pdfToScreen, screenToPdf } from "@/lib/coordinates";
import {
  computePageLayouts,
  findPageAtScreenPoint,
  getTotalContentHeight,
} from "@/lib/page-layout";
import {
  snapPosition,
  snapResizeBounds,
  hasAnySnap,
  type SnapGuide,
  type SnapContext,
} from "@/lib/snap-engine";
import {
  CanvasContextMenu,
  type MenuContext,
} from "@/components/canvas-context-menu";
import { lockCursor, unlockCursor } from "@/lib/cursor";
import { isEditableElement, getScrollContainer } from "@/lib/dom-utils";
import { getElementStyleConfig } from "@/lib/element-style-map";
import { useVisiblePages } from "@/contexts/visible-pages";
import { useMarquee } from "@/hooks/use-marquee";
import { useElementCreation } from "@/hooks/use-element-creation";
import { SnapGuidesLayer } from "@/components/canvas-overlay/snap-guides-layer";
import { GuidesLayer } from "@/components/canvas-overlay/guides-layer";
import { DrawPreview } from "@/components/canvas-overlay/draw-preview";
import { BoundingRectOverlay } from "@/components/canvas-overlay/bounding-rect-overlay";
import { MarqueeOverlay } from "@/components/canvas-overlay/marquee-overlay";

const MIN_SIZE = 10;

export function CanvasOverlay() {
  const elements = useEditorStore((s) => s.elements);
  const activeTool = useEditorStore((s) => s.activeTool);
  const zoom = useEditorStore((s) => s.zoom);
  const pages = useEditorStore((s) => s.pages);
  const pdfBytes = useEditorStore((s) => s.pdfBytes);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const gridSize = useEditorStore((s) => s.gridSize);
  const guides = useEditorStore((s) => s.guides);
  const previewGuide = useEditorStore((s) => s.previewGuide);
  const selectedGuideId = useEditorStore((s) => s.selectedGuideId);
  const dragLivePositions = useEditorStore((s) => s.dragLivePositions);
  const visiblePages = useVisiblePages();

  const updateElement = useEditorStore((s) => s.updateElement);
  const selectElements = useEditorStore((s) => s.selectElements);
  const toggleInSelection = useEditorStore((s) => s.toggleInSelection);
  const moveElements = useEditorStore((s) => s.moveElements);
  const setDragLivePositions = useEditorStore((s) => s.setDragLivePositions);

  const overlayRef = useRef<HTMLDivElement>(null);
  const [overlayWidth, setOverlayWidth] = useState(0);

  const dragStartPositions = useRef<Map<string, { x: number; y: number }>>(
    new Map(),
  );
  const draggingId = useRef<string | null>(null);
  const pendingToggleId = useRef<string | null>(null);
  const resizingId = useRef<string | null>(null);
  const resizeHappenedRef = useRef(false);
  const [dragOffset, setDragOffset] = useState<{
    dx: number;
    dy: number;
  } | null>(null);
  const [dragSnapCorrection, setDragSnapCorrection] = useState<{
    dx: number;
    dy: number;
  } | null>(null);
  const lastResizeSnap = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [resizeSnapCorrection, setResizeSnapCorrection] = useState<{
    dx: number;
    dy: number;
    dw: number;
    dh: number;
  } | null>(null);
  const [activeGuides, setActiveGuides] = useState<SnapGuide[]>([]);
  const prevSnapRef = useRef<{ x: number; y: number } | null>(null);

  const [contextMenuState, setContextMenuState] = useState<{
    context: MenuContext;
    clientX: number;
    clientY: number;
  } | null>(null);
  const closeContextMenu = useCallback(() => setContextMenuState(null), []);

  const {
    marqueeRect,
    startMarquee,
    updateMarquee,
    finishMarquee,
  } = useMarquee();

  const {
    drawRect,
    drawStartRef,
    isDrawingRef,
    handleClickCreate,
    startDraw,
    updateDraw,
    finishDraw,
    resetDraw,
    HORIZONTAL_DRAW_TOOLS,
  } = useElementCreation();

  useLayoutEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    setOverlayWidth(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      setOverlayWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const getPageLayouts = useCallback(
    (): Map<
      number,
      {
        xOffset: number;
        yOffset: number;
        screenWidth: number;
        screenHeight: number;
      }
    > => {
      return computePageLayouts(pages, zoom, overlayWidth);
    },
    [pages, zoom, overlayWidth],
  );

  const findPageAtPoint = useCallback(
    (
      screenX: number,
      screenY: number,
      layouts: Map<
        number,
        {
          xOffset: number;
          yOffset: number;
          screenWidth: number;
          screenHeight: number;
        }
      >,
    ) => {
      return findPageAtScreenPoint(screenX, screenY, layouts);
    },
    [],
  );

  const resolveTargetPage = useCallback(
    (
      pdfX: number,
      pdfY: number,
      width: number,
      height: number,
      originalPageNumber: number,
      layouts: Map<
        number,
        {
          xOffset: number;
          yOffset: number;
          screenWidth: number;
          screenHeight: number;
        }
      >,
    ): number => {
      const origLayout = layouts.get(originalPageNumber);
      if (!origLayout) return originalPageNumber;
      const centerX = pdfX + width / 2;
      const centerY = pdfY + height / 2;
      const screenPt = pdfToScreen(
        { x: centerX, y: centerY },
        { zoom, pageX: origLayout.xOffset, pageY: origLayout.yOffset },
      );
      const targetPage = findPageAtPoint(screenPt.x, screenPt.y, layouts);
      return targetPage ?? originalPageNumber;
    },
    [zoom, findPageAtPoint],
  );

  const elementsByPage = useMemo(() => {
    const map = new Map<
      number,
      Array<{
        id: string;
        x: number;
        y: number;
        width: number;
        height: number;
      }>
    >();
    for (const el of elements) {
      let arr = map.get(el.pageNumber);
      if (!arr) {
        arr = [];
        map.set(el.pageNumber, arr);
      }
      arr.push({
        id: el.id,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
      });
    }
    return map;
  }, [elements]);

  const rulerGuideSnapData = useMemo(
    () =>
      guides.map((g) => ({
        orientation: g.orientation,
        position: g.position,
      })),
    [guides],
  );

  const buildSnapContext = useCallback(
    (
      excludedIds: Set<string>,
      pageNumber: number,
      modifiers: { shiftKey: boolean; ctrlKey: boolean },
    ): SnapContext => {
      const page = pages.find((p) => p.pageNumber === pageNumber);
      const freeMovement = modifiers.ctrlKey;
      const pageElements = elementsByPage.get(pageNumber) ?? [];
      return {
        gridSize,
        snapThreshold: 5,
        pageWidth: page?.width ?? 612,
        pageHeight: page?.height ?? 792,
        otherElements:
          excludedIds.size > 0
            ? pageElements.filter((el) => !excludedIds.has(el.id))
            : pageElements,
        rulerGuides: rulerGuideSnapData,
        snapToGrid: modifiers.shiftKey && !freeMovement,
        snapToPageEdges: !modifiers.shiftKey && !freeMovement,
        snapToElements: !modifiers.shiftKey && !freeMovement,
        snapToGuides: !modifiers.shiftKey && !freeMovement,
      };
    },
    [elementsByPage, pages, gridSize, rulerGuideSnapData],
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;

      const elementTarget = (e.target as HTMLElement).closest(
        "[data-element-overlay]",
      );
      if (elementTarget) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const layouts = getPageLayouts();
      const pageNumber = findPageAtPoint(screenX, screenY, layouts);

      if (activeTool === "select") {
        startMarquee(screenX, screenY, e.shiftKey);
        return;
      }

      if (!pageNumber) return;

      const layout = layouts.get(pageNumber)!;

      if (
        handleClickCreate(
          screenX,
          screenY,
          pageNumber,
          activeTool,
          zoom,
          layout,
          elements.length,
        )
      ) {
        return;
      }

      const snapCtx = buildSnapContext(new Set(), pageNumber, {
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey || e.metaKey,
      });
      if (
        startDraw(
          screenX,
          screenY,
          pageNumber,
          activeTool,
          zoom,
          layout,
          snapCtx,
        )
      ) {
        return;
      }
    },
    [
      activeTool,
      zoom,
      elements.length,
      getPageLayouts,
      findPageAtPoint,
      buildSnapContext,
      startMarquee,
      handleClickCreate,
      startDraw,
    ],
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      if (isDrawingRef.current || drawStartRef.current) {
        const start = drawStartRef.current;
        if (start) {
          const snapCtx = buildSnapContext(new Set(), start.pageNumber, {
            shiftKey: e.shiftKey,
            ctrlKey: e.ctrlKey || e.metaKey,
          });
          updateDraw(currentX, currentY, zoom, snapCtx);
        }
        return;
      }

      updateMarquee(currentX, currentY);
    },
    [zoom, buildSnapContext, updateDraw, updateMarquee, isDrawingRef, drawStartRef],
  );

  const handleCanvasMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDrawingRef.current && drawStartRef.current) {
        finishDraw(activeTool, zoom, elements.length);
        setActiveGuides([]);
        return;
      }

      resetDraw();
      setActiveGuides([]);

      const layouts = getPageLayouts();
      finishMarquee(
        e.shiftKey,
        elements,
        zoom,
        layouts,
      );
    },
    [
      activeTool,
      zoom,
      elements,
      getPageLayouts,
      finishDraw,
      resetDraw,
      finishMarquee,
      isDrawingRef,
      drawStartRef,
    ],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableElement(e)) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        const layouts = getPageLayouts();
        if (layouts.size === 0) return;
        const scrollEl = getScrollContainer();
        if (!scrollEl) return;
        const scrollCenter =
          scrollEl.scrollTop + scrollEl.clientHeight / 2;
        let closestPage = 1;
        let closestDist = Infinity;
        for (const [pageNum, layout] of layouts) {
          const pageCenter = layout.yOffset + layout.screenHeight / 2;
          const dist = Math.abs(pageCenter - scrollCenter);
          if (dist < closestDist) {
            closestDist = dist;
            closestPage = pageNum;
          }
        }
        const pageIds = elements
          .filter((el) => el.pageNumber === closestPage)
          .map((el) => el.id);
        selectElements(new Set(pageIds));
      }

      const store = useEditorStore.getState();
      if (store.selectedIds.size === 0) return;
      if (!store.pdfBytes) return;

      const nudge = e.shiftKey ? 5 : 1;
      let dx = 0;
      let dy = 0;

      if (e.key === "ArrowLeft") {
        dx = -nudge;
      } else if (e.key === "ArrowRight") {
        dx = nudge;
      } else if (e.key === "ArrowUp") {
        dy = -nudge;
      } else if (e.key === "ArrowDown") {
        dy = nudge;
      } else return;

      e.preventDefault();
      const updates: Array<{ id: string; x: number; y: number }> = [];
      for (const el of store.elements) {
        if (store.selectedIds.has(el.id)) {
          updates.push({ id: el.id, x: el.x + dx, y: el.y + dy });
        }
      }
      if (updates.length > 0) {
        store.moveElements(updates);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [elements, getPageLayouts, selectElements]);

  const handleOverlayContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();

      const elementTarget = (e.target as HTMLElement).closest(
        "[data-element-overlay]",
      );
      if (elementTarget) {
        const elementId = elementTarget.getAttribute("data-element-id")!;
        const store = useEditorStore.getState();
        if (!store.selectedIds.has(elementId)) {
          selectElements(new Set([elementId]));
        }
        const el = store.elements.find((el) => el.id === elementId);
        const rect = e.currentTarget.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const layouts = getPageLayouts();
        const layout = layouts.get(el?.pageNumber ?? 1);
        const pdf = layout
          ? screenToPdf(
              { x: screenX, y: screenY },
              { zoom, pageX: layout.xOffset, pageY: layout.yOffset },
            )
          : { x: 0, y: 0 };
        setContextMenuState({
          context: {
            type: "element",
            pageNumber: el?.pageNumber ?? 1,
            pdfX: pdf.x,
            pdfY: pdf.y,
          },
          clientX: e.clientX,
          clientY: e.clientY,
        });
        return;
      }

      const guideTarget = (e.target as HTMLElement).closest(
        "[data-guide-line]",
      );
      if (guideTarget) {
        const guideId = guideTarget.getAttribute("data-guide-id")!;
        const selectGuide = useEditorStore.getState().selectGuide;
        selectGuide(guideId);
        setContextMenuState({
          context: { type: "guide", guideId },
          clientX: e.clientX,
          clientY: e.clientY,
        });
        return;
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const layouts = getPageLayouts();
      const pageNumber = findPageAtPoint(screenX, screenY, layouts);

      if (!pageNumber) return;

      const layout = layouts.get(pageNumber)!;
      const pdf = screenToPdf(
        { x: screenX, y: screenY },
        { zoom, pageX: layout.xOffset, pageY: layout.yOffset },
      );

      setContextMenuState({
        context: {
          type: "canvas",
          pdfX: pdf.x,
          pdfY: pdf.y,
          pageNumber,
        },
        clientX: e.clientX,
        clientY: e.clientY,
      });
    },
    [zoom, getPageLayouts, findPageAtPoint, selectElements],
  );

  if (!pdfBytes) return null;

  const layouts = useMemo(() => getPageLayouts(), [getPageLayouts]);

  const isInputEl = (el: FormElement) => el.type === "text" && !el.multiline;

  const snapTargetIds = new Set<string>(
    activeGuides
      .filter((g) => g.type === "element" && g.elementId)
      .map((g) => g.elementId!),
  );

  const elementOverlays = elements.map((el) => {
    if (!visiblePages.has(el.pageNumber)) return null;
    const layout = layouts.get(el.pageNumber);
    if (!layout) return null;

    const isSelected = selectedIds.has(el.id);
    const screen = pdfToScreen(
      { x: el.x, y: el.y },
      { zoom, pageX: layout.xOffset, pageY: layout.yOffset },
    );
    if (isSelected && dragOffset && draggingId.current !== el.id) {
      screen.x += dragOffset.dx;
      screen.y += dragOffset.dy;
    }
    const screenWidth = el.width * zoom;
    const screenHeight = el.height * zoom;

    const isSingleInput = isInputEl(el);
    const isSmallElement = screenWidth < 40 || screenHeight < 40;
    const styleConfig = getElementStyleConfig(el);

    const smallHandleOverride = isSmallElement
      ? {
          topLeft: { width: "8px", height: "8px", left: "-4px", top: "-4px" },
          topRight: {
            width: "8px",
            height: "8px",
            right: "-4px",
            top: "-4px",
          },
          bottomLeft: {
            width: "8px",
            height: "8px",
            left: "-4px",
            bottom: "-4px",
          },
          bottomRight: {
            width: "8px",
            height: "8px",
            right: "-4px",
            bottom: "-4px",
          },
          top: {
            width: "100%",
            height: "4px",
            top: "-2px",
            left: "0px",
            cursor: "row-resize",
          },
          bottom: {
            width: "100%",
            height: "4px",
            bottom: "-2px",
            left: "0px",
            cursor: "row-resize",
          },
          left: {
            width: "4px",
            height: "100%",
            left: "-2px",
            top: "0px",
            cursor: "col-resize",
          },
          right: {
            width: "4px",
            height: "100%",
            right: "-2px",
            top: "0px",
            cursor: "col-resize",
          },
        }
      : undefined;

    return (
      <Rnd
        key={el.id}
        data-element-overlay
        data-element-id={el.id}
        scale={1}
        size={{ width: screenWidth, height: screenHeight }}
        position={{ x: screen.x, y: screen.y }}
        minWidth={MIN_SIZE}
        minHeight={MIN_SIZE}
        enableResizing={
          isSingleInput
            ? {
                left: true,
                right: true,
                topLeft: false,
                topRight: false,
                bottomLeft: false,
                bottomRight: false,
                top: false,
                bottom: false,
              }
            : undefined
        }
        resizeHandleStyles={smallHandleOverride}
        onDragStart={(e) => {
          const mouseEvent = e as React.MouseEvent;
          const shiftOrCtrl =
            mouseEvent.shiftKey ||
            mouseEvent.ctrlKey ||
            mouseEvent.metaKey;
          if (!isSelected) {
            if (shiftOrCtrl) {
              const store = useEditorStore.getState();
              const next = new Set(store.selectedIds);
              next.add(el.id);
              selectElements(next);
            } else {
              selectElements(new Set([el.id]));
            }
          } else if (shiftOrCtrl) {
            pendingToggleId.current = el.id;
          }
          lockCursor("grab");
          const positions = new Map<string, { x: number; y: number }>();
          for (const e of elements) {
            positions.set(e.id, { x: e.x, y: e.y });
          }
          dragStartPositions.current = positions;
          draggingId.current = el.id;
          setDragOffset(null);
          setDragSnapCorrection(null);
          setActiveGuides([]);
          setResizeSnapCorrection(null);
          lastResizeSnap.current = null;
          resizingId.current = null;
          prevSnapRef.current = null;
        }}
        onDrag={(dragEvent, d) => {
          if (pendingToggleId.current) pendingToggleId.current = null;
          const me = dragEvent as unknown as MouseEvent;
          const deltaX = d.x - screen.x;
          const deltaY = d.y - screen.y;
          const rawDx = deltaX / zoom;
          const rawDy = deltaY / zoom;

          const currentStore = useEditorStore.getState();
          const currentSelectedIds = currentStore.selectedIds;
          const isMultiDrag =
            currentSelectedIds.size > 1 && currentSelectedIds.has(el.id);

          const livePositions = new Map<
            string,
            { x: number; y: number; width: number; height: number }
          >();
          let correctionDx = 0;
          let correctionDy = 0;
          let guides: SnapGuide[] = [];

          const snapCtx = buildSnapContext(
            isMultiDrag ? currentSelectedIds : new Set([el.id]),
            el.pageNumber,
            {
              shiftKey: me.shiftKey,
              ctrlKey: me.ctrlKey || me.metaKey,
            },
          );
          const hasSnap = hasAnySnap(snapCtx);

          if (hasSnap) {
            const snapOpts = prevSnapRef.current
              ? {
                  previousSnappedX: prevSnapRef.current.x,
                  previousSnappedY: prevSnapRef.current.y,
                }
              : undefined;

            if (isMultiDrag) {
              const selectedOnPage = elements.filter(
                (e) =>
                  currentSelectedIds.has(e.id) &&
                  e.pageNumber === el.pageNumber,
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
            hasSnap
              ? { dx: correctionDx * zoom, dy: correctionDy * zoom }
              : null,
          );
          setActiveGuides(guides);

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
          setDragLivePositions(livePositions);
        }}
        onDragStop={(dragStopEvent, d) => {
          const resetDragState = () => {
            dragStartPositions.current = new Map();
            draggingId.current = null;
            setDragOffset(null);
            setDragSnapCorrection(null);
            setActiveGuides([]);
            setDragLivePositions(null);
            prevSnapRef.current = null;
            unlockCursor();
          };

          if (pendingToggleId.current === el.id) {
            toggleInSelection(el.id);
            pendingToggleId.current = null;
            resetDragState();
            return;
          }

          const me = dragStopEvent as unknown as MouseEvent;
          const pl = layouts.get(el.pageNumber);
          if (!pl) return;

          const currentStore = useEditorStore.getState();
          const currentSelectedIds = currentStore.selectedIds;

          if (
            currentSelectedIds.size > 1 &&
            currentSelectedIds.has(el.id)
          ) {
            const rawDx = (d.x - screen.x) / zoom;
            const rawDy = (d.y - screen.y) / zoom;

            const selectedOnPage = elements.filter(
              (e) =>
                currentSelectedIds.has(e.id) &&
                e.pageNumber === el.pageNumber,
            );

            let correctionDx = 0;
            let correctionDy = 0;

            const snapCtx = buildSnapContext(
              currentSelectedIds,
              el.pageNumber,
              {
                shiftKey: me.shiftKey,
                ctrlKey: me.ctrlKey || me.metaKey,
              },
            );
            const hasSnap = hasAnySnap(snapCtx);

            if (hasSnap) {
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
              const startPos =
                dragStartPositions.current?.get(otherEl.id);
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
                  const targetPageInfo = pages.find(
                    (p) => p.pageNumber === tp,
                  )!;
                  const sPt = pdfToScreen(
                    {
                      x: newX + otherEl.width / 2,
                      y: newY + otherEl.height / 2,
                    },
                    {
                      zoom,
                      pageX: oldLayout.xOffset,
                      pageY: oldLayout.yOffset,
                    },
                  );
                  const newPdf = screenToPdf(sPt, {
                    zoom,
                    pageX: newLayout.xOffset,
                    pageY: newLayout.yOffset,
                  });
                  const clampedX = Math.max(
                    0,
                    Math.min(
                      newPdf.x - otherEl.width / 2,
                      targetPageInfo.width - otherEl.width,
                    ),
                  );
                  const clampedY = Math.max(
                    0,
                    Math.min(
                      newPdf.y - otherEl.height / 2,
                      targetPageInfo.height - otherEl.height,
                    ),
                  );
                  updates.push({
                    id: otherEl.id,
                    x: clampedX,
                    y: clampedY,
                    pageNumber: tp,
                  });
                } else {
                  updates.push({
                    id: otherEl.id,
                    x: newX,
                    y: newY,
                  });
                }
              }
            }
            moveElements(updates);
          } else {
            const snapCtx = buildSnapContext(
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
            if (hasAnySnap(snapCtx)) {
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
                {
                  x: finalX + el.width / 2,
                  y: finalY + el.height / 2,
                },
                {
                  zoom,
                  pageX: oldLayout.xOffset,
                  pageY: oldLayout.yOffset,
                },
              );
              const newPdf = screenToPdf(screenPt, {
                zoom,
                pageX: newLayout.xOffset,
                pageY: newLayout.yOffset,
              });
              const newX = Math.max(
                0,
                Math.min(
                  newPdf.x - el.width / 2,
                  targetPageInfo.width - el.width,
                ),
              );
              const newY = Math.max(
                0,
                Math.min(
                  newPdf.y - el.height / 2,
                  targetPageInfo.height - el.height,
                ),
              );
              updateElement(el.id, {
                x: newX,
                y: newY,
                pageNumber: targetPage,
              });
            } else {
              updateElement(el.id, { x: finalX, y: finalY });
            }
          }
          resetDragState();
        }}
        onResize={(resizeEvent, dir, ref, _delta, position) => {
          resizeHappenedRef.current = true;
          const me = resizeEvent as unknown as MouseEvent;
          lockCursor(isSingleInput ? "ew" : "nwse");
          resizingId.current = el.id;
          const pl = layouts.get(el.pageNumber);
          if (!pl) return;
          const rawWidth = parseFloat(ref.style.width) / zoom;
          const rawHeight = parseFloat(ref.style.height) / zoom;
          const rawPdf = screenToPdf(
            { x: position.x, y: position.y },
            { zoom, pageX: pl.xOffset, pageY: pl.yOffset },
          );

          const snapCtx = buildSnapContext(
            new Set([el.id]),
            el.pageNumber,
            {
              shiftKey: me.shiftKey,
              ctrlKey: me.ctrlKey || me.metaKey,
            },
          );
          const hasSnap = hasAnySnap(snapCtx);

          if (hasSnap) {
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
            setActiveGuides(result.guides);

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
            setDragLivePositions(livePositions);
          } else {
            lastResizeSnap.current = null;
            setResizeSnapCorrection(null);
            setActiveGuides([]);
          }
        }}
        onResizeStop={() => {
          if (!resizeHappenedRef.current) {
            resizeHappenedRef.current = false;
            if (!isSelected) {
              selectElements(new Set([el.id]));
            }
            resizingId.current = null;
            unlockCursor();
            return;
          }
          resizeHappenedRef.current = false;
          const snap = lastResizeSnap.current;
          if (snap) {
            updateElement(el.id, {
              x: snap.x,
              y: snap.y,
              width: snap.width,
              height: snap.height,
            });
          }
          lastResizeSnap.current = null;
          setResizeSnapCorrection(null);
          setActiveGuides([]);
          setDragLivePositions(null);
          resizingId.current = null;
          prevSnapRef.current = null;
          unlockCursor();
        }}
      >
        <div
          role="button"
          aria-label={`${getElementName(el)} (${el.type})`}
          aria-pressed={isSelected}
          tabIndex={-1}
          className={`h-full w-full flex items-center justify-center outline-none ring-0 ${styleConfig.borderBgClass(isSelected)} ${
            snapTargetIds.has(el.id) ? "border-2" : ""
          }`}
          style={{
            ...(snapTargetIds.has(el.id)
              ? { borderColor: "var(--guide-snap)" }
              : {}),
            ...(resizingId.current === el.id && resizeSnapCorrection
              ? {
                  transform: `translate(${resizeSnapCorrection.dx}px, ${resizeSnapCorrection.dy}px)`,
                  width: `calc(100% + ${resizeSnapCorrection.dw}px)`,
                  height: `calc(100% + ${resizeSnapCorrection.dh}px)`,
                }
              : draggingId.current === el.id && dragSnapCorrection
                ? {
                    transform: `translate(${dragSnapCorrection.dx}px, ${dragSnapCorrection.dy}px)`,
                  }
                : {}),
          }}
        >
          {el.type === "checkbox" && (
            <svg
              viewBox="0 0 10 10"
              className={`h-3/5 w-3/5 ${styleConfig.colorClass}`}
            >
              <path
                d="M2 5L4 7L8 3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {el.type === "radio" && (
            <svg
              viewBox="0 0 10 10"
              className={`h-3/5 w-3/5 ${styleConfig.colorClass}`}
            >
              <circle
                cx="5"
                cy="5"
                r="3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
              <circle cx="5" cy="5" r="1.5" fill="currentColor" />
            </svg>
          )}
          {el.type === "text" && el.multiline && (
            <svg
              viewBox="0 0 12 12"
              className={`h-3/5 w-3/5 ${styleConfig.colorClass} opacity-50`}
            >
              <line
                x1="2"
                y1="3"
                x2="10"
                y2="3"
                stroke="currentColor"
                strokeWidth="1"
              />
              <line
                x1="2"
                y1="6"
                x2="10"
                y2="6"
                stroke="currentColor"
                strokeWidth="1"
              />
              <line
                x1="2"
                y1="9"
                x2="7"
                y2="9"
                stroke="currentColor"
                strokeWidth="1"
              />
            </svg>
          )}
          <span
            className={`absolute -top-4 left-0 max-w-[80px] truncate overflow-hidden text-[10px] select-none ${styleConfig.textColorClass}`}
          >
            {getElementName(el)}
          </span>
        </div>
      </Rnd>
    );
  });

  const totalContentHeight = getTotalContentHeight(pages, zoom);

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 select-none"
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onContextMenu={handleOverlayContextMenu}
      style={{ cursor: activeTool !== "select" ? "crosshair" : "default" }}
    >
      {elementOverlays}
      <BoundingRectOverlay
        selectedIds={selectedIds}
        elements={elements}
        layouts={layouts}
        zoom={zoom}
        dragOffset={dragOffset}
        dragLivePositions={dragLivePositions}
      />
      <GuidesLayer
        guides={guides}
        selectedGuideId={selectedGuideId}
        previewGuide={previewGuide}
        pages={pages}
        layouts={layouts}
        zoom={zoom}
        gridSize={gridSize}
        overlayWidth={overlayWidth}
        overlayRef={overlayRef}
        totalContentHeight={totalContentHeight}
      />
      <SnapGuidesLayer
        activeGuides={activeGuides}
        pages={pages}
        layouts={layouts}
        zoom={zoom}
        overlayWidth={overlayWidth}
        totalContentHeight={totalContentHeight}
      />
      <MarqueeOverlay marqueeRect={marqueeRect} />
      <DrawPreview
        drawRect={drawRect}
        drawStartRef={drawStartRef}
        activeTool={activeTool}
        zoom={zoom}
        HORIZONTAL_DRAW_TOOLS={HORIZONTAL_DRAW_TOOLS}
      />
      {contextMenuState && (
        <CanvasContextMenu
          context={contextMenuState.context}
          clientX={contextMenuState.clientX}
          clientY={contextMenuState.clientY}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
