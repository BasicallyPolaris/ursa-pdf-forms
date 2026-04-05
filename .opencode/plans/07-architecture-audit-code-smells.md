# Architecture Audit & Code Smell Findings

**Date**: 2026-04-06
**Scope**: Full codebase review — code smells, duplication, architectural issues, anti-patterns
**Status**: Findings documented, not yet addressed

---

## Audit Health Score: 16/20 (Good)

| Dimension | Score | Key Finding |
|-----------|-------|-------------|
| Accessibility | 3/4 | ARIA labels, keyboard nav, semantic roles — good but not AAA |
| Performance | 3/4 | Virtualized rendering, memoization, debounced rasterization |
| Theming | 4/4 | Full oklch token system, semantic field colors, consistent dark mode |
| Responsive | 2/4 | Desktop-only by design, fixed sidebar widths, no mobile adaptation |
| Anti-Patterns | 4/4 | No AI slop, distinctive professional aesthetic |

---

## P1 — Major Issues

### 1. `canvas-overlay.tsx` is a 1825-line God Component

**File**: `src/components/canvas-overlay.tsx`
**Severity**: HIGH

Handles element rendering, drawing (click-to-place + drag-to-draw), marquee selection, snap logic integration, drag/resize with snap correction, guide line rendering & dragging, context menu management, keyboard nudging, bounding rect overlays, and preview guide overlays.

15+ `useState`/`useRef` hooks, 7+ `useCallback` handlers, deeply nested logic in `onDrag`, `onDragStop`, `onResize`, `onResizeStop` callbacks.

**Plan**: Extract into focused sub-components and hooks:
- `useElementDrag()` — drag logic with snap
- `useElementResize()` — resize logic with snap
- `useMarqueeSelection()` — marquee state
- `useDrawingTool()` — draw-to-create
- `GuideLineOverlay` component
- `SnapGuideOverlay` component
- `BoundingRectOverlay` component

---

### 2. Duplicated Alignment Store Logic (6x)

**File**: `src/stores/editor-store.ts:392-498`
**Severity**: HIGH

The pattern `get state → check size → call alignment function → set with map/find` is repeated identically in:
- `alignElements` (6 case branches → one shared set block)
- `distributeElements`
- `centerSelectionOnPage`
- `centerSelectionOnPageH`
- `centerSelectionOnPageV`

Each repeats the same `.map()` + `.find()` merge:

```ts
set((s) => ({
  elements: s.elements.map((el) => {
    const u = updates.find((u) => u.id === el.id);
    return u ? { ...el, x: u.x, y: u.y } : el;
  }),
}));
```

**Plan**: Extract `applyPositionUpdates(updates)` helper used by all 5 methods.

---

### 3. Duplicated `pasteClipboard` / `duplicateSelection` Logic

**File**: `src/stores/editor-store.ts:266-351`
**Severity**: HIGH

~80% identical code: creating new IDs, deep-cloning, applying offsets, calling `getUniqueName`. Only differs in source (clipboard vs selected) and offset behavior.

**Plan**: Extract shared `cloneElementsWithNewIds(elements, existingElements, options)` helper.

---

## P2 — Minor Issues

### 4. Duplicated `setPdf` / `clearPdf` State Object

**File**: `src/stores/editor-store.ts:142-160` and `168-186`

Both set the exact same 10-field state object. `clearPdf` could delegate to `setPdf(null, null, [])` with a reset flag.

---

### 5. Unsafe `as FormElement` Type Casts (6 locations)

**File**: `src/stores/editor-store.ts` — lines 203, 213-218, 293, 336, 379, 529

Spread-merge pattern loses discriminated union type information, requiring casts.

**Plan**: Create type-safe merge utility or use per-type update functions.

---

### 6. O(n²) `find()` in Inner Loops

**File**: `src/stores/editor-store.ts:209-220`, `376-382`, `392-498`

Each element linearly scans the updates array. With many elements and many updates, this is O(n*m).

**Plan**: Convert `updates` array to `Map<string, Update>` before `.map()`.

---

### 7. Repeated Page-Edge Center Snap Logic in `findAllAlignmentGuides`

**File**: `src/lib/snap-engine.ts:296-327`

6 repetitive if-blocks for horizontal page-edge checks and 6 for vertical. Only the edge variable changes.

**Plan**: Extract helper that checks all relevant edges against page boundaries.

---

### 8. Duplicated `hasSnap` Check Pattern (6x)

**File**: `src/components/canvas-overlay.tsx` — lines ~338, 396, 861, 1019, 1155, 1251

```ts
const hasSnap = snapCtx.snapToGrid || snapCtx.snapToElements || snapCtx.snapToGuides || snapCtx.snapToPageEdges;
```

**Plan**: Add computed `hasAnySnap: boolean` field to `SnapContext`.

---

### 9. Module-Level Mutable Singletons

**Files**: `pdf-loader.ts:41-42`, `render-worker-manager.ts:132`, `use-zoom-animation.ts:81`, `editor-store.ts:25-33`, `editor-store.ts:585-586`

Module-level mutable state (`cachedBytes`, `cachedDoc`, `instance`, counters, dirty tracking) is difficult to test and can cause state leaks between tests.

**Plan**: Wrap singletons in testable contexts. Move counters/dirty-tracking into store or injectable module.

---

### 10. Duplicated Thumbnail Render Logic in Page Sidebar

**File**: `src/components/page-sidebar.tsx:117-294`

Two nearly identical `useEffect` blocks (visible range vs idle pre-render) with copy-pasted drain/render/catch/finally pattern.

**Plan**: Extract shared `renderThumbnails(options)` function called by both effects.

---

## P3 — Polish

### 11. `isDirty()` Uses `JSON.stringify` for Comparison

**File**: `src/stores/editor-store.ts:588-595`

Every call serializes the entire elements array and guides to JSON. Called on close-request and potentially during UI updates.

**Plan**: Use a dirty flag set on mutations, or compare by reference with saved snapshot.

---

### 12. Duplicate `snapToGrid` Function

**File**: `src/components/ruler.tsx:25-27` duplicates `src/lib/snap-engine.ts:27-30`

**Plan**: Import from `snap-engine.ts`.

---

### 13. Duplicate `Rect` / `BoundingRect` Types

**Files**: `src/lib/geometry.ts` and `src/lib/selection-geometry.ts`

Two identical `{ x, y, width, height }` interfaces.

**Plan**: Use a single shared `Rect` type.

---

### 14. `page-coordinates.ts` Sorts Pages on Every Call

**File**: `src/lib/page-coordinates.ts:17`

Creates a sorted copy of pages array on every `resolveElementPosition` invocation. Pages are typically already sorted.

**Plan**: Accept pre-sorted pages or cache the sorted result.

---

## Positive Findings (Maintain)

1. **File-IO port/adapter pattern** — `ports.ts` defines clean interfaces, `orchestrator.ts` is pure business logic, adapters are swappable, test adapters are comprehensive.
2. **Pure lib modules** — `alignment.ts`, `snap-engine.ts`, `coordinates.ts`, `geometry.ts`, `form-element-model.ts`, `pdf-export-engine.ts` are well-separated from store/component code.
3. **Design token system** — oklch with semantic field-type colors (blue/green/purple/amber) is thoughtful and consistent.
4. **Virtualized PDF rendering** — `RenderManager`, concurrent limits, debounced rasterization well-implemented.
5. **Zoom engine** — rAF batching, scroll preservation math, clean listener pattern.
6. **Undo/redo via zundo** — partialize and selection pruning well-handled.
7. **No AI slop** — distinctive, professional aesthetic.

---

## Implementation Priority

1. Extract `applyPositionUpdates()` — quick win, removes ~50 lines of duplication
2. Extract `cloneElementsWithNewIds()` — removes ~60 lines of duplication
3. Add `hasAnySnap` to `SnapContext` — small change, 6 fewer duplicated checks
4. DRY `setPdf`/`clearPdf` — trivial
5. Import `snapToGrid` in ruler — trivial
6. Unify `Rect`/`BoundingRect` — trivial
7. Convert `find()` to Map lookups — moderate
8. DRY page-sidebar render — moderate
9. Fix `as FormElement` casts — moderate, requires careful typing
10. Refactor `canvas-overlay.tsx` — large effort, highest impact
