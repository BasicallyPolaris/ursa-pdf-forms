import { useCallback } from "react";
import { Rnd } from "react-rnd";

interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BoundingBoxOverlayProps {
  boundingBox: ScreenRect | null;
  isDragging: boolean;
  anyHeightLocked: boolean;
  snapCorrection?: {
    dx: number;
    dy: number;
    dw: number;
    dh: number;
  } | null;
  onResizeStart: () => void;
  onResize: (
    dir: string,
    ref: HTMLElement,
    position: { x: number; y: number },
    resizeEvent: MouseEvent,
  ) => void;
  onResizeStop: () => void;
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

export function BoundingBoxOverlay({
  boundingBox,
  isDragging,
  anyHeightLocked,
  snapCorrection,
  onResizeStart,
  onResize,
  onResizeStop,
}: BoundingBoxOverlayProps) {
  if (!boundingBox) return null;

  if (isDragging) {
    return (
      <div
        className="pointer-events-none absolute"
        style={{
          left: boundingBox.x,
          top: boundingBox.y,
          width: boundingBox.width,
          height: boundingBox.height,
          border: "1px dashed var(--bounding-rect)",
          opacity: 0.6,
        }}
      />
    );
  }

  const handleStyles = snapCorrection
    ? applySnapToHandleStyles(HANDLE_STYLES, snapCorrection)
    : HANDLE_STYLES;

  return (
    <MultiResizeRnd
      rect={boundingBox}
      enableResizing={anyHeightLocked ? HORIZONTAL_HANDLES : ALL_HANDLES}
      handleStyles={handleStyles}
      snapCorrection={snapCorrection}
      onResizeStart={onResizeStart}
      onResize={onResize}
      onResizeStop={onResizeStop}
    />
  );
}

function MultiResizeRnd({
  rect,
  enableResizing,
  handleStyles,
  snapCorrection,
  onResizeStart,
  onResize,
  onResizeStop,
}: {
  rect: ScreenRect;
  enableResizing: Record<string, boolean>;
  handleStyles: Record<string, React.CSSProperties>;
  snapCorrection?: {
    dx: number;
    dy: number;
    dw: number;
    dh: number;
  } | null;
  onResizeStart: () => void;
  onResize: (
    dir: string,
    ref: HTMLElement,
    position: { x: number; y: number },
    resizeEvent: MouseEvent,
  ) => void;
  onResizeStop: () => void;
}) {
  const handleResize = useCallback(
    (
      resizeEvent: unknown,
      dir: string,
      ref: HTMLElement,
      _delta: unknown,
      position: { x: number; y: number },
    ) => {
      onResize(dir, ref, position, resizeEvent as MouseEvent);
    },
    [onResize],
  );

  return (
    <Rnd
      style={{ pointerEvents: "none", zIndex: 60 }}
      size={{ width: rect.width, height: rect.height }}
      position={{ x: rect.x, y: rect.y }}
      minWidth={MIN_SCREEN}
      minHeight={MIN_SCREEN}
      enableResizing={enableResizing}
      disableDragging
      resizeHandleStyles={handleStyles}
      onResizeStart={onResizeStart}
      onResize={handleResize}
      onResizeStop={onResizeStop}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          border: "1px dashed var(--bounding-rect)",
          opacity: 0.5,
          ...(snapCorrection
            ? {
                transform: `translate(${snapCorrection.dx}px, ${snapCorrection.dy}px)`,
                width: `calc(100% + ${snapCorrection.dw}px)`,
                height: `calc(100% + ${snapCorrection.dh}px)`,
              }
            : {}),
        }}
      />
    </Rnd>
  );
}

const MIN_SCREEN = 10;

const ALL_HANDLES = {
  topLeft: true,
  top: true,
  topRight: true,
  right: true,
  bottomRight: true,
  bottom: true,
  bottomLeft: true,
  left: true,
};

const HORIZONTAL_HANDLES = {
  left: true,
  right: true,
};

const HS: React.CSSProperties = {
  width: "7px",
  height: "7px",
  background: "oklch(0.98 0 0)",
  border: "1.5px solid var(--bounding-rect)",
  borderRadius: "1px",
  pointerEvents: "auto",
};

const HANDLE_STYLES: Record<string, React.CSSProperties> = {
  topLeft: { ...HS, top: "-4px", left: "-4px", cursor: "nwse-resize" },
  top: { ...HS, top: "-4px", left: "calc(50% - 3.5px)", cursor: "ns-resize" },
  topRight: { ...HS, top: "-4px", right: "-4px", cursor: "nesw-resize" },
  right: { ...HS, top: "calc(50% - 3.5px)", right: "-4px", cursor: "ew-resize" },
  bottomRight: { ...HS, bottom: "-4px", right: "-4px", cursor: "nwse-resize" },
  bottom: { ...HS, bottom: "-4px", left: "calc(50% - 3.5px)", cursor: "ns-resize" },
  bottomLeft: { ...HS, bottom: "-4px", left: "-4px", cursor: "nesw-resize" },
  left: { ...HS, top: "calc(50% - 3.5px)", left: "-4px", cursor: "ew-resize" },
};
