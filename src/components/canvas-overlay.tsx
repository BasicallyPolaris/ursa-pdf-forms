import {
  CanvasContextMenu,
  type MenuContext,
} from "@/components/canvas-context-menu";
import { BoundingBoxOverlay } from "@/components/canvas-overlay/bounding-box-overlay";
import { DrawPreviewLayer } from "@/components/canvas-overlay/draw-preview-layer";
import { GuideLinesLayer } from "@/components/canvas-overlay/guide-lines-layer";
import { MarqueeOverlay } from "@/components/canvas-overlay/marquee-overlay";
import { PreviewGuideLayer } from "@/components/canvas-overlay/preview-guide-layer";
import {
  CLICK_TOOLS,
  HORIZONTAL_DRAW_TOOLS,
  RECT_DRAW_TOOLS,
} from "@/components/canvas-overlay/shared-constants";
import { SnapGuidesLayer } from "@/components/canvas-overlay/snap-guides-layer";
import { useVisiblePages } from "@/contexts/visible-pages";
import { useDrawingTool } from "@/hooks/use-drawing-tool";
import { useElementDrag } from "@/hooks/use-element-drag";
import { useElementResize } from "@/hooks/use-element-resize";
import { useMarqueeSelection } from "@/hooks/use-marquee-selection";
import { pdfToScreen, screenToPdf } from "@/lib/coordinates";
import { fontFamilyToCss, fontWeightToCss, fontStyleToCss } from "@/lib/font-utils";
import { getElementStyleConfig } from "@/lib/element-style-map";
import {
  createCheckbox,
  createRadioButton,
  createButtonField,
  type FormElement,
  getElementName,
} from "@/lib/form-element-model";
import { computeBoundingRect } from "@/lib/geometry";
import {
  computePageLayouts,
  findPageAtScreenPoint,
  getTotalContentHeight,
} from "@/lib/page-layout";
import type { SnapContext } from "@/lib/snap-engine";
import { useEditorStore } from "@/stores/editor-store";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Rnd } from "react-rnd";

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
        snapToPageEdges: !freeMovement,
        snapToElements: !freeMovement,
        snapToGuides: !freeMovement,
        hasAnySnap: !freeMovement,
      };
    },
    [elementsByPage, pages, gridSize, rulerGuideSnapData],
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
        drawing.updateDraw(currentX, currentY, modifiers);
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
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const currentLayouts = getPageLayouts();
        if (currentLayouts.size === 0) return;
        const scrollEl = document.querySelector<HTMLElement>(
          "[data-pdf-scroll-container]",
        );
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

  // --- Render ---

  if (!pdfBytes) return null;

  const totalContentHeight = getTotalContentHeight(pages, zoom);
  const isInputEl = (el: FormElement) =>
    (el.type === "text" && !el.multiline) ||
    el.type === "dropdown" ||
    el.type === "optionlist";

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
    if (isSelected && drag.dragOffset && drag.draggingId.current !== el.id) {
      screen.x += drag.dragOffset.dx;
      screen.y += drag.dragOffset.dy;
    }
    const screenWidth = el.width * zoom;
    const screenHeight = el.height * zoom;

    const isSingleInput = isInputEl(el);
    const isSmallElement = screenWidth < 40 || screenHeight < 40;

    const smallHandleOverride = isSmallElement
      ? {
          topLeft: { width: "8px", height: "8px", left: "-4px", top: "-4px" },
          topRight: { width: "8px", height: "8px", right: "-4px", top: "-4px" },
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
        minWidth={10}
        minHeight={10}
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
          drag.handleDragStart(el, e as React.MouseEvent);
          resize.resetState();
        }}
        onDrag={(dragEvent, d) => {
          drag.handleDrag(el, screen, d, dragEvent as unknown as MouseEvent);
        }}
        onDragStop={(dragStopEvent, d) => {
          drag.handleDragStop(
            el,
            screen,
            d,
            dragStopEvent as unknown as MouseEvent,
          );
        }}
        onResize={(resizeEvent, dir, ref, _delta, position) => {
          resize.handleResize(
            el,
            dir,
            ref,
            position,
            resizeEvent as unknown as MouseEvent,
          );
        }}
        onResizeStop={() => {
          resize.handleResizeStop(el);
        }}
      >
        <div
          role="button"
          aria-label={`${getElementName(el)} (${el.type})`}
          aria-pressed={isSelected}
          tabIndex={-1}
          className={`h-full w-full flex items-center justify-center outline-none ring-0 ${getElementStyleConfig(el).borderBgClass(isSelected)} ${
            snapTargetIds.has(el.id) ? "border-2" : ""
          }`}
          style={{
            ...(snapTargetIds.has(el.id)
              ? { borderColor: "var(--guide-snap)" }
              : {}),
            ...(resize.resizingId.current === el.id &&
            resize.resizeSnapCorrection
              ? {
                  transform: `translate(${resize.resizeSnapCorrection.dx}px, ${resize.resizeSnapCorrection.dy}px)`,
                  width: `calc(100% + ${resize.resizeSnapCorrection.dw}px)`,
                  height: `calc(100% + ${resize.resizeSnapCorrection.dh}px)`,
                }
              : drag.draggingId.current === el.id && drag.dragSnapCorrection
                ? {
                    transform: `translate(${drag.dragSnapCorrection.dx}px, ${drag.dragSnapCorrection.dy}px)`,
                  }
                : {}),
          }}
        >
          {el.type === "checkbox" && (
            <svg
              viewBox="0 0 10 10"
              className={`h-3/5 w-3/5 ${getElementStyleConfig(el).colorClass}`}
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
              className={`h-3/5 w-3/5 ${getElementStyleConfig(el).colorClass}`}
            >
              {el.fillStyle === "circle" && (
                <>
                  <circle
                    cx="5"
                    cy="5"
                    r="3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                  <circle cx="5" cy="5" r="1.5" fill="currentColor" />
                </>
              )}
              {el.fillStyle === "checkmark" && (
                <>
                  <circle
                    cx="5"
                    cy="5"
                    r="3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                  <path
                    d="M2.5 5 L4.5 7 L7.5 3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}
              {el.fillStyle === "cross" && (
                <>
                  <circle
                    cx="5"
                    cy="5"
                    r="3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                  <path
                    d="M3 3 L7 7 M7 3 L3 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </>
              )}
              {el.fillStyle === "star" && (
                <>
                  <circle
                    cx="5"
                    cy="5"
                    r="3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                  <path
                    d="M5 2 L5.8 4.2 L8 4.3 L6.3 5.7 L6.8 8 L5 6.8 L3.2 8 L3.7 5.7 L2 4.3 L4.2 4.2 Z"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth="0.3"
                    strokeLinejoin="round"
                  />
                </>
              )}
              {el.fillStyle === "diamond" && (
                <>
                  <circle
                    cx="5"
                    cy="5"
                    r="3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                  <path
                    d="M5 2 L7.5 5 L5 8 L2.5 5 Z"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth="0.5"
                    strokeLinejoin="round"
                  />
                </>
              )}
            </svg>
          )}
          {el.type === "text" && el.multiline && !el.defaultValue && (
            <svg
              viewBox="0 0 12 12"
              className={`h-3/5 w-3/5 ${getElementStyleConfig(el).colorClass} opacity-50`}
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
          {el.type === "text" && !el.multiline && !el.defaultValue && (
            <svg
              viewBox="0 0 12 4"
              className={`h-1/4 w-3/5 ${getElementStyleConfig(el).colorClass} opacity-40`}
            >
              <line
                x1="1"
                y1="2"
                x2="11"
                y2="2"
                stroke="currentColor"
                strokeWidth="0.8"
              />
            </svg>
          )}
          {el.type === "text" && el.defaultValue && (
            <span
              className="pointer-events-none truncate px-0.5"
              style={{
                fontSize: `${Math.max(8, el.fontSize * zoom * 0.6)}px`,
                color: el.textColor ?? "currentColor",
                fontFamily: fontFamilyToCss(el.fontFamily),
                fontWeight: fontWeightToCss(el.fontWeight),
                fontStyle: fontStyleToCss(el.fontWeight),
                opacity: 0.5,
                lineHeight: el.multiline ? "1.2" : undefined,
              }}
            >
              {el.defaultValue}
            </span>
          )}
          {el.type === "dropdown" && (
            <svg
              viewBox="0 0 12 12"
              className={`h-3/5 w-3/5 ${getElementStyleConfig(el).colorClass}`}
            >
              <rect x="1" y="1" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />
              <path d="M4 5L6 7L8 5" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {el.type === "button" && (
            <svg
              viewBox="0 0 12 8"
              className={`h-3/5 w-3/5 ${getElementStyleConfig(el).colorClass}`}
            >
              <rect x="1" y="1" width="10" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
          {el.type === "optionlist" && (
            <svg
              viewBox="0 0 12 12"
              className={`h-3/5 w-3/5 ${getElementStyleConfig(el).colorClass}`}
            >
              <rect x="1" y="1" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />
              <line x1="3" y1="4" x2="9" y2="4" stroke="currentColor" strokeWidth="1" />
              <line x1="3" y1="6" x2="9" y2="6" stroke="currentColor" strokeWidth="1" />
              <line x1="3" y1="8" x2="9" y2="8" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
          <span
            className={`absolute -top-4 left-0 max-w-20 truncate overflow-hidden text-[10px] select-none ${getElementStyleConfig(el).textColorClass}`}
          >
            {getElementName(el)}
          </span>
        </div>
      </Rnd>
    );
  });

  // Bounding box computation
  const boundingBoxes = (() => {
    if (selectedIds.size < 2) return [];
    const byPage = new Map<
      number,
      Array<{ x: number; y: number; width: number; height: number }>
    >();
    for (const el of elements) {
      if (!selectedIds.has(el.id)) continue;
      if (!byPage.has(el.pageNumber)) byPage.set(el.pageNumber, []);
      const live = dragLivePositions?.get(el.id);
      byPage.get(el.pageNumber)!.push({
        x: live?.x ?? el.x,
        y: live?.y ?? el.y,
        width: live?.width ?? el.width,
        height: live?.height ?? el.height,
      });
    }
    const rects: Array<{
      screenX: number;
      screenY: number;
      screenWidth: number;
      screenHeight: number;
    }> = [];
    for (const [page, items] of byPage) {
      if (items.length < 2) continue;
      const rect = computeBoundingRect(items);
      if (!rect) continue;
      const layout = layouts.get(page);
      if (!layout) continue;
      const topLeft = pdfToScreen(
        { x: rect.x, y: rect.y },
        { zoom, pageX: layout.xOffset, pageY: layout.yOffset },
      );
      const bottomRight = pdfToScreen(
        { x: rect.x + rect.width, y: rect.y + rect.height },
        { zoom, pageX: layout.xOffset, pageY: layout.yOffset },
      );
      rects.push({
        screenX: topLeft.x,
        screenY: topLeft.y,
        screenWidth: bottomRight.x - topLeft.x,
        screenHeight: bottomRight.y - topLeft.y,
      });
    }
    return rects;
  })();

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
      <BoundingBoxOverlay
        boundingBoxes={boundingBoxes}
        dragOffset={drag.dragOffset}
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
