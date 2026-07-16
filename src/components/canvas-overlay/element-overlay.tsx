import { memo, useCallback } from "react";
import { Rnd } from "react-rnd";
import { pdfToScreen } from "@/lib/coordinates";
import { resolveCssVar } from "@/lib/css-vars";
import { fontFamilyToCss, fontWeightToCss, fontStyleToCss } from "@/lib/font-utils";
import { getElementStyleConfig, getFieldTypeLabel } from "@/lib/element-style-map";
import { getElementName, type FormElement } from "@/lib/form-element-model";
import type { PageLayout } from "@/lib/page-layout";
import {
  AlignLeft,
  CircleDot,
  List,
  Square,
  SquareChevronDown,
  SquareMousePointer,
  Type,
} from "lucide-react";

export { invalidateCssVarCache as invalidateElementColorCache } from "@/lib/css-vars";

function getFieldColor(el: FormElement): string {
  const varMap: Record<string, string> = {
    text: "--field-text",
    checkbox: "--field-checkbox",
    radio: "--field-radio",
    multiline: "--field-multiline",
    dropdown: "--field-dropdown",
    button: "--field-button",
    optionlist: "--field-optionlist",
  };
  const type = el.type === "text" && "multiline" in el && el.multiline ? "multiline" : el.type;
  const varName = varMap[type] ?? varMap.text;
  return resolveCssVar(varName);
}

function applySnapToHandleStyles(
  baseStyles: Record<string, React.CSSProperties>,
  snap: { dx: number; dy: number; dw: number; dh: number },
): Record<string, React.CSSProperties> {
  const { dx, dy, dw, dh } = snap;
  const offsets: Record<string, [number, number]> = {
    topLeft: [dx, dy],
    top: [dx + dw / 2, dy],
    topRight: [dx + dw, dy],
    right: [dx + dw, dy + dh / 2],
    bottomRight: [dx + dw, dy + dh],
    bottom: [dx + dw / 2, dy + dh],
    bottomLeft: [dx, dy + dh],
    left: [dx, dy + dh / 2],
  };
  const result: Record<string, React.CSSProperties> = {};
  for (const [key, style] of Object.entries(baseStyles)) {
    const [tx, ty] = offsets[key] ?? [0, 0];
    result[key] = {
      ...style,
      ...(tx !== 0 || ty !== 0
        ? { transform: `translate(${tx}px, ${ty}px)` }
        : {}),
    };
  }
  return result;
}

function getHandleConfig(
  el: FormElement,
  isSelected: boolean,
  isMultiSelected: boolean,
  isDragging: boolean,
  snapCorrection?: { dx: number; dy: number; dw: number; dh: number } | null,
) {
  if (!isSelected || isMultiSelected || isDragging) {
    return { enabled: false as const, styles: undefined };
  }
  const color = getFieldColor(el);
  const isInput =
    (el.type === "text" && !("multiline" in el && el.multiline)) ||
    el.type === "dropdown" ||
    el.type === "optionlist";
  const handleBg = resolveCssVar("--handle-bg");
  const hs: React.CSSProperties = {
    width: "7px",
    height: "7px",
    background: handleBg,
    border: `1.5px solid ${color}`,
    borderRadius: "1px",
  };
  if (isInput) {
    let styles: Record<string, React.CSSProperties> = {
      left: { ...hs, top: "calc(50% - 3.5px)", left: "-4px", cursor: "col-resize" },
      right: { ...hs, top: "calc(50% - 3.5px)", right: "-4px", cursor: "col-resize" },
    };
    if (snapCorrection) styles = applySnapToHandleStyles(styles, snapCorrection);
    return {
      enabled: { left: true, right: true } as Record<string, boolean>,
      styles,
    };
  }
  let styles: Record<string, React.CSSProperties> = {
    topLeft: { ...hs, top: "-4px", left: "-4px", cursor: "nwse-resize" },
    top: { ...hs, top: "-4px", left: "calc(50% - 3.5px)", cursor: "ns-resize" },
    topRight: { ...hs, top: "-4px", right: "-4px", cursor: "nesw-resize" },
    right: { ...hs, top: "calc(50% - 3.5px)", right: "-4px", cursor: "ew-resize" },
    bottomRight: { ...hs, bottom: "-4px", right: "-4px", cursor: "nwse-resize" },
    bottom: { ...hs, bottom: "-4px", left: "calc(50% - 3.5px)", cursor: "ns-resize" },
    bottomLeft: { ...hs, bottom: "-4px", left: "-4px", cursor: "nesw-resize" },
    left: { ...hs, top: "calc(50% - 3.5px)", left: "-4px", cursor: "ew-resize" },
  };
  if (snapCorrection) styles = applySnapToHandleStyles(styles, snapCorrection);
  return {
    enabled: {
      topLeft: true, top: true, topRight: true,
      right: true, bottomRight: true, bottom: true,
      bottomLeft: true, left: true,
    },
    styles,
  };
}

interface ElementOverlayProps {
  element: FormElement;
  layout: PageLayout;
  zoom: number;
  isSelected: boolean;
  isMultiSelected: boolean;
  livePos: { x: number; y: number; width: number; height: number } | null;
  isMultiResize: boolean;
  isSnapTarget: boolean;
  effectiveDragOffset: { dx: number; dy: number } | null;
  isDragging: boolean;
  isResizing: boolean;
  dragSnapCorrection: { dx: number; dy: number } | null;
  resizeSnapCorrection: { dx: number; dy: number; dw: number; dh: number } | null;
  onDragStart: (el: FormElement, e: React.MouseEvent) => void;
  onDrag: (el: FormElement, screen: { x: number; y: number }, d: { x: number; y: number }, me: MouseEvent) => void;
  onDragStop: (el: FormElement, screen: { x: number; y: number }, d: { x: number; y: number }, me: MouseEvent) => void;
  onResize: (el: FormElement, dir: string, ref: HTMLElement, position: { x: number; y: number }, me: MouseEvent) => void;
  onResizeStop: (el: FormElement) => void;
  onResetResize: () => void;
}

export const ElementOverlay = memo(function ElementOverlay({
  element: el,
  layout,
  zoom,
  isSelected,
  isMultiSelected,
  livePos,
  isMultiResize,
  isSnapTarget,
  effectiveDragOffset,
  isDragging,
  isResizing,
  dragSnapCorrection,
  resizeSnapCorrection,
  onDragStart,
  onDrag,
  onDragStop,
  onResize,
  onResizeStop,
  onResetResize,
}: ElementOverlayProps) {
  const screen = pdfToScreen(
    { x: isMultiResize ? livePos!.x : el.x, y: isMultiResize ? livePos!.y : el.y },
    { zoom, pageX: layout.xOffset, pageY: layout.yOffset },
  );
  const screenX = screen.x + (effectiveDragOffset ? effectiveDragOffset.dx : 0);
  const screenY = screen.y + (effectiveDragOffset ? effectiveDragOffset.dy : 0);
  const screenWidth = (isMultiResize ? livePos!.width : el.width) * zoom;
  const screenHeight = (isMultiResize ? livePos!.height : el.height) * zoom;

  const handleCfg = getHandleConfig(
    el, isSelected, isMultiSelected, isDragging,
    isResizing ? resizeSnapCorrection : undefined,
  );

  const handleRndDragStart = useCallback((e: unknown) => {
    onDragStart(el, e as React.MouseEvent);
    onResetResize();
  }, [el, onDragStart, onResetResize]);

  const handleRndDrag = useCallback((dragEvent: unknown, d: { x: number; y: number }) => {
    onDrag(el, { x: screenX, y: screenY }, d, dragEvent as MouseEvent);
  }, [el, screenX, screenY, onDrag]);

  const handleRndDragStop = useCallback((dragStopEvent: unknown, d: { x: number; y: number }) => {
    onDragStop(el, { x: screenX, y: screenY }, d, dragStopEvent as MouseEvent);
  }, [el, screenX, screenY, onDragStop]);

  const handleRndResize = useCallback((resizeEvent: unknown, dir: string, ref: HTMLElement, _delta: unknown, position: { x: number; y: number }) => {
    onResize(el, dir, ref, position, resizeEvent as MouseEvent);
  }, [el, onResize]);

  const handleRndResizeStop = useCallback(() => {
    onResizeStop(el);
  }, [el, onResizeStop]);

  const styleConfig = getElementStyleConfig(el);

  return (
    <Rnd
      data-element-overlay
      data-element-id={el.id}
      scale={1}
      style={{ zIndex: isSelected ? 50 : undefined }}
      size={{ width: screenWidth, height: screenHeight }}
      position={{ x: screenX, y: screenY }}
      minWidth={10}
      minHeight={10}
      enableResizing={handleCfg.enabled}
      resizeHandleStyles={handleCfg.styles}
      onDragStart={handleRndDragStart}
      onDrag={handleRndDrag}
      onDragStop={handleRndDragStop}
      onResize={handleRndResize}
      onResizeStop={handleRndResizeStop}
    >
      <div
        role="button"
        aria-label={`${getElementName(el)} (${getFieldTypeLabel(styleConfig)})`}
        aria-pressed={isSelected}
        tabIndex={-1}
        className={`h-full w-full flex items-center justify-center outline-none ring-0 ${
          isSelected
            ? styleConfig.borderBgClass(true)
            : `border border-dashed ${styleConfig.dimBorderClass} ${styleConfig.borderBgClass(false).split(' ').find(c => c.startsWith('bg-')) ?? ''}`
        } ${
          isSnapTarget ? "border-2" : ""
        }`}
        style={{
          ...(isSnapTarget
            ? { borderColor: "var(--guide-snap)" }
            : !isSelected
              ? { borderColor: getFieldColor(el), opacity: 0.5 }
              : {}),
          ...(isResizing && resizeSnapCorrection
            ? {
                transform: `translate(${resizeSnapCorrection.dx}px, ${resizeSnapCorrection.dy}px)`,
                width: `calc(100% + ${resizeSnapCorrection.dw}px)`,
                height: `calc(100% + ${resizeSnapCorrection.dh}px)`,
              }
            : isDragging && dragSnapCorrection
              ? {
                  transform: `translate(${dragSnapCorrection.dx}px, ${dragSnapCorrection.dy}px)`,
                }
              : {}),
        }}
      >
        {el.type === "checkbox" && (
          <Square className={`h-3/5 w-3/5 ${styleConfig.colorClass}`} strokeWidth={2} />
        )}
        {el.type === "radio" && (
          <CircleDot className={`h-3/5 w-3/5 ${styleConfig.colorClass}`} strokeWidth={2} />
        )}
        {el.type === "text" && el.multiline && !el.defaultValue && (
          <AlignLeft className={`h-3/5 w-3/5 ${styleConfig.colorClass} opacity-50`} strokeWidth={2} />
        )}
        {el.type === "text" && !el.multiline && !el.defaultValue && (
          <Type className={`h-3/5 w-3/5 ${styleConfig.colorClass} opacity-50`} strokeWidth={2} />
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
              overflowWrap: "break-word",
              wordBreak: "break-word",
            }}
          >
            {el.defaultValue}
          </span>
        )}
        {el.type === "dropdown" && (
          <SquareChevronDown className={`h-3/5 w-3/5 ${styleConfig.colorClass}`} strokeWidth={2} />
        )}
        {el.type === "button" && !el.label && (
          <SquareMousePointer className={`h-3/5 w-3/5 ${styleConfig.colorClass}`} strokeWidth={2} />
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
              overflowWrap: "break-word",
              wordBreak: "break-word",
            }}
          >
            {el.label}
          </span>
        )}
        {el.type === "optionlist" && (
          <List className={`h-3/5 w-3/5 ${styleConfig.colorClass}`} strokeWidth={2} />
        )}
        <span
          className={`absolute -top-4 left-0 max-w-28 min-w-0 truncate overflow-hidden text-[10px] select-none ${styleConfig.textColorClass}`}
        >
          {getElementName(el)}
        </span>
      </div>
    </Rnd>
  );
});
