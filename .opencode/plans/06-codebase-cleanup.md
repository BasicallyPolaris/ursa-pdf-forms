# Plan: Codebase Cleanup — Duplication, Smells, and Centralization

This plan addresses code smells, duplications, non-centralized configurations, and maintainability issues found across the codebase. Tasks are ordered by severity and grouped into independent work packages that can be tackled by separate agents.

---

## Work Package A: Extract Helpers and Kill Duplications (Low effort, high impact)

These are small, self-contained extractions. Each can be done independently.

### A1. Extract `hasAnySnap()` helper

**Files**: `src/lib/snap-engine.ts`, `src/components/canvas-overlay.tsx`

The following 4-line check appears **7 times** in `canvas-overlay.tsx`:

```typescript
const hasSnap =
  snapCtx.snapToGrid ||
  snapCtx.snapToElements ||
  snapCtx.snapToGuides ||
  snapCtx.snapToPageEdges;
```

**Do**:
1. Add to `src/lib/snap-engine.ts`:
   ```typescript
   export function hasAnySnap(ctx: SnapContext): boolean {
     return ctx.snapToGrid || ctx.snapToElements || ctx.snapToGuides || ctx.snapToPageEdges;
   }
   ```
2. In `canvas-overlay.tsx`, replace all 7 occurrences with `import { hasAnySnap }` and `const hasSnap = hasAnySnap(snapCtx);`

---

### A2. Extract `isEditableElement()` DOM guard

**Files**: New `src/lib/dom-utils.ts`, `src/components/canvas-overlay.tsx`, `src/hooks/use-keyboard-shortcuts.ts`, `src/hooks/use-zoom.ts`

The input-focus guard is duplicated in 3 files (twice inline, once as a local function):

```typescript
e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)
```

**Do**:
1. Create `src/lib/dom-utils.ts`:
   ```typescript
   export function isEditableElement(e: KeyboardEvent): boolean {
     return e.target instanceof HTMLElement &&
       ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);
   }
   ```
2. Replace all 3 call sites. Delete the local `isInputElement` function in `use-keyboard-shortcuts.ts`.

---

### A3. Centralize scroll container DOM access

**Files**: New constant in `src/lib/dom-utils.ts`, update `src/components/pdf-canvas.tsx`, `src/hooks/use-keyboard-shortcuts.ts`, `src/hooks/use-zoom.ts`, `src/components/ruler.tsx`

The magic string `[data-pdf-scroll-container]` is queried in **7+ locations**. If the attribute name changes, they all break silently.

**Do**:
1. In `src/lib/dom-utils.ts`, add:
   ```typescript
   export const SCROLL_CONTAINER_ATTR = "data-pdf-scroll-container";
   export function getScrollContainer(): HTMLElement | null {
     return document.querySelector<HTMLElement>(`[${SCROLL_CONTAINER_ATTR}]`);
   }
   ```
2. Replace all `document.querySelector<HTMLElement>("[data-pdf-scroll-container]")` calls with `getScrollContainer()`.
3. Update the JSX attribute `data-pdf-scroll-container` to use the constant (or keep as literal since it's a DOM attribute, but at least the query side is centralized).

---

### A4. Remove duplicate `snapToGrid` in ruler

**Files**: `src/components/ruler.tsx`, `src/lib/snap-engine.ts`

`snapToGrid` is defined identically in both files.

**Do**:
1. In `ruler.tsx`, remove the local `snapToGrid` function.
2. Import `snapToGrid` from `@/lib/snap-engine`.

---

### A5. Deduplicate `Rect` / `BoundingRect` types

**Files**: `src/lib/geometry.ts`, `src/lib/selection-geometry.ts`

Both define the same `{ x, y, width, height }` interface. `BoundingRect` is identical to `Rect`.

**Do**:
1. Remove `BoundingRect` from `selection-geometry.ts`.
2. Import `Rect` from `geometry.ts` and use it directly.
3. Update `computeBoundingRect` return type to `Rect | null`.

---

### A6. Extract `ActiveTool` type

**Files**: `src/stores/editor-store.ts`, `src/hooks/use-keyboard-shortcuts.ts`, `src/components/canvas-overlay.tsx`

The string union `"select" | "input" | "textarea" | "checkbox" | "radio"` is repeated in 4+ places.

**Do**:
1. Export from `src/lib/form-element-model.ts` (already the domain types module):
   ```typescript
   export type ActiveTool = "select" | "input" | "textarea" | "checkbox" | "radio";
   ```
2. Import and use in `editor-store.ts`, `use-keyboard-shortcuts.ts`, `canvas-overlay.tsx`.

---

## Work Package B: Editor Store Cleanup (Medium effort)

### B1. Extract shared reset state for `setPdf` / `clearPdf`

**File**: `src/stores/editor-store.ts`

`setPdf` and `clearPdf` set the same 10-field reset object (elements, selectedIds, clipboard, guides, etc.) and both call `temporal.clear()` + reset `_lastSavedElementsJson`.

**Do**:
1. Extract a shared constant:
   ```typescript
   const docResetFields = {
     elements: [] as FormElement[],
     selectedIds: new Set<string>(),
     clipboard: [] as FormElement[],
     guides: [] as GuideLine[],
     selectedGuideId: null as string | null,
     previewGuide: null as { orientation: "horizontal" | "vertical"; position: number } | null,
     dragLivePositions: new Map<string, { x: number; y: number; width: number; height: number }>(),
     activeTool: "select" as const,
   };
   ```
2. Spread it in both `setPdf` and `clearPdf`.
3. Extract the post-reset logic (temporal clear + markClean) into a shared helper.

---

### B2. Extract `cloneElementsWithNewIds` from paste/duplicate

**File**: `src/stores/editor-store.ts`

`pasteClipboard` and `duplicateSelection` share ~80% logic: iterate elements, `JSON.parse(JSON.stringify(el))`, generate new IDs, call `getUniqueName`, compute position offsets.

**Do**:
1. Extract a helper (can remain in the same file or move to `form-element-model.ts`):
   ```typescript
   function cloneElementsWithNewIds(
     source: FormElement[],
     existing: FormElement[],
     offsetFn: (el: FormElement, index: number) => { x: number; y: number; pageNumber?: number },
   ): { cloned: FormElement[]; newIds: Set<string> }
   ```
2. Rewrite `pasteClipboard` and `duplicateSelection` to use it.

---

### B3. Replace `JSON.parse(JSON.stringify(...))` with `structuredClone`

**File**: `src/stores/editor-store.ts` (4 occurrences)

The deep-clone pattern works but `structuredClone` is more correct (handles `undefined`, doesn't call `toString`) and is available in all modern runtimes.

**Do**:
1. Replace all 4 `JSON.parse(JSON.stringify(el))` with `structuredClone(el)`.

---

### B4. Add `selectEffectivePdfBytes` selector

**Files**: `src/stores/editor-store.ts`, `src/components/pdf-canvas.tsx`, `src/components/page-sidebar.tsx`

The pattern `s.renderPdfBytes ?? s.pdfBytes` appears in both `pdf-canvas.tsx` and `page-sidebar.tsx`, leaking the render-vs-source PDF abstraction.

**Do**:
1. Add to `editor-store.ts`:
   ```typescript
   export const selectEffectivePdfBytes = (s: EditorState) => s.renderPdfBytes ?? s.pdfBytes;
   ```
2. Use in both components: `useEditorStore(selectEffectivePdfBytes)`.

---

## Work Package C: Decompose `canvas-overlay.tsx` (High effort, high impact)

This is the single biggest improvement. `canvas-overlay.tsx` is **1811 lines** and handles 10+ concerns. It should be broken into focused modules.

### C1. Extract element drag + snap logic

**New file**: `src/hooks/use-element-drag.ts` (or `src/components/canvas-overlay/use-element-drag.ts`)

Move the `onDragStart`, `onDrag`, `onDragStop` callbacks and all associated refs (`dragStartPositions`, `draggingId`, `pendingToggleId`, `dragOffset`, `dragSnapCorrection`, `prevSnapRef`).

### C2. Extract element resize + snap logic

**New file**: `src/hooks/use-element-resize.ts`

Move the `onResize`, `onResizeStop` callbacks and associated refs (`resizingId`, `resizeHappenedRef`, `lastResizeSnap`, `resizeSnapCorrection`).

### C3. Extract marquee selection logic

**New file**: `src/hooks/use-marquee.ts`

Move the marquee state, `marqueeStartRef`, `isDraggingRef`, and the marquee hit-testing logic in `handleCanvasMouseUp`.

### C4. Extract element creation (draw + click) logic

**New file**: `src/hooks/use-element-creation.ts`

Move `drawStartRef`, `isDrawingRef`, `drawRect` state, and the click-to-create / draw-rect logic from `handleCanvasMouseDown`, `handleCanvasMouseMove`, `handleCanvasMouseUp`.

### C5. Extract guide line interaction logic

**New file**: `src/hooks/use-guide-drag.ts`

Move `draggingGuideIdRef` and the guide mousedown/drag logic (the imperative `document.addEventListener` pattern in the guide elements section).

### C6. Extract element overlay renderer

**New file**: `src/components/canvas-overlay/element-overlay.tsx`

Extract the `<Rnd>` element render loop. This is where `getElementStyleConfig(el)` is called 5x per element — fix that while extracting (compute once).

### C7. Extract snap guide line renderer

**New file**: `src/components/canvas-overlay/snap-guides-layer.tsx`

Move the `activeGuides` rendering logic (the `guideLineElements` block).

### C8. Extract draw preview renderer

**New file**: `src/components/canvas-overlay/draw-preview-layer.tsx`

Move the `drawRectStyle` computation and the draw-rect `<div>`.

**Note on approach**: Work packages C1-C5 can be done incrementally. Each extracted hook takes state/callbacks out of `CanvasOverlay`, reducing its size by ~200-300 lines each. C6-C8 are the final render decomposition. The main `CanvasOverlay` component should end up at ~200-300 lines, orchestrating the hooks and composing the sub-components.

---

## Work Package D: Minor Cleanups (Low effort)

### D1. Compute `getElementStyleConfig(el)` once per element

**File**: `src/components/canvas-overlay.tsx` (or the extracted element overlay after C6)

Inside the `elements.map()` loop, `getElementStyleConfig(el)` is called 5 times for the same element. Compute once at the top of each iteration.

---

### D2. Reuse page-layout logic in `getVisiblePage()`

**File**: `src/hooks/use-keyboard-shortcuts.ts`

The local `getVisiblePage()` function manually computes yOffset with TOP_PADDING + PAGE_GAP, duplicating what `computePageLayouts` + layout iteration does.

**Do**: Rewrite using `computePageLayouts` + find closest page center from layouts.

---

### D3. Fix incomplete German translations

**File**: `src/i18n/de.json`

Missing sections compared to `en.json`:
- `shortcuts` (entire section)
- `contextMenu` (entire section)

Also: `"undo"` and `"redo"` in `header` have keyboard shortcuts embedded in the label (`"Rückgängig (Strg+Z)"`) which is inconsistent with the English version. The shortcuts are already shown via `<ShortcutKbd>` components. Remove the parenthetical.

---

### D4. Remove hardcoded ruler-size coupling in App.tsx

**File**: `src/App.tsx`

```tsx
style={{ width: "calc(11rem + 36px)" }}
```

The `36px` matches `RULER_SIZE` from `ruler.tsx`. Import `RULER_SIZE` and use it:

```tsx
import { RULER_SIZE } from "@/components/ruler";
// ...
style={{ width: `calc(11rem + ${RULER_SIZE}px)` }}
```

---

## Dependency Graph

```
A1-A6  ── independent of each other, no dependencies
B1-B4  ── independent of each other, touch only editor-store + consumers
C1-C8  ── C1-C5 independent, C6-C8 can follow after any of them
D1-D4  ── independent of each other

C6 depends on A1 (if A1 not done, rebase the hasAnySnap calls)
D1 is obsoleted by C6 (if C6 is done, D1 is absorbed)
D2 is independent
```

## Recommended Agent Assignment

| Agent | Tasks | Rationale |
|-------|-------|-----------|
| Agent 1 | A1, A2, A3, A4, A5, A6 | All small extractions, no overlap |
| Agent 2 | B1, B2, B3, B4 | All editor-store internal cleanup |
| Agent 3 | C1 → C2 → C3 → C4 → C5 | Incremental decomposition, each reduces file size |
| Agent 4 | C6, C7, C8 + D1 | Final render extraction (after Agent 3) |
| Agent 5 | D2, D3, D4 | Minor cleanups |

Agents 1, 2, 3, 5 can run in parallel. Agent 4 should wait for Agent 3.

---

## Testing

Each task should pass `bun run test` and `bun run build` with no regressions. The existing test suite covers:
- `tests/lib/alignment.test.ts`
- `tests/lib/coordinates.test.ts`
- `tests/lib/form-element-model.test.ts`
- `tests/lib/geometry.test.ts`
- `tests/lib/pdf-export-engine.test.ts`
- `tests/lib/pdf-form-reader.test.ts`
- `tests/lib/pdf-loader.test.ts`
- `tests/lib/snap-engine.test.ts`
- `tests/app.test.tsx`

After extraction tasks, consider adding unit tests for newly extracted helpers (especially `hasAnySnap`, `isEditableElement`, `cloneElementsWithNewIds`).
