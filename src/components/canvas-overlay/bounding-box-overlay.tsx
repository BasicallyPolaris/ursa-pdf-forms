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
  allHeightLocked: boolean;
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

export function BoundingBoxOverlay({
  boundingBox,
  isDragging,
  allHeightLocked,
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

  return (
    <MultiResizeRnd
      rect={boundingBox}
      enableResizing={allHeightLocked ? HORIZONTAL_HANDLES : ALL_HANDLES}
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
  snapCorrection,
  onResizeStart,
  onResize,
  onResizeStop,
}: {
  rect: ScreenRect;
  enableResizing: Record<string, boolean>;
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
      resizeHandleStyles={HANDLE_STYLES}
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
  topLeft: { ...HS, top: "-4px", left: "-4px" },
  top: { ...HS, top: "-4px", left: "calc(50% - 3.5px)", cursor: "row-resize" },
  topRight: { ...HS, top: "-4px", right: "-4px" },
  right: { ...HS, top: "calc(50% - 3.5px)", right: "-4px", cursor: "col-resize" },
  bottomRight: { ...HS, bottom: "-4px", right: "-4px" },
  bottom: { ...HS, bottom: "-4px", left: "calc(50% - 3.5px)", cursor: "row-resize" },
  bottomLeft: { ...HS, bottom: "-4px", left: "-4px" },
  left: { ...HS, top: "calc(50% - 3.5px)", left: "-4px", cursor: "col-resize" },
};
