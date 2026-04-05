interface MarqueeOverlayProps {
  marqueeRect: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null;
}

export function MarqueeOverlay({ marqueeRect }: MarqueeOverlayProps) {
  if (!marqueeRect || marqueeRect.width <= 0 || marqueeRect.height <= 0)
    return null;

  return (
    <div
      className="pointer-events-none absolute border border-field-text/50 bg-field-text-bg"
      style={{
        left: marqueeRect.left,
        top: marqueeRect.top,
        width: marqueeRect.width,
        height: marqueeRect.height,
      }}
    />
  );
}
