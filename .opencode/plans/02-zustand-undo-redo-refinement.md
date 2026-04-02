# Plan: Zustand State & Undo/Redo Refinement

**Goal**: Fix critical undo/redo bugs, prevent history pollution, fix performance issues from bare store hooks, and add batch operations.

---

## Issue 1 (P0 — Bug): Undo history leaks across PDF loads

**File**: `src/stores/editor-store.ts`

**Problem**: `setPdf` does not clear the zundo temporal store. After loading PDF-B, Ctrl+Z restores elements from PDF-A.

**Fix**: Add `useEditorStore.temporal.getState().clear()` inside `setPdf` and `clearPdf` actions.

Also clear temporal in `setInitialElements` (if added for AcroForm reading).

---

## Issue 2 (P1 — Performance): Bare `useEditorStore()` in 3 components

These components re-render on **every** state change (selection, drag, zoom, etc.) despite only needing a few fields.

### Fix: `src/components/page-sidebar.tsx` (line 8)

```typescript
// Before:
const { pdfBytes, pages } = useEditorStore();

// After:
const pdfBytes = useEditorStore((s) => s.pdfBytes);
const pages = useEditorStore((s) => s.pages);
```

### Fix: `src/components/ruler.tsx` (line 26 — HorizontalRuler)

```typescript
// Before:
const { pages, zoom, pdfBytes } = useEditorStore();

// After:
const pages = useEditorStore((s) => s.pages);
const zoom = useEditorStore((s) => s.zoom);
const pdfBytes = useEditorStore((s) => s.pdfBytes);
```

### Fix: `src/components/ruler.tsx` (line 226 — VerticalRuler)

Same pattern as HorizontalRuler.

---

## Issue 3 (P1 — History Pollution): Guide drag floods undo

**File**: `src/components/canvas-overlay.tsx` (guide drag handler, ~lines 1078-1114)

**Problem**: `updateGuidePosition` is called on every `mousemove` during guide drag. Since `guides` is tracked by `partialize`, each call creates an undo entry. A single drag = dozens to hundreds of entries.

**Fix**: Restructure guide drag to match element drag pattern:
1. On `mousedown`: record guide's initial position
2. On `mousemove`: use `setPreviewGuide` (already NOT tracked) for live visual feedback, OR update guides via a direct `set()` with a `skipUndo` mechanism
3. On `mouseup`: call `updateGuidePosition` once for the final position

**Recommended approach**: Add a `_skipUndo` flag that the zundo `handleSet` option checks:

```typescript
// In editor-store.ts, add to zundo config:
{
  handleSet: (handleSetOrig) => {
    return (state) => {
      if (state._skipUndo) {
        handleSetOrig(state);
        return;
      }
      handleSetOrig(state);
    };
  }
}
```

During guide drag, use `useEditorStore.setState({ guides: updatedGuides, _skipUndo: true })`.

**Alternative (simpler)**: Use `previewGuide` during drag (already untracked), commit on mouseup.

---

## Issue 4 (P2 — History Pollution): Multi-element edits create N undo entries

**File**: `src/stores/editor-store.ts`, `src/components/properties-panel.tsx`

**Problem**: When batch-editing 5 elements (e.g., changing font size), `updateElement` is called 5 times in a loop, creating 5 undo entries.

**Fix**: Add `batchUpdateElements` action to store:

```typescript
batchUpdateElements: (updates: Array<{ id: string; changes: Partial<FormElement> }>) =>
  set((s) => ({
    elements: s.elements.map((el) => {
      const u = updates.find((u) => u.id === el.id);
      return u ? ({ ...el, ...u.changes } as FormElement) : el;
    }),
  })),
```

Then update `properties-panel.tsx` to use `batchUpdateElements` instead of loops of `updateElement` in:
- `MultiTextFieldProperties` (~line 393)
- `MultiPositionProperties` (~line 487)
- `MultiRadioProperties` (~line 445)

---

## Issue 5 (P3 — Minor): Arrow key nudges create many undo entries

**File**: `src/components/canvas-overlay.tsx` (~lines 389-448)

**Problem**: Each arrow press = one `moveElements` call = one undo entry. Holding a key creates many.

**Fix**: Add debouncing with a ref — accumulate nudge offsets, commit after 300ms idle:

```typescript
const nudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const pendingNudgesRef = useRef<Map<string, { dx: number; dy: number }>>(new Map());

// On arrow key:
// Accumulate nudge into pendingNudgesRef
// Reset timer
// On timer fire: commit all accumulated nudges as single moveElements call
```

---

## Issue 6 (P3 — UX): Selection state not cleaned after undo

**Problem**: After undo that removes elements, `selectedIds` may reference non-existent IDs. Properties panel shows stale data.

**Fix**: In the undo/redo functions, prune `selectedIds` to only include IDs present in the restored `elements`:

```typescript
export function undo() {
  const state = useEditorStore.getState();
  if (!state.pdfBytes) return;
  useEditorStore.temporal.getState().undo();
  // Prune stale selections after undo
  const elements = useEditorStore.getState().elements;
  const validIds = new Set(elements.map(e => e.id));
  const currentSelected = useEditorStore.getState().selectedIds;
  const pruned = new Set([...currentSelected].filter(id => validIds.has(id)));
  if (pruned.size !== currentSelected.size) {
    useEditorStore.setState({ selectedIds: pruned });
  }
}
```

Same for `redo()`.

---

## What NOT to undo (confirmed correct)

These are already excluded via `partialize`:
- `pdfFileName`, `pdfBytes`, `pages`, `isLoadingPdf` — document data
- `zoom` — viewport
- `activeTool` — tool selection
- `selectedIds` — selection state
- `clipboard` — clipboard
- `gridSize`, `previewGuide`, `selectedGuideId`, `dragLivePositions`, `visiblePageRange`

---

## Store Splitting: Not Recommended

The cross-store coupling is too high (actions like `cutSelection` read `selectedIds`, write to `clipboard`, `elements`, and `selectedIds`). Performance wins come from fixing 3 bare hooks, not from splitting. Revisit if codebase grows significantly.

---

## Files Changed Summary

| File | Change |
|------|--------|
| `src/stores/editor-store.ts` | Clear temporal on setPdf/clearPdf, add `batchUpdateElements`, prune selection after undo/redo |
| `src/components/page-sidebar.tsx` | Replace bare hook with individual selectors |
| `src/components/ruler.tsx` | Replace 2 bare hooks with individual selectors |
| `src/components/canvas-overlay.tsx` | Fix guide drag undo flooding, add nudge debouncing |

---

## Implementation Order

1. Fix temporal clearing on PDF load (Issue 1)
2. Fix bare hooks (Issue 2) — immediate performance win
3. Fix guide drag flooding (Issue 3)
4. Add `batchUpdateElements` + update properties panel (Issue 4)
5. Add nudge debouncing (Issue 5) — optional
6. Prune selection after undo/redo (Issue 6)
7. Run `bun run test`
