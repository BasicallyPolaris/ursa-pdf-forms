import type { PageInfo } from "@/lib/pdf-loader";
import type { PageLayout } from "@/lib/page-layout";

interface PreviewGuideLayerProps {
  previewGuide: {
    orientation: "horizontal" | "vertical";
    position: number;
  } | null;
  pages: PageInfo[];
  layouts: Map<number, PageLayout>;
  zoom: number;
  overlayWidth: number;
  totalContentHeight: number;
}

export function PreviewGuideLayer({
  previewGuide,
  pages,
  layouts,
  zoom,
  overlayWidth,
  totalContentHeight,
}: PreviewGuideLayerProps) {
  if (!previewGuide) return null;

  if (previewGuide.orientation === "horizontal") {
    return (
      <>
        {pages.map((page, pi) => {
          const layout = layouts.get(page.pageNumber);
          const screenY =
            (layout?.yOffset ?? 16) + previewGuide.position * zoom;
          return (
            <div
              key={`preview-guide-page-${pi}`}
              className="pointer-events-none absolute z-50"
              style={{
                left: 0,
                top: screenY,
                width: overlayWidth,
                height: 1,
                backgroundColor: "var(--guide-ruler)",
              }}
            />
          );
        })}
      </>
    );
  } else {
    const firstLayout = layouts.get(1);
    const screenX = firstLayout
      ? firstLayout.xOffset + previewGuide.position * zoom
      : previewGuide.position * zoom;
    return (
      <div
        key="preview-guide"
        className="pointer-events-none absolute z-50"
        style={{
          left: screenX,
          top: 0,
          width: 1,
          height: totalContentHeight,
          backgroundColor: "var(--guide-ruler)",
        }}
      />
    );
  }
}
