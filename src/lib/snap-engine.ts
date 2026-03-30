export interface SnapGuide {
  orientation: "horizontal" | "vertical";
  position: number;
  type: "grid" | "element" | "page" | "ruler";
}

export interface SnapContext {
  gridSize: number;
  snapThreshold: number;
  pageWidth: number;
  pageHeight: number;
  otherElements: Array<{ x: number; y: number; width: number; height: number }>;
  rulerGuides: Array<{ orientation: "horizontal" | "vertical"; position: number }>;
  snapToGrid: boolean;
  snapToPageEdges: boolean;
  snapToElements: boolean;
  snapToGuides: boolean;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapGuide[];
}

export function snapToGrid(pos: number, gridSize: number): number {
  if (gridSize <= 0) return pos;
  return Math.round(pos / gridSize) * gridSize;
}

export function snapToPageEdge(
  pos: number,
  elementSize: number,
  pageSize: number,
  threshold: number,
  orientation: "horizontal" | "vertical",
): { snapped: number; guide: SnapGuide | null } {
  if (pos <= threshold) {
    return {
      snapped: 0,
      guide: { orientation, position: 0, type: "page" },
    };
  }
  if (pageSize - pos - elementSize <= threshold) {
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

function findBestSnap(pos: number, candidates: SnapCandidate[]): SnapCandidate {
  let best = { snapped: pos, guide: null as SnapGuide | null };
  let bestDist = Infinity;
  for (const c of candidates) {
    const dist = Math.abs(c.snapped - pos);
    if (dist > 0 && dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}

function snapAxisToElements(
  proposedStart: number,
  elementSize: number,
  otherBounds: Array<{ start: number; end: number }>,
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

export function snapPosition(
  proposedX: number,
  proposedY: number,
  elementWidth: number,
  elementHeight: number,
  context: SnapContext,
): SnapResult {
  let snappedX = proposedX;
  let snappedY = proposedY;
  const guides: SnapGuide[] = [];

  const xCandidates: SnapCandidate[] = [];
  const yCandidates: SnapCandidate[] = [];

  if (context.snapToGrid) {
    const gridX = snapToGrid(proposedX, context.gridSize);
    const gridY = snapToGrid(proposedY, context.gridSize);
    if (gridX !== proposedX) {
      xCandidates.push({ snapped: gridX, guide: { orientation: "vertical", position: gridX, type: "grid" } });
    }
    if (gridY !== proposedY) {
      yCandidates.push({ snapped: gridY, guide: { orientation: "horizontal", position: gridY, type: "grid" } });
    }
  }

  if (context.snapToPageEdges) {
    const pageEdgeX = snapToPageEdge(proposedX, elementWidth, context.pageWidth, context.snapThreshold, "vertical");
    const pageEdgeY = snapToPageEdge(proposedY, elementHeight, context.pageHeight, context.snapThreshold, "horizontal");
    if (pageEdgeX.snapped !== proposedX) {
      xCandidates.push({ snapped: pageEdgeX.snapped, guide: pageEdgeX.guide });
    }
    if (pageEdgeY.snapped !== proposedY) {
      yCandidates.push({ snapped: pageEdgeY.snapped, guide: pageEdgeY.guide });
    }
  }

  if (context.snapToElements) {
    const hBounds = context.otherElements.map((e) => ({ start: e.x, end: e.x + e.width }));
    const vBounds = context.otherElements.map((e) => ({ start: e.y, end: e.y + e.height }));

    xCandidates.push(...snapAxisToElements(proposedX, elementWidth, hBounds, context.snapThreshold, "vertical", "element"));
    yCandidates.push(...snapAxisToElements(proposedY, elementHeight, vBounds, context.snapThreshold, "horizontal", "element"));
  }

  if (context.snapToGuides) {
    const vGuidePositions = context.rulerGuides.filter((g) => g.orientation === "vertical").map((g) => g.position);
    const hGuidePositions = context.rulerGuides.filter((g) => g.orientation === "horizontal").map((g) => g.position);

    xCandidates.push(...snapAxisToGuides(proposedX, elementWidth, vGuidePositions, context.snapThreshold, "vertical"));
    yCandidates.push(...snapAxisToGuides(proposedY, elementHeight, hGuidePositions, context.snapThreshold, "horizontal"));
  }

  const bestX = findBestSnap(proposedX, xCandidates);
  const bestY = findBestSnap(proposedY, yCandidates);

  if (bestX.guide) {
    snappedX = bestX.snapped;
    guides.push(bestX.guide);
  }
  if (bestY.guide) {
    snappedY = bestY.snapped;
    guides.push(bestY.guide);
  }

  return { x: snappedX, y: snappedY, guides };
}

function snapEdgePosition(
  edgePos: number,
  context: SnapContext,
  orientation: "horizontal" | "vertical",
): { snapped: number; guide: SnapGuide | null } {
  const candidates: SnapCandidate[] = [];

  if (context.snapToGrid) {
    const gridPos = snapToGrid(edgePos, context.gridSize);
    if (gridPos !== edgePos) {
      candidates.push({ snapped: gridPos, guide: { orientation, position: gridPos, type: "grid" } });
    }
  }

  if (context.snapToPageEdges) {
    const pageSize = orientation === "vertical" ? context.pageWidth : context.pageHeight;
    if (Math.abs(edgePos) <= context.snapThreshold) {
      candidates.push({ snapped: 0, guide: { orientation, position: 0, type: "page" } });
    }
    if (Math.abs(pageSize - edgePos) <= context.snapThreshold) {
      candidates.push({ snapped: pageSize, guide: { orientation, position: pageSize, type: "page" } });
    }
  }

  if (context.snapToElements) {
    const bounds =
      orientation === "vertical"
        ? context.otherElements.map((e) => ({ start: e.x, end: e.x + e.width }))
        : context.otherElements.map((e) => ({ start: e.y, end: e.y + e.height }));
    for (const other of bounds) {
      for (const target of [other.start, other.end]) {
        const dist = Math.abs(edgePos - target);
        if (dist > 0 && dist <= context.snapThreshold) {
          candidates.push({ snapped: target, guide: { orientation, position: target, type: "element" } });
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
        candidates.push({ snapped: gp, guide: { orientation, position: gp, type: "ruler" } });
      }
    }
  }

  return findBestSnap(edgePos, candidates);
}

export function snapResizeBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  direction: string,
  context: SnapContext,
): { x: number; y: number; width: number; height: number; guides: SnapGuide[] } {
  const guides: SnapGuide[] = [];
  let newX = x,
    newY = y,
    newW = width,
    newH = height;

  const movesRight = direction === "right" || direction === "topRight" || direction === "bottomRight";
  const movesLeft = direction === "left" || direction === "topLeft" || direction === "bottomLeft";
  const movesBottom = direction === "bottom" || direction === "bottomRight" || direction === "bottomLeft";
  const movesTop = direction === "top" || direction === "topRight" || direction === "topLeft";

  if (movesRight) {
    const result = snapEdgePosition(x + width, context, "vertical");
    if (result.guide) {
      newW = result.snapped - x;
      guides.push(result.guide);
    }
  }

  if (movesLeft) {
    const result = snapEdgePosition(x, context, "vertical");
    if (result.guide) {
      const rightEdge = x + width;
      newX = result.snapped;
      newW = rightEdge - newX;
      guides.push(result.guide);
    }
  }

  if (movesBottom) {
    const result = snapEdgePosition(y + height, context, "horizontal");
    if (result.guide) {
      newH = result.snapped - y;
      guides.push(result.guide);
    }
  }

  if (movesTop) {
    const result = snapEdgePosition(y, context, "horizontal");
    if (result.guide) {
      const bottomEdge = y + height;
      newY = result.snapped;
      newH = bottomEdge - newY;
      guides.push(result.guide);
    }
  }

  return { x: newX, y: newY, width: newW, height: newH, guides };
}
