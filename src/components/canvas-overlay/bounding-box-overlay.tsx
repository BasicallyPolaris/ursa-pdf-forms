interface BoundingBox {
  screenX: number;
  screenY: number;
  screenWidth: number;
  screenHeight: number;
}

interface BoundingBoxOverlayProps {
  boundingBoxes: BoundingBox[];
  dragOffset: { dx: number; dy: number } | null;
}

export function BoundingBoxOverlay({ boundingBoxes, dragOffset }: BoundingBoxOverlayProps) {
  if (boundingBoxes.length === 0) return null;

  return (
    <>
      {boundingBoxes.map((rect, i) => (
        <div
          key={`bounding-rect-${i}`}
          className="pointer-events-none absolute"
          style={{
            left: rect.screenX,
            top: rect.screenY,
            width: rect.screenWidth,
            height: rect.screenHeight,
            border:
              dragOffset !== null
                ? "1px dashed var(--bounding-rect)"
                : "1px dotted var(--bounding-rect)",
            opacity: dragOffset !== null ? 0.6 : 0.4,
          }}
        />
      ))}
    </>
  );
}
