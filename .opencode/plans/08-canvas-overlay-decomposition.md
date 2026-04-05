# Plan: Final Rehaul — Decompose canvas-overlay & Remaining Cleanups

**Date**: 2026-04-06
**Status**: Ready to implement
**Predecessor**: PR #37 (merged — helpers, duplication, type unification)
**Issue**: #33 (Package C deferred items)

---

## Remaining Work

Everything from the original audit (07) has been addressed except:
1. Decomposing the `canvas-overlay.tsx` god component (1806 lines) — **the big one**
2. `as FormElement` unsafe casts — 4 remaining in editor-store
3. Module-level mutable singletons — 5 locations
4. `isDirty()` uses `JSON.stringify` on every call — performance concern

---

## Package A: Decompose `canvas-overlay.tsx` (1806 lines)

**Goal**: Break into focused hooks and sub-components. Each extracted module should be independently testable and under ~200 lines.

### Current State Analysis

The component manages 10 distinct concerns:
1. **Element drag** — `dragStartPositions`, `draggingId`, `dragOffset`, `dragSnapCorrection`, snap integration
2. **Element resize** — `resizingId`, `resizeHappenedRef`, `lastResizeSnap`, `resizeSnapCorrection`, snap integration
3. **Marquee selection** — `marquee`, `marqueeStartRef`, `isDraggingRef`
4. **Draw-to-create** — `drawRect`, `drawStartRef`, `isDrawingRef`
5. **Guide line interaction** — `draggingGuideIdRef`, guide drag/drop logic
6. **Context menu** — `contextMenuState`, `closeContextMenu`, `handleOverlayContextMenu`
7. **Keyboard nudging** — arrow key handlers in `useEffect`
8. **Element rendering** — Rnd components, style config, bounding rect overlay
9. **Snap guide rendering** — `activeGuides` → visual guide lines
10. **Canvas mouse orchestration** — `handleCanvasMouseDown/Move/Up`, page hit-testing

### Extraction Plan

#### A1. `src/hooks/use-element-drag.ts`
**Extract**: Drag state and logic from CanvasOverlay

State to extract:
- `dragStartPositions` ref
- `draggingId` ref
- `dragOffset` state
- `dragSnapCorrection` state
- `prevSnapRef`

Logic to extract:
- Drag start handler (from `handleCanvasMouseDown` drag section)
- Drag move handler (from inline `onDrag` callbacks in Rnd elements)
- Drag stop handler (from inline `onDragStop` callbacks)
- Multi-drag offset computation
- Snap correction application

Returns: `{ onDragStart, onDrag, onDragStop, dragOffset, dragSnapCorrection, isDragging }`

#### A2. `src/hooks/use-element-resize.ts`
**Extract**: Resize state and logic from CanvasOverlay

State to extract:
- `resizingId` ref
- `resizeHappenedRef` ref
- `lastResizeSnap` ref
- `resizeSnapCorrection` state

Logic to extract:
- Resize start handler
- Resize move handler (from inline `onResize` callbacks)
- Resize stop handler (from inline `onResizeStop` callbacks)
- Resize snap integration

Returns: `{ onResizeStart, onResize, onResizeStop, resizeSnapCorrection }`

#### A3. `src/hooks/use-marquee-selection.ts`
**Extract**: Marquee rectangle selection

State to extract:
- `marquee` state
- `marqueeStartRef` ref
- `isDraggingRef` ref

Logic to extract:
- Marquee start (from `handleCanvasMouseDown` marquee section)
- Marquee update (from `handleCanvasMouseMove` marquee section)
- Marquee end + selection computation (from `handleCanvasMouseUp` marquee section)

Returns: `{ marquee, startMarquee, updateMarquee, endMarquee }`

#### A4. `src/hooks/use-drawing-tool.ts`
**Extract**: Draw-to-create element placement

State to extract:
- `drawRect` state
- `drawStartRef` ref
- `isDrawingRef` ref

Logic to extract:
- Draw start (from `handleCanvasMouseDown` draw section)
- Draw update (from `handleCanvasMouseMove` draw section)
- Draw finalize — create element (from `handleCanvasMouseUp` draw section)

Returns: `{ drawRect, startDraw, updateDraw, finalizeDraw }`

#### A5. `src/hooks/use-guide-drag.ts`
**Extract**: Ruler guide line dragging

State to extract:
- `draggingGuideIdRef` ref

Logic to extract:
- Guide drag start (from ruler onMouseDown)
- Guide drag move (from `handleCanvasMouseMove` guide section)
- Guide drop (from `handleCanvasMouseUp` guide section)

Returns: `{ draggingGuideId, startGuideDrag, updateGuideDrag, endGuideDrag }`

#### A6. `src/components/canvas-overlay/element-overlay.tsx`
**Extract**: Per-element Rnd rendering

The loop that renders each `<Rnd>` element with its style config, drag/resize handlers, and multi-select styling. This is the bulk of the JSX return.

Props: element, style config, drag/resize handlers, zoom, isSelected, livePositions, etc.

#### A7. `src/components/canvas-overlay/snap-guides-layer.tsx`
**Extract**: Snap guide line rendering

The SVG overlay that renders `activeGuides` as colored lines on the canvas.

#### A8. `src/components/canvas-overlay/draw-preview-layer.tsx`
**Extract**: Draw-to-create preview rectangle

The SVG overlay showing the drag-to-draw preview rectangle.

#### A9. `src/components/canvas-overlay/bounding-box-overlay.tsx`
**Extract**: Multi-selection bounding box with resize handles

The bounding rect overlay shown when multiple elements are selected.

#### A10. `src/components/canvas-overlay/guide-lines-layer.tsx`
**Extract**: Ruler guide line rendering

The existing guide lines rendered as draggable divs.

### Glue: `canvas-overlay.tsx` after extraction

After extraction, the component becomes an orchestrator (~300-400 lines):
- Composes the hooks (A1-A5)
- Renders sub-components (A6-A10)
- Manages shared state: `activeGuides`, `contextMenuState`, `overlayWidth`
- Provides `getPageLayouts`, `findPageAtPoint`, `resolveTargetPage`, `buildSnapContext`

### Execution Order

1. **A6-A10** (sub-components) first — these are pure extraction, no state changes
2. **A3 + A4** (marquee + drawing) — these are self-contained concerns
3. **A5** (guide drag) — self-contained
4. **A1 + A2** (drag + resize) — most complex, share snap context
5. Clean up orchestrator — wire hooks together, remove inlined logic

Each step should pass `bun run test` and `bun run build` independently.

---

## Package B: Unsafe `as FormElement` Casts (4 locations)

**File**: `src/stores/editor-store.ts`

Remaining casts:
- Line 55: `cloneElementsWithNewIds` — spread + cast after `structuredClone`
- Line 242: `updateElement` — spread merge loses discriminated union
- Line 254: `moveElements` — spread merge with optional `pageNumber` change
- Line 374: `batchUpdateElements` — spread merge

**Plan**: Create a type-safe element merge utility:

```ts
function mergeElement<T extends FormElement>(el: T, updates: Partial<T>): FormElement {
  return { ...el, ...updates } as FormElement;
}
```

This doesn't eliminate the cast but localizes it to one function. The real fix would require per-type update signatures which is over-engineering for this codebase size.

---

## Package C: `isDirty()` Dirty Flag

**File**: `src/stores/editor-store.ts:522-537`

Currently serializes the entire elements array + guides to JSON on every `isDirty()` call.

**Plan**: Replace with a mutation counter:
- Add `_mutationVersion: number` incremented by every mutating `set()` call
- Store `_savedVersion` in `markClean()`
- `isDirty()` becomes `_mutationVersion !== _savedVersion`
- No JSON serialization at all

---

## Package D: Module-Level Mutable Singletons (optional, low priority)

| Location | Singleton | Impact |
|----------|-----------|--------|
| `pdf-loader.ts:41-42` | `cachedBytes`, `cachedDoc` | Cache invalidation between tests |
| `render-worker-manager.ts:132` | `instance` | RenderManager lifecycle |
| `use-zoom-animation.ts:81` | `instance` | ZoomEngine lifecycle |
| `editor-store.ts:85-90` | `nextPasteId`, `nextGuideId` | ID counter leaks between tests |
| `editor-store.ts:522-523` | `_lastSavedElementsJson`, `_lastSavedGuidesJson` | Replaced by Package C |

These are low-priority because:
- They don't cause bugs in production
- Test isolation works in practice (tests recreate stores/pages)
- Wrapping them adds complexity without user-facing benefit

**Plan**: If addressed, add a `resetModuleState()` export to each module for test setup. Only worth doing if tests become flaky.

---

## Summary

| Package | Scope | Effort | Impact |
|---------|-------|--------|--------|
| A | Decompose canvas-overlay | Large (8 extractions) | Highest — 1806 → ~400 lines, testable hooks |
| B | Type-safe element merge | Trivial | Low — 4 casts → 1 centralized cast |
| C | Dirty flag | Small | Medium — eliminates JSON.stringify per check |
| D | Singleton cleanup | Optional | Low — no production impact |

**Recommended order**: C → B → A6-A10 → A3-A5 → A1-A2 → D
