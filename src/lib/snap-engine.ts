export interface SnapGuide {
  orientation: "horizontal" | "vertical";
  position: number;
  type: "grid" | "element" | "page" | "ruler";
  elementId?: string;
}

export interface SnapContext {
  gridSize: number;
  snapThreshold: number;
  pageWidth: number;
  pageHeight: number;
  otherElements: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    id?: string;
  }>;
  rulerGuides: Array<{
    orientation: "horizontal" | "vertical";
    position: number;
  }>;
  snapToGrid: boolean;
  snapToPageEdges: boolean;
  snapToElements: boolean;
  snapToGuides: boolean;
  hasAnySnap: boolean;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapGuide[];
}

export function snapToGrid(pos: number, gridSize: number): number {
  if (!Number.isFinite(gridSize) || gridSize <= 0) return pos;
  return Math.round(pos / gridSize) * gridSize;
}

export function snapToPageEdge(
  pos: number,
  elementSize: number,
  pageSize: number,
  threshold: number,
  orientation: "horizontal" | "vertical",
): { snapped: number; guide: SnapGuide | null } {
  if (Math.abs(pos) <= threshold) {
    return {
      snapped: 0,
      guide: { orientation, position: 0, type: "page" },
    };
  }
  if (Math.abs(pageSize - pos - elementSize) <= threshold) {
    return {
      snapped: pageSize - elementSize,
      guide: { orientation, position: pageSize, type: "page" },
    };
  }
  return { snapped: pos, guide: null };
}

interface SnapCandidate {
  snapped: number;
  guide: SnapGuide | null;
}

const TIE_ZONE = 1.0;

function findBestSnap(
  pos: number,
  candidates: SnapCandidate[],
  previousSnapped?: number,
): SnapCandidate {
  let best = { snapped: pos, guide: null as SnapGuide | null };
  let bestDist = Infinity;

  for (const c of candidates) {
    const dist = Math.abs(c.snapped - pos);
    if (dist > 0 && dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }

  if (best.guide && previousSnapped !== undefined) {
    const tied = candidates.filter(
      (c) =>
        c.guide && Math.abs(Math.abs(c.snapped - pos) - bestDist) <= TIE_ZONE,
    );
    if (tied.length > 1) {
      let closest = best;
      let closestDist = Math.abs(best.snapped - previousSnapped);
      for (const c of tied) {
        const d = Math.abs(c.snapped - previousSnapped);
        if (d < closestDist) {
          closestDist = d;
          closest = c;
        }
      }
      return closest;
    }
  }

  return best;
}

function snapAxisToElements(
  proposedStart: number,
  elementSize: number,
  otherBounds: Array<{ start: number; end: number; id?: string }>,
  threshold: number,
  orientation: "horizontal" | "vertical",
  guideType: "element",
): SnapCandidate[] {
  const candidates: SnapCandidate[] = [];
  const proposedCenter = proposedStart + elementSize / 2;
  const proposedEnd = proposedStart + elementSize;

  for (const other of otherBounds) {
    const otherCenter = (other.start + other.end) / 2;

    const checks: Array<{ proposed: number; target: number }> = [
      { proposed: proposedStart, target: other.start },
      { proposed: proposedStart, target: other.end },
      { proposed: proposedEnd, target: other.start },
      { proposed: proposedEnd, target: other.end },
      { proposed: proposedCenter, target: otherCenter },
      { proposed: proposedCenter, target: other.start },
      { proposed: proposedCenter, target: other.end },
      { proposed: proposedStart, target: otherCenter },
      { proposed: proposedEnd, target: otherCenter },
    ];

    for (const check of checks) {
      const dist = Math.abs(check.proposed - check.target);
      if (dist > 0 && dist <= threshold) {
        const offset = check.target - check.proposed;
        const snappedStart = proposedStart + offset;
        candidates.push({
          snapped: snappedStart,
          guide: {
            orientation,
            position: check.target,
            type: guideType,
            elementId: other.id,
          },
        });
      }
    }
  }

  return candidates;
}

function snapAxisToGuides(
  proposedStart: number,
  elementSize: number,
  guidePositions: number[],
  threshold: number,
  orientation: "horizontal" | "vertical",
): SnapCandidate[] {
  const candidates: SnapCandidate[] = [];
  const proposedCenter = proposedStart + elementSize / 2;
  const proposedEnd = proposedStart + elementSize;

  const refPoints = [proposedStart, proposedCenter, proposedEnd];

  for (const guidePos of guidePositions) {
    for (const ref of refPoints) {
      const dist = Math.abs(ref - guidePos);
      if (dist > 0 && dist <= threshold) {
        const offset = guidePos - ref;
        candidates.push({
          snapped: proposedStart + offset,
          guide: {
            orientation,
            position: guidePos,
            type: "ruler",
          },
        });
      }
    }
  }

  return candidates;
}

const CONCURRENT_TOLERANCE = 0.1;

function findAllAlignmentGuides(
  snappedX: number,
  snappedY: number,
  elementWidth: number,
  elementHeight: number,
  context: SnapContext,
): SnapGuide[] {
  const guides: SnapGuide[] = [];
  const seen = new Set<string>();

  const addGuide = (guide: SnapGuide) => {
    const key = guide.elementId
      ? `${guide.orientation}:${guide.position}:${guide.type}:${guide.elementId}`
      : `${guide.orientation}:${guide.position}:${guide.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      guides.push(guide);
    }
  };

  const elementEdges = {
    left: snappedX,
    right: snappedX + elementWidth,
    top: snappedY,
    bottom: snappedY + elementHeight,
    centerX: snappedX + elementWidth / 2,
    centerY: snappedY + elementHeight / 2,
  };

  if (context.snapToGrid && context.gridSize > 0) {
    const gridOnly =
      !context.snapToElements &&
      !context.snapToGuides &&
      !context.snapToPageEdges;
    const vEdges = gridOnly
      ? [elementEdges.left, elementEdges.right]
      : [elementEdges.left, elementEdges.right, elementEdges.centerX];
    const hEdges = gridOnly
      ? [elementEdges.top, elementEdges.bottom]
      : [elementEdges.top, elementEdges.bottom, elementEdges.centerY];
    for (const edge of vEdges) {
      const snapped = snapToGrid(edge, context.gridSize);
      if (Math.abs(snapped - edge) <= CONCURRENT_TOLERANCE) {
        addGuide({ orientation: "vertical", position: snapped, type: "grid" });
      }
    }
    for (const edge of hEdges) {
      const snapped = snapToGrid(edge, context.gridSize);
      if (Math.abs(snapped - edge) <= CONCURRENT_TOLERANCE) {
        addGuide({
          orientation: "horizontal",
          position: snapped,
          type: "grid",
        });
      }
    }
  }

  if (context.snapToElements) {
    for (const other of context.otherElements) {
      const otherEdges = {
        left: other.x,
        right: other.x + other.width,
        top: other.y,
        bottom: other.y + other.height,
        centerX: other.x + other.width / 2,
        centerY: other.y + other.height / 2,
      };

      const hChecks: Array<{ val: number; target: number }> = [
        { val: elementEdges.top, target: otherEdges.top },
        { val: elementEdges.top, target: otherEdges.bottom },
        { val: elementEdges.bottom, target: otherEdges.top },
        { val: elementEdges.bottom, target: otherEdges.bottom },
        { val: elementEdges.centerY, target: otherEdges.centerY },
        { val: elementEdges.centerY, target: otherEdges.top },
        { val: elementEdges.centerY, target: otherEdges.bottom },
        { val: elementEdges.top, target: otherEdges.centerY },
        { val: elementEdges.bottom, target: otherEdges.centerY },
      ];

      const vChecks: Array<{ val: number; target: number }> = [
        { val: elementEdges.left, target: otherEdges.left },
        { val: elementEdges.left, target: otherEdges.right },
        { val: elementEdges.right, target: otherEdges.left },
        { val: elementEdges.right, target: otherEdges.right },
        { val: elementEdges.centerX, target: otherEdges.centerX },
        { val: elementEdges.centerX, target: otherEdges.left },
        { val: elementEdges.centerX, target: otherEdges.right },
        { val: elementEdges.left, target: otherEdges.centerX },
        { val: elementEdges.right, target: otherEdges.centerX },
      ];

      for (const check of hChecks) {
        if (Math.abs(check.val - check.target) <= CONCURRENT_TOLERANCE) {
          addGuide({
            orientation: "horizontal",
            position: check.target,
            type: "element",
            elementId: other.id,
          });
        }
      }
      for (const check of vChecks) {
        if (Math.abs(check.val - check.target) <= CONCURRENT_TOLERANCE) {
          addGuide({
            orientation: "vertical",
            position: check.target,
            type: "element",
            elementId: other.id,
          });
        }
      }
    }
  }

  if (context.snapToGuides) {
    const vGuidePositions = context.rulerGuides
      .filter((g) => g.orientation === "vertical")
      .map((g) => g.position);
    const hGuidePositions = context.rulerGuides
      .filter((g) => g.orientation === "horizontal")
      .map((g) => g.position);

    for (const guidePos of hGuidePositions) {
      for (const edge of [
        elementEdges.top,
        elementEdges.bottom,
        elementEdges.centerY,
      ]) {
        if (Math.abs(edge - guidePos) <= CONCURRENT_TOLERANCE) {
          addGuide({
            orientation: "horizontal",
            position: guidePos,
            type: "ruler",
          });
        }
      }
    }
    for (const guidePos of vGuidePositions) {
      for (const edge of [
        elementEdges.left,
        elementEdges.right,
        elementEdges.centerX,
      ]) {
        if (Math.abs(edge - guidePos) <= CONCURRENT_TOLERANCE) {
          addGuide({
            orientation: "vertical",
            position: guidePos,
            type: "ruler",
          });
        }
      }
    }
  }

  if (context.snapToPageEdges) {
    const hEdgeChecks: Array<{ edge: number; target: number }> = [
      { edge: elementEdges.top, target: 0 },
      { edge: elementEdges.bottom, target: context.pageHeight },
      { edge: elementEdges.centerY, target: context.pageHeight / 2 },
      { edge: elementEdges.top, target: context.pageHeight / 2 },
      { edge: elementEdges.bottom, target: context.pageHeight / 2 },
    ];
    for (const check of hEdgeChecks) {
      if (Math.abs(check.edge - check.target) <= CONCURRENT_TOLERANCE) {
        addGuide({
          orientation: "horizontal",
          position: check.target,
          type: "page",
        });
      }
    }

    const vEdgeChecks: Array<{ edge: number; target: number }> = [
      { edge: elementEdges.left, target: 0 },
      { edge: elementEdges.right, target: context.pageWidth },
      { edge: elementEdges.centerX, target: context.pageWidth / 2 },
      { edge: elementEdges.left, target: context.pageWidth / 2 },
      { edge: elementEdges.right, target: context.pageWidth / 2 },
    ];
    for (const check of vEdgeChecks) {
      if (Math.abs(check.edge - check.target) <= CONCURRENT_TOLERANCE) {
        addGuide({
          orientation: "vertical",
          position: check.target,
          type: "page",
        });
      }
    }
  }

  return guides;
}

export function snapPosition(
  proposedX: number,
  proposedY: number,
  elementWidth: number,
  elementHeight: number,
  context: SnapContext,
  options?: { previousSnappedX?: number; previousSnappedY?: number },
): SnapResult {
  let snappedX = proposedX;
  let snappedY = proposedY;

  const xCandidates: SnapCandidate[] = [];
  const yCandidates: SnapCandidate[] = [];

  if (context.snapToGrid) {
    const gridLeft = snapToGrid(proposedX, context.gridSize);
    if (gridLeft !== proposedX) {
      xCandidates.push({
        snapped: gridLeft,
        guide: { orientation: "vertical", position: gridLeft, type: "grid" },
      });
    }
    const proposedRight = proposedX + elementWidth;
    const gridRight = snapToGrid(proposedRight, context.gridSize);
    const snappedXFromRight = gridRight - elementWidth;
    if (snappedXFromRight !== proposedX) {
      xCandidates.push({
        snapped: snappedXFromRight,
        guide: { orientation: "vertical", position: gridRight, type: "grid" },
      });
    }

    const gridTop = snapToGrid(proposedY, context.gridSize);
    if (gridTop !== proposedY) {
      yCandidates.push({
        snapped: gridTop,
        guide: { orientation: "horizontal", position: gridTop, type: "grid" },
      });
    }
    const proposedBottom = proposedY + elementHeight;
    const gridBottom = snapToGrid(proposedBottom, context.gridSize);
    const snappedYFromBottom = gridBottom - elementHeight;
    if (snappedYFromBottom !== proposedY) {
      yCandidates.push({
        snapped: snappedYFromBottom,
        guide: {
          orientation: "horizontal",
          position: gridBottom,
          type: "grid",
        },
      });
    }
  }

  if (context.snapToPageEdges) {
    const pageEdgeX = snapToPageEdge(
      proposedX,
      elementWidth,
      context.pageWidth,
      context.snapThreshold,
      "vertical",
    );
    const pageEdgeY = snapToPageEdge(
      proposedY,
      elementHeight,
      context.pageHeight,
      context.snapThreshold,
      "horizontal",
    );
    if (pageEdgeX.snapped !== proposedX) {
      xCandidates.push({ snapped: pageEdgeX.snapped, guide: pageEdgeX.guide });
    }
    if (pageEdgeY.snapped !== proposedY) {
      yCandidates.push({ snapped: pageEdgeY.snapped, guide: pageEdgeY.guide });
    }

    const pageCenterX = context.pageWidth / 2;
    const pageCenterY = context.pageHeight / 2;
    const proposedCenterX = proposedX + elementWidth / 2;
    const proposedCenterY = proposedY + elementHeight / 2;
    const proposedRight = proposedX + elementWidth;
    const proposedBottom = proposedY + elementHeight;

    const xPageCenterChecks = [
      { pos: proposedCenterX, offset: pageCenterX - elementWidth / 2 },
      { pos: proposedX, offset: pageCenterX },
      { pos: proposedRight, offset: pageCenterX - elementWidth },
    ];
    for (const check of xPageCenterChecks) {
      const dist = Math.abs(check.pos - pageCenterX);
      if (dist > 0 && dist <= context.snapThreshold) {
        xCandidates.push({
          snapped: check.offset,
          guide: {
            orientation: "vertical",
            position: pageCenterX,
            type: "page",
          },
        });
      }
    }

    const yPageCenterChecks = [
      { pos: proposedCenterY, offset: pageCenterY - elementHeight / 2 },
      { pos: proposedY, offset: pageCenterY },
      { pos: proposedBottom, offset: pageCenterY - elementHeight },
    ];
    for (const check of yPageCenterChecks) {
      const dist = Math.abs(check.pos - pageCenterY);
      if (dist > 0 && dist <= context.snapThreshold) {
        yCandidates.push({
          snapped: check.offset,
          guide: {
            orientation: "horizontal",
            position: pageCenterY,
            type: "page",
          },
        });
      }
    }
  }

  if (context.snapToElements) {
    const hBounds = context.otherElements.map((e) => ({
      start: e.x,
      end: e.x + e.width,
      id: e.id,
    }));
    const vBounds = context.otherElements.map((e) => ({
      start: e.y,
      end: e.y + e.height,
      id: e.id,
    }));

    xCandidates.push(
      ...snapAxisToElements(
        proposedX,
        elementWidth,
        hBounds,
        context.snapThreshold,
        "vertical",
        "element",
      ),
    );
    yCandidates.push(
      ...snapAxisToElements(
        proposedY,
        elementHeight,
        vBounds,
        context.snapThreshold,
        "horizontal",
        "element",
      ),
    );
  }

  if (context.snapToGuides) {
    const vGuidePositions = context.rulerGuides
      .filter((g) => g.orientation === "vertical")
      .map((g) => g.position);
    const hGuidePositions = context.rulerGuides
      .filter((g) => g.orientation === "horizontal")
      .map((g) => g.position);

    xCandidates.push(
      ...snapAxisToGuides(
        proposedX,
        elementWidth,
        vGuidePositions,
        context.snapThreshold,
        "vertical",
      ),
    );
    yCandidates.push(
      ...snapAxisToGuides(
        proposedY,
        elementHeight,
        hGuidePositions,
        context.snapThreshold,
        "horizontal",
      ),
    );
  }

  const bestX = findBestSnap(proposedX, xCandidates, options?.previousSnappedX);
  const bestY = findBestSnap(proposedY, yCandidates, options?.previousSnappedY);

  if (bestX.guide) {
    snappedX = bestX.snapped;
  }
  if (bestY.guide) {
    snappedY = bestY.snapped;
  }

  const allGuides = findAllAlignmentGuides(
    snappedX,
    snappedY,
    elementWidth,
    elementHeight,
    context,
  );

  return { x: snappedX, y: snappedY, guides: allGuides };
}

function snapEdgePosition(
  edgePos: number,
  context: SnapContext,
  orientation: "horizontal" | "vertical",
  previousSnapped?: number,
): { snapped: number; guide: SnapGuide | null } {
  const candidates: SnapCandidate[] = [];

  if (context.snapToGrid) {
    const gridPos = snapToGrid(edgePos, context.gridSize);
    if (gridPos !== edgePos) {
      candidates.push({
        snapped: gridPos,
        guide: { orientation, position: gridPos, type: "grid" },
      });
    }
  }

  if (context.snapToPageEdges) {
    const pageSize =
      orientation === "vertical" ? context.pageWidth : context.pageHeight;
    if (Math.abs(edgePos) <= context.snapThreshold) {
      candidates.push({
        snapped: 0,
        guide: { orientation, position: 0, type: "page" },
      });
    }
    if (Math.abs(pageSize - edgePos) <= context.snapThreshold) {
      candidates.push({
        snapped: pageSize,
        guide: { orientation, position: pageSize, type: "page" },
      });
    }
    const pageCenter = pageSize / 2;
    if (
      Math.abs(edgePos - pageCenter) > 0 &&
      Math.abs(edgePos - pageCenter) <= context.snapThreshold
    ) {
      candidates.push({
        snapped: pageCenter,
        guide: { orientation, position: pageCenter, type: "page" },
      });
    }
  }

  if (context.snapToElements) {
    const bounds =
      orientation === "vertical"
        ? context.otherElements.map((e) => ({
            start: e.x,
            end: e.x + e.width,
            id: e.id,
          }))
        : context.otherElements.map((e) => ({
            start: e.y,
            end: e.y + e.height,
            id: e.id,
          }));
    for (const other of bounds) {
      const otherCenter = (other.start + other.end) / 2;
      for (const target of [other.start, other.end, otherCenter]) {
        const dist = Math.abs(edgePos - target);
        if (dist > 0 && dist <= context.snapThreshold) {
          candidates.push({
            snapped: target,
            guide: {
              orientation,
              position: target,
              type: "element",
              elementId: other.id,
            },
          });
        }
      }
    }
  }

  if (context.snapToGuides) {
    const guidePositions = context.rulerGuides
      .filter((g) => g.orientation === orientation)
      .map((g) => g.position);
    for (const gp of guidePositions) {
      const dist = Math.abs(edgePos - gp);
      if (dist > 0 && dist <= context.snapThreshold) {
        candidates.push({
          snapped: gp,
          guide: { orientation, position: gp, type: "ruler" },
        });
      }
    }
  }

  return findBestSnap(edgePos, candidates, previousSnapped);
}

export function snapResizeBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  direction: string,
  context: SnapContext,
  options?: { previousSnappedX?: number; previousSnappedY?: number },
): {
  x: number;
  y: number;
  width: number;
  height: number;
  guides: SnapGuide[];
} {
  let newX = x,
    newY = y,
    newW = width,
    newH = height;

  const movesRight =
    direction === "right" ||
    direction === "topRight" ||
    direction === "bottomRight";
  const movesLeft =
    direction === "left" ||
    direction === "topLeft" ||
    direction === "bottomLeft";
  const movesBottom =
    direction === "bottom" ||
    direction === "bottomRight" ||
    direction === "bottomLeft";
  const movesTop =
    direction === "top" || direction === "topRight" || direction === "topLeft";

  if (movesRight) {
    const prevEdge =
      options?.previousSnappedX !== undefined
        ? options.previousSnappedX + width
        : undefined;
    const result = snapEdgePosition(x + width, context, "vertical", prevEdge);
    if (result.guide) {
      newW = result.snapped - x;
    }
  }

  if (movesLeft) {
    const result = snapEdgePosition(
      x,
      context,
      "vertical",
      options?.previousSnappedX,
    );
    if (result.guide) {
      const rightEdge = x + width;
      newX = result.snapped;
      newW = rightEdge - newX;
    }
  }

  if (movesBottom) {
    const prevEdge =
      options?.previousSnappedY !== undefined
        ? options.previousSnappedY + height
        : undefined;
    const result = snapEdgePosition(
      y + height,
      context,
      "horizontal",
      prevEdge,
    );
    if (result.guide) {
      newH = result.snapped - y;
    }
  }

  if (movesTop) {
    const result = snapEdgePosition(
      y,
      context,
      "horizontal",
      options?.previousSnappedY,
    );
    if (result.guide) {
      const bottomEdge = y + height;
      newY = result.snapped;
      newH = bottomEdge - newY;
    }
  }

  const allGuides = findAllAlignmentGuides(newX, newY, newW, newH, context);

  return { x: newX, y: newY, width: newW, height: newH, guides: allGuides };
}
