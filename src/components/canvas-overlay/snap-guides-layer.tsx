import type { SnapGuide } from "@/lib/snap-engine";
import type { PageInfo } from "@/lib/pdf-loader";

interface PageLayout {
  xOffset: number;
  yOffset: number;
  screenWidth: number;
  screenHeight: number;
}

interface SnapGuidesLayerProps {
  activeGuides: SnapGuide[];
  pages: PageInfo[];
  layouts: Map<number, PageLayout>;
  zoom: number;
  overlayWidth: number;
  totalContentHeight: number;
}

const guideColor = (type: SnapGuide["type"]) => {
  if (type === "element" || type === "grid") return "var(--guide-snap)";
  if (type === "page") return "var(--guide-page)";
  return "var(--guide-ruler)";
};

export function SnapGuidesLayer({
  activeGuides,
  pages,
  layouts,
  zoom,
  overlayWidth,
  totalContentHeight,
}: SnapGuidesLayerProps) {
  return (
    <>
      {activeGuides.flatMap((guide, i) => {
        if (guide.orientation === "horizontal") {
          return pages.map((page, pi) => {
            const layout = layouts.get(page.pageNumber);
            const screenY =
              (layout?.yOffset ?? 0) + guide.position * zoom;
            return (
              <div
                key={`guide-${i}-page-${pi}`}
                className="pointer-events-none absolute z-50"
                style={{
                  left: 0,
                  top: screenY - 0.5,
                  width: overlayWidth,
                  height: 2,
                  backgroundColor: guideColor(guide.type),
                }}
              />
            );
          });
        } else {
          const firstLayout = layouts.get(1);
          const screenX = firstLayout
            ? firstLayout.xOffset + guide.position * zoom
            : guide.position * zoom;
          return [
            <div
              key={`guide-${i}`}
              className="pointer-events-none absolute z-50"
              style={{
                left: screenX - 0.5,
                top: 0,
                width: 2,
                height: totalContentHeight,
                backgroundColor: guideColor(guide.type),
              }}
            />,
          ];
        }
      })}
    </>
  );
}
