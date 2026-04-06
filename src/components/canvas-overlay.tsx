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
import { useMultiResize } from "@/hooks/use-multi-resize";
import { useMarqueeSelection } from "@/hooks/use-marquee-selection";
import { pdfToScreen, screenToPdf } from "@/lib/coordinates";
import { fontFamilyToCss, fontWeightToCss, fontStyleToCss } from "@/lib/font-utils";
import { getElementStyleConfig } from "@/lib/element-style-map";
import {
  createCheckbox,
  createRadioButton,
  createButtonField,
  heightFromFontSize,
  heightFromOptions,
  type FormElement,
  getElementName,
} from "@/lib/form-element-model";
import {
  computePageLayouts,
  findPageAtScreenPoint,
  getVisiblePageNumbers,
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
import {
  AlignLeft,
  CircleDot,
  List,
  Square,
  SquareChevronDown,
  SquareMousePointer,
  Type,
} from "lucide-react";
import { Rnd } from "react-rnd";

const FIELD_COLORS: Record<string, string> = {
  text: "oklch(0.623 0.214 259)",
  checkbox: "oklch(0.723 0.219 149)",
  radio: "oklch(0.657 0.229 310)",
  multiline: "oklch(0.769 0.167 70)",
  dropdown: "oklch(0.72 0.18 55)",
  button: "oklch(0.75 0.15 340)",
  optionlist: "oklch(0.7 0.16 180)",
};

function getFieldColor(el: FormElement): string {
  if (el.type === "text" && "multiline" in el && el.multiline) return FIELD_COLORS.multiline;
  return FIELD_COLORS[el.type] ?? FIELD_COLORS.text;
}

function getHandleConfig(
  el: FormElement,
  isSelected: boolean,
  isMultiSelected: boolean,
  isDragging: boolean,
) {
  if (!isSelected || isMultiSelected || isDragging) {
    return { enabled: false as const, styles: undefined };
  }
  const color = getFieldColor(el);
  const isInput =
    (el.type === "text" && !("multiline" in el && el.multiline)) ||
    el.type === "dropdown" ||
    el.type === "optionlist";
  const hs: React.CSSProperties = {
    width: "7px",
    height: "7px",
    background: "oklch(0.98 0 0)",
    border: `1.5px solid ${color}`,
    borderRadius: "1px",
  };
  if (isInput) {
    return {
      enabled: { left: true, right: true } as Record<string, boolean>,
      styles: {
        left: { ...hs, top: "calc(50% - 3.5px)", left: "-4px", cursor: "col-resize" },
        right: { ...hs, top: "calc(50% - 3.5px)", right: "-4px", cursor: "col-resize" },
      },
    };
  }
  return {
    enabled: {
      topLeft: true, top: true, topRight: true,
      right: true, bottomRight: true, bottom: true,
      bottomLeft: true, left: true,
    },
    styles: {
      topLeft: { ...hs, top: "-4px", left: "-4px" },
      top: { ...hs, top: "-4px", left: "calc(50% - 3.5px)", cursor: "row-resize" },
      topRight: { ...hs, top: "-4px", right: "-4px" },
      right: { ...hs, top: "calc(50% - 3.5px)", right: "-4px", cursor: "col-resize" },
      bottomRight: { ...hs, bottom: "-4px", right: "-4px" },
      bottom: { ...hs, bottom: "-4px", left: "calc(50% - 3.5px)", cursor: "row-resize" },
      bottomLeft: { ...hs, bottom: "-4px", left: "-4px" },
      left: { ...hs, top: "calc(50% - 3.5px)", left: "-4px", cursor: "col-resize" },
    },
  };
}

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
      const currentLayout = layouts.get(pageNumber);

      const crossPageElements: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
        id?: string;
      }> = [];

      const scrollEl = document.querySelector<HTMLElement>(
        "[data-pdf-scroll-container]",
      );
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
    const livePos = isSelected ? dragLivePositions?.get(el.id) : null;
    const isMultiResize =
      multiResize.isActive.current &&
      livePos &&
      (Math.abs(livePos.width - el.width) > 0.01 ||
        Math.abs(livePos.height - el.height) > 0.01);

    const screen = pdfToScreen(
      { x: isMultiResize ? livePos.x : el.x, y: isMultiResize ? livePos.y : el.y },
      { zoom, pageX: layout.xOffset, pageY: layout.yOffset },
    );
    if (!isMultiResize && isSelected && drag.dragOffset && drag.draggingId.current !== el.id) {
      screen.x += drag.dragOffset.dx;
      screen.y += drag.dragOffset.dy;
    }
    const screenWidth = (isMultiResize ? livePos.width : el.width) * zoom;
    const screenHeight = (isMultiResize ? livePos.height : el.height) * zoom;

    const isMultiSelected = selectedIds.size >= 2 && isSelected;
    const handleConfig = getHandleConfig(el, isSelected, isMultiSelected, drag.draggingId.current === el.id);

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
        enableResizing={handleConfig.enabled}
        resizeHandleStyles={handleConfig.styles}
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
          className={`h-full w-full flex items-center justify-center outline-none ring-0 ${
            isSelected
              ? getElementStyleConfig(el).borderBgClass(true)
              : `border border-dashed ${getElementStyleConfig(el).dimBorderClass} ${getElementStyleConfig(el).borderBgClass(false).split(' ').find(c => c.startsWith('bg-')) ?? ''}`
          } ${
            snapTargetIds.has(el.id) ? "border-2" : ""
          }`}
          style={{
            ...(snapTargetIds.has(el.id)
              ? { borderColor: "var(--guide-snap)" }
              : !isSelected
                ? { borderColor: getFieldColor(el), opacity: 0.5 }
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
            <Square className={`h-3/5 w-3/5 ${getElementStyleConfig(el).colorClass}`} strokeWidth={2} />
          )}
          {el.type === "radio" && (
            <CircleDot className={`h-3/5 w-3/5 ${getElementStyleConfig(el).colorClass}`} strokeWidth={2} />
          )}
          {el.type === "text" && el.multiline && !el.defaultValue && (
            <AlignLeft className={`h-3/5 w-3/5 ${getElementStyleConfig(el).colorClass} opacity-50`} strokeWidth={2} />
          )}
          {el.type === "text" && !el.multiline && !el.defaultValue && (
            <Type className={`h-3/5 w-3/5 ${getElementStyleConfig(el).colorClass} opacity-50`} strokeWidth={2} />
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
            <SquareChevronDown className={`h-3/5 w-3/5 ${getElementStyleConfig(el).colorClass}`} strokeWidth={2} />
          )}
          {el.type === "button" && !el.label && (
            <SquareMousePointer className={`h-3/5 w-3/5 ${getElementStyleConfig(el).colorClass}`} strokeWidth={2} />
          )}
          {el.type === "button" && el.label && (
            <span
              className="pointer-events-none truncate px-0.5"
              style={{
                fontSize: `${Math.max(8, el.fontSize * zoom * 0.6)}px`,
                color: el.textColor ?? "currentColor",
                fontFamily: fontFamilyToCss(el.fontFamily),
                fontWeight: fontWeightToCss(el.fontWeight),
                fontStyle: fontStyleToCss(el.fontWeight),
                opacity: 0.7,
              }}
            >
              {el.label}
            </span>
          )}
          {el.type === "optionlist" && (
            <List className={`h-3/5 w-3/5 ${getElementStyleConfig(el).colorClass}`} strokeWidth={2} />
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

  const boundingBox = (() => {
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
        boundingBox={boundingBox}
        isDragging={!!drag.dragOffset}
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
