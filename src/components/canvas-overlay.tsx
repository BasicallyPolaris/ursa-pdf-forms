import {
  CanvasContextMenu,
  type MenuContext,
} from "@/components/canvas-context-menu";
import { BoundingBoxOverlay } from "@/components/canvas-overlay/bounding-box-overlay";
import { DrawPreviewLayer } from "@/components/canvas-overlay/draw-preview-layer";
import { ElementOverlay } from "@/components/canvas-overlay/element-overlay";
import { GuideLinesLayer } from "@/components/canvas-overlay/guide-lines-layer";
import { MarqueeOverlay } from "@/components/canvas-overlay/marquee-overlay";
import { PreviewGuideLayer } from "@/components/canvas-overlay/preview-guide-layer";
import {
  CLICK_TOOLS,
  HORIZONTAL_DRAW_TOOLS,
  RECT_DRAW_TOOLS,
} from "@/components/canvas-overlay/shared-constants";
import { SnapGuidesLayer } from "@/components/canvas-overlay/snap-guides-layer";
import { useScrollContainerRef } from "@/contexts/scroll-container-context";
import { useVisiblePages } from "@/contexts/visible-pages";
import { useDrawingTool } from "@/hooks/use-drawing-tool";
import { useElementDrag } from "@/hooks/use-element-drag";
import { useElementResize } from "@/hooks/use-element-resize";
import { useMultiResize } from "@/hooks/use-multi-resize";
import { useMarqueeSelection } from "@/hooks/use-marquee-selection";
import { pdfToScreen, screenToPdf } from "@/lib/coordinates";
import {
  createCheckbox,
  createRadioButton,
  createButtonField,
  heightFromFontSize,
  heightFromOptions,
  type FormElement,
} from "@/lib/form-element-model";
import {
  computePageLayouts,
  findPageAtScreenPoint,
  getVisiblePageNumbers,
  getTotalContentHeight,
  type PageLayout,
} from "@/lib/page-layout";
import type { SnapContext } from "@/lib/snap-engine";
import { useEditorStore } from "@/stores/editor-store";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useTranslation } from "react-i18next";

interface ElementOverlayListProps {
  elements: FormElement[];
  visiblePages: Set<number>;
  layouts: Map<number, PageLayout>;
  selectedIds: Set<string>;
  dragLivePositions: Map<string, { x: number; y: number; width: number; height: number }> | null;
  snapTargetIds: Set<string>;
  zoom: number;
  dragOffset: { dx: number; dy: number } | null;
  dragDraggingIdRef: RefObject<string | null>;
  dragSnapCorrection: { dx: number; dy: number } | null;
  resizeResizingIdRef: RefObject<string | null>;
  resizeSnapCorrection: { dx: number; dy: number; dw: number; dh: number } | null;
  multiResizeActiveRef: RefObject<boolean>;
  onDragStart: (el: FormElement, e: React.MouseEvent) => void;
  onDrag: (el: FormElement, screen: { x: number; y: number }, d: { x: number; y: number }, me: MouseEvent) => void;
  onDragStop: (el: FormElement, screen: { x: number; y: number }, d: { x: number; y: number }, me: MouseEvent) => void;
  onResize: (el: FormElement, dir: string, ref: HTMLElement, position: { x: number; y: number }, me: MouseEvent) => void;
  onResizeStop: (el: FormElement) => void;
  onResetResize: () => void;
}

const ElementOverlayList = memo(function ElementOverlayList({
  elements,
  visiblePages,
  layouts,
  selectedIds,
  dragLivePositions,
  snapTargetIds,
  zoom,
  dragOffset,
  dragDraggingIdRef,
  dragSnapCorrection,
  resizeResizingIdRef,
  resizeSnapCorrection,
  multiResizeActiveRef,
  onDragStart,
  onDrag,
  onDragStop,
  onResize,
  onResizeStop,
  onResetResize,
}: ElementOverlayListProps) {
  return (
    <>
      {elements.map((el) => {
        if (!visiblePages.has(el.pageNumber)) return null;
        const layout = layouts.get(el.pageNumber);
        if (!layout) return null;

        const isSelected = selectedIds.has(el.id);
        const livePos = isSelected ? dragLivePositions?.get(el.id) ?? null : null;
        const isMultiResize =
          multiResizeActiveRef.current &&
          !!livePos &&
          (Math.abs(livePos.width - el.width) > 0.01 ||
            Math.abs(livePos.height - el.height) > 0.01);
        const isDragging = dragDraggingIdRef.current === el.id;
        const isResizing = resizeResizingIdRef.current === el.id;

        return (
          <ElementOverlay
            key={el.id}
            element={el}
            layout={layout}
            zoom={zoom}
            isSelected={isSelected}
            isMultiSelected={selectedIds.size >= 2 && isSelected}
            livePos={livePos}
            isMultiResize={isMultiResize}
            isSnapTarget={snapTargetIds.has(el.id)}
            effectiveDragOffset={
              !isMultiResize && isSelected && !isDragging
                ? dragOffset
                : null
            }
            isDragging={isDragging}
            isResizing={isResizing}
            dragSnapCorrection={isDragging ? dragSnapCorrection : null}
            resizeSnapCorrection={isResizing ? resizeSnapCorrection : null}
            onDragStart={onDragStart}
            onDrag={onDrag}
            onDragStop={onDragStop}
            onResize={onResize}
            onResizeStop={onResizeStop}
            onResetResize={onResetResize}
          />
        );
      })}
    </>
  );
});

export function CanvasOverlay() {
  const { t } = useTranslation();
  const scrollRef = useScrollContainerRef();
  const elements = useEditorStore((s) => s.elements);
  const activeTool = useEditorStore((s) => s.activeTool);
  const zoom = useEditorStore((s) => s.zoom);
  const pages = useEditorStore((s) => s.pages);
  const pdfBytes = useEditorStore((s) => s.pdfBytes);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const gridSize = useEditorStore((s) => s.gridSize);
  const guides = useEditorStore((s) => s.guides);
  const previewGuide = useEditorStore((s) => s.previewGuide);
  const visiblePages = useVisiblePages();

  const addElement = useEditorStore((s) => s.addElement);
  const selectElements = useEditorStore((s) => s.selectElements);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const addToSelection = useEditorStore((s) => s.addToSelection);
  const setDragLivePositions = useEditorStore((s) => s.setDragLivePositions);
  const dragLivePositions = useEditorStore((s) => s.dragLivePositions);
  const selectGuide = useEditorStore((s) => s.selectGuide);
  const updateGuidePosition = useEditorStore((s) => s.updateGuidePosition);
  const setPreviewGuide = useEditorStore((s) => s.setPreviewGuide);
  const removeGuide = useEditorStore((s) => s.removeGuide);
  const selectedGuideId = useEditorStore((s) => s.selectedGuideId);

  const overlayRef = useRef<HTMLDivElement>(null);
  const [overlayWidth, setOverlayWidth] = useState(0);
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0);
  const [activeGuides, setActiveGuides] = useState<
    import("@/lib/snap-engine").SnapGuide[]
  >([]);
  const [contextMenuState, setContextMenuState] = useState<{
    context: MenuContext;
    clientX: number;
    clientY: number;
  } | null>(null);
  const closeContextMenu = useCallback(() => setContextMenuState(null), []);

  useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const update = () => setScrollViewportHeight(scrollEl.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(scrollEl);
    return () => ro.disconnect();
  }, [scrollRef]);

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

  const layouts = useMemo(
    () => computePageLayouts(pages, zoom, overlayWidth),
    [pages, zoom, overlayWidth],
  );

  const getPageLayouts = useCallback(
    () => computePageLayouts(pages, zoom, overlayWidth),
    [pages, zoom, overlayWidth],
  );

  const elementsByPage = useMemo(() => {
    const map = new Map<
      number,
      Array<{ id: string; x: number; y: number; width: number; height: number }>
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
      guides.map((g) => ({ orientation: g.orientation, position: g.position })),
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
      const currentLayout = layouts.get(pageNumber);

      const crossPageElements: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
        id?: string;
      }> = [];

      const scrollEl = scrollRef.current;
      const snapVisible =
        scrollEl && pages.length > 0
          ? getVisiblePageNumbers(
              layouts,
              scrollEl.scrollTop,
              scrollEl.clientHeight,
              0,
            )
          : new Set([pageNumber]);

      for (const visPageNum of snapVisible) {
        const pageEls = elementsByPage.get(visPageNum) ?? [];
        const filtered =
          excludedIds.size > 0
            ? pageEls.filter((el) => !excludedIds.has(el.id))
            : pageEls;

        if (visPageNum === pageNumber || !currentLayout) {
          crossPageElements.push(...filtered);
        } else {
          const otherLayout = layouts.get(visPageNum);
          if (!otherLayout) {
            crossPageElements.push(...filtered);
            continue;
          }
          const dx = (otherLayout.xOffset - currentLayout.xOffset) / zoom;
          const dy = (otherLayout.yOffset - currentLayout.yOffset) / zoom;
          for (const el of filtered) {
            crossPageElements.push({
              id: el.id,
              x: el.x + dx,
              y: el.y + dy,
              width: el.width,
              height: el.height,
            });
          }
        }
      }

      return {
        gridSize,
        snapThreshold: 5,
        pageWidth: page?.width ?? 612,
        pageHeight: page?.height ?? 792,
        otherElements: crossPageElements,
        rulerGuides: rulerGuideSnapData,
        snapToGrid: modifiers.shiftKey && !freeMovement,
        snapToPageEdges: !freeMovement,
        snapToElements: !freeMovement,
        snapToGuides: !freeMovement,
        hasAnySnap: !freeMovement,
      };
    },
    [elementsByPage, pages, gridSize, rulerGuideSnapData, layouts, zoom],
  );

  const resolveTargetPage = useCallback(
    (
      pdfX: number,
      pdfY: number,
      width: number,
      height: number,
      originalPageNumber: number,
      ls: Map<number, import("@/lib/page-layout").PageLayout>,
    ): number => {
      const origLayout = ls.get(originalPageNumber);
      if (!origLayout) return originalPageNumber;
      const centerX = pdfX + width / 2;
      const centerY = pdfY + height / 2;
      const screenPt = pdfToScreen(
        { x: centerX, y: centerY },
        { zoom, pageX: origLayout.xOffset, pageY: origLayout.yOffset },
      );
      const targetPage = findPageAtScreenPoint(screenPt.x, screenPt.y, ls);
      return targetPage ?? originalPageNumber;
    },
    [zoom],
  );

  // --- Hooks ---

  const marquee = useMarqueeSelection({ zoom, getPageLayouts });
  const drawing = useDrawingTool({ zoom, buildSnapContext, setActiveGuides });

  const dragConfig = useMemo(
    () => ({
      zoom,
      layouts,
      pages,
      buildSnapContext,
      resolveTargetPage,
      setActiveGuides,
      setDragLivePositions,
    }),
    [
      zoom,
      layouts,
      pages,
      buildSnapContext,
      resolveTargetPage,
      setDragLivePositions,
    ],
  );
  const drag = useElementDrag(dragConfig);

  const stableDragOffset = useMemo(() => {
    if (drag.dragOffset === null) return null;
    return { dx: drag.dragOffset.dx, dy: drag.dragOffset.dy };
  }, [drag.dragOffset?.dx, drag.dragOffset?.dy]);

  const resizeConfig = useMemo(
    () => ({
      zoom,
      layouts,
      buildSnapContext,
      setActiveGuides,
      setDragLivePositions,
    }),
    [zoom, layouts, buildSnapContext, setDragLivePositions],
  );
  const resize = useElementResize(resizeConfig);

  const multiResizeConfig = useMemo(
    () => ({
      zoom,
      layouts,
      buildSnapContext,
      setActiveGuides,
      setDragLivePositions,
    }),
    [zoom, layouts, buildSnapContext, setActiveGuides, setDragLivePositions],
  );
  const multiResize = useMultiResize(multiResizeConfig);

  // --- Canvas mouse handlers ---

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
      const currentLayouts = getPageLayouts();
      const pageNumber = findPageAtScreenPoint(
        screenX,
        screenY,
        currentLayouts,
      );

      if (activeTool === "select") {
        if (!e.shiftKey) clearSelection();
        marquee.startMarquee(screenX, screenY);
        return;
      }

      if (!pageNumber) return;

      const layout = currentLayouts.get(pageNumber)!;

      if (CLICK_TOOLS.has(activeTool)) {
        const pdf = screenToPdf(
          { x: screenX, y: screenY },
          { zoom, pageX: layout.xOffset, pageY: layout.yOffset },
        );
        let newEl: FormElement;
        if (activeTool === "checkbox") {
          newEl = createCheckbox({
            x: pdf.x,
            y: pdf.y,
            pageNumber,
            name: `checkbox_${elements.length + 1}`,
          });
        } else if (activeTool === "radio") {
          newEl = createRadioButton({
            x: pdf.x,
            y: pdf.y,
            pageNumber,
            groupName: "group_1",
            value: `option_${elements.length + 1}`,
          });
        } else if (activeTool === "button") {
          newEl = createButtonField({
            x: pdf.x,
            y: pdf.y,
            pageNumber,
            name: `button_${elements.length + 1}`,
          });
        } else {
          return;
        }
        addElement(newEl);
        selectElements(new Set([newEl.id]));
        return;
      }

      if (
        HORIZONTAL_DRAW_TOOLS.has(activeTool) ||
        RECT_DRAW_TOOLS.has(activeTool)
      ) {
        const pdf = screenToPdf(
          { x: screenX, y: screenY },
          { zoom, pageX: layout.xOffset, pageY: layout.yOffset },
        );
        drawing.startDraw(
          screenX,
          screenY,
          pageNumber,
          layout.xOffset,
          layout.yOffset,
          pdf.x,
          pdf.y,
          { shiftKey: e.shiftKey, ctrlKey: e.ctrlKey || e.metaKey },
          HORIZONTAL_DRAW_TOOLS.has(activeTool)
            ? activeTool === "optionlist"
              ? heightFromOptions(12, 2)
              : heightFromFontSize(12)
            : undefined,
        );
      }
    },
    [
      activeTool,
      zoom,
      elements.length,
      addElement,
      selectElements,
      clearSelection,
      getPageLayouts,
      marquee,
      drawing,
    ],
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      const modifiers = {
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey || e.metaKey,
      };

      if (drawing.drawStartRef.current) {
        drawing.updateDraw(currentX, currentY, modifiers, HORIZONTAL_DRAW_TOOLS.has(activeTool));
        return;
      }

      marquee.updateMarquee(currentX, currentY);
    },
    [drawing, marquee],
  );

  const handleCanvasMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const drawResult = drawing.finalizeDraw(activeTool);
      if (drawResult) {
        addElement(drawResult.element);
        selectElements(new Set([drawResult.element.id]));
        return;
      }

      const { hitIds, wasDrag } = marquee.endMarquee();
      if (wasDrag && hitIds.length > 0) {
        if (e.shiftKey) {
          addToSelection(hitIds);
        } else {
          selectElements(new Set(hitIds));
        }
      }
    },
    [activeTool, drawing, marquee, addElement, selectElements, addToSelection],
  );

  // --- Keyboard nudging ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        (e.target.closest(
          "input, textarea, select, [role='menu'], [role='menuitem']",
        ) !== null)
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const currentLayouts = getPageLayouts();
        if (currentLayouts.size === 0) return;
        const scrollEl = scrollRef.current;
        if (!scrollEl) return;
        const scrollCenter = scrollEl.scrollTop + scrollEl.clientHeight / 2;
        let closestPage = 1;
        let closestDist = Infinity;
        for (const [pageNum, layout] of currentLayouts) {
          const pageCenter = layout.yOffset + layout.screenHeight / 2;
          const dist = Math.abs(pageCenter - scrollCenter);
          if (dist < closestDist) {
            closestDist = dist;
            closestPage = pageNum;
          }
        }
        const state = useEditorStore.getState();
        const pageIds = state.elements
          .filter((el) => el.pageNumber === closestPage)
          .map((el) => el.id);
        selectElements(new Set(pageIds));
      }

      const store = useEditorStore.getState();
      if (store.selectedIds.size === 0 || !store.pdfBytes) return;

      const nudge = e.shiftKey ? 5 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -nudge;
      else if (e.key === "ArrowRight") dx = nudge;
      else if (e.key === "ArrowUp") dy = -nudge;
      else if (e.key === "ArrowDown") dy = nudge;
      else return;

      e.preventDefault();
      const updates: Array<{ id: string; x: number; y: number }> = [];
      for (const el of store.elements) {
        if (store.selectedIds.has(el.id)) {
          updates.push({ id: el.id, x: el.x + dx, y: el.y + dy });
        }
      }
      if (updates.length > 0) store.moveElements(updates);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [getPageLayouts, selectElements]);

  // --- Context menu ---

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
        const currentLayouts = getPageLayouts();
        const layout = currentLayouts.get(el?.pageNumber ?? 1);
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
      const currentLayouts = getPageLayouts();
      const pageNumber = findPageAtScreenPoint(
        screenX,
        screenY,
        currentLayouts,
      );
      if (!pageNumber) return;
      const layout = currentLayouts.get(pageNumber)!;
      const pdf = screenToPdf(
        { x: screenX, y: screenY },
        { zoom, pageX: layout.xOffset, pageY: layout.yOffset },
      );
      setContextMenuState({
        context: { type: "canvas", pdfX: pdf.x, pdfY: pdf.y, pageNumber },
        clientX: e.clientX,
        clientY: e.clientY,
      });
    },
    [zoom, getPageLayouts, selectElements, selectGuide],
  );

  const totalContentHeight = useMemo(
    () =>
      getTotalContentHeight(pages, zoom, scrollViewportHeight || undefined),
    [pages, zoom, scrollViewportHeight],
  );

  const snapTargetIds = useMemo(
    () =>
      new Set<string>(
        activeGuides
          .filter((g) => g.type === "element" && g.elementId)
          .map((g) => g.elementId!),
      ),
    [activeGuides],
  );

  const boundingBox = useMemo(() => {
    if (selectedIds.size < 2) return null;
    if (multiResize.isActive.current && multiResize.currentBbox.current) {
      return multiResize.currentBbox.current;
    }
    const items: Array<{ x: number; y: number; width: number; height: number }> = [];
    for (const el of elements) {
      if (!selectedIds.has(el.id)) continue;
      const layout = layouts.get(el.pageNumber);
      if (!layout) continue;
      const live = dragLivePositions?.get(el.id);
      const px = live?.x ?? el.x;
      const py = live?.y ?? el.y;
      const pw = live?.width ?? el.width;
      const ph = live?.height ?? el.height;
      const tl = pdfToScreen({ x: px, y: py }, { zoom, pageX: layout.xOffset, pageY: layout.yOffset });
      items.push({ x: tl.x, y: tl.y, width: pw * zoom, height: ph * zoom });
    }
    if (items.length < 2) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of items) {
      if (r.x < minX) minX = r.x;
      if (r.y < minY) minY = r.y;
      if (r.x + r.width > maxX) maxX = r.x + r.width;
      if (r.y + r.height > maxY) maxY = r.y + r.height;
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [selectedIds, elements, layouts, zoom, dragLivePositions, multiResize.snapCorrection]);

  const anyHeightLocked = useMemo(() => {
    if (selectedIds.size < 2) return false;
    const selected = elements.filter((el) => selectedIds.has(el.id));
    return (
      selected.length >= 2 &&
      selected.some(
        (el) =>
          (el.type === "text" && !("multiline" in el && el.multiline)) ||
          el.type === "dropdown" ||
          el.type === "optionlist",
      )
    );
  }, [selectedIds, elements]);

  // --- Render ---

  if (!pdfBytes) return null;

  return (
    <div
      ref={overlayRef}
      role="application"
      aria-label={t("canvas.formCanvas")}
      className="absolute inset-0 select-none"
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onContextMenu={handleOverlayContextMenu}
      style={{ cursor: activeTool !== "select" ? "crosshair" : "default" }}
    >
      <ElementOverlayList
        elements={elements}
        visiblePages={visiblePages}
        layouts={layouts}
        selectedIds={selectedIds}
        dragLivePositions={dragLivePositions}
        snapTargetIds={snapTargetIds}
        zoom={zoom}
        dragOffset={stableDragOffset}
        dragDraggingIdRef={drag.draggingId}
        dragSnapCorrection={drag.dragSnapCorrection}
        resizeResizingIdRef={resize.resizingId}
        resizeSnapCorrection={resize.resizeSnapCorrection}
        multiResizeActiveRef={multiResize.isActive}
        onDragStart={drag.handleDragStart}
        onDrag={drag.handleDrag}
        onDragStop={drag.handleDragStop}
        onResize={resize.handleResize}
        onResizeStop={resize.handleResizeStop}
        onResetResize={resize.resetState}
      />
      <BoundingBoxOverlay
        boundingBox={boundingBox}
        isDragging={!!drag.dragOffset}
        anyHeightLocked={anyHeightLocked}
        snapCorrection={multiResize.snapCorrection}
        onResizeStart={multiResize.handleResizeStart}
        onResize={multiResize.handleResize}
        onResizeStop={multiResize.handleResizeStop}
      />
      <GuideLinesLayer
        guides={guides}
        selectedGuideId={selectedGuideId}
        layouts={layouts}
        pages={pages}
        zoom={zoom}
        gridSize={gridSize}
        overlayWidth={overlayWidth}
        totalContentHeight={totalContentHeight}
        overlayRef={overlayRef}
        activeTool={activeTool}
        selectGuide={selectGuide}
        updateGuidePosition={updateGuidePosition}
        setPreviewGuide={setPreviewGuide}
        removeGuide={removeGuide}
      />
      <PreviewGuideLayer
        previewGuide={previewGuide}
        pages={pages}
        layouts={layouts}
        zoom={zoom}
        overlayWidth={overlayWidth}
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
      <MarqueeOverlay marqueeRect={marquee.marqueeRect} />
      <DrawPreviewLayer
        drawRectStyle={drawing.computeDrawRectStyle(activeTool)}
        activeTool={activeTool}
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
