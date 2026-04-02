# Plan: Drag-and-Drop PDF Visual Indicator

**Goal**: Show a visual overlay when a user drags a PDF file over the application window, indicating it's a valid drop target.

---

## Current State

`src/hooks/use-file-drop.ts` only handles the `drop` event. It ignores `enter`, `over`, and `leave` events from Tauri's drag-drop API. There is **zero visual feedback** during file drag.

---

## Step 1: Add drag-over state to editor store

**File**: `src/stores/editor-store.ts`

Add to state interface and initial state:

```typescript
isFileDragOver: false,
```

Add action:

```typescript
setFileDragOver: (value: boolean) => set({ isFileDragOver: value }),
```

This is ephemeral UI state — NOT tracked by zundo (already excluded via `partialize`).

---

## Step 2: Extend `use-file-drop.ts` to track drag-over

**File**: `src/hooks/use-file-drop.ts`

Current: only handles `type === "drop"`.

New: Also handle drag-over and drag-leave events from Tauri's `onDragDropEvent`.

The Tauri v2 `DragDropEvent` type has these variants:
- `{ type: "over", position: {x, y}, paths: string[] }` — hovering with files
- `{ type: "drop", position: {x, y}, paths: string[] }` — files dropped
- `{ type: "leave" }` — drag left the window

```typescript
// Inside the onDragDropEvent callback:
if (event.type === "over") {
  const hasPdf = event.paths?.some((p: string) => p.toLowerCase().endsWith(".pdf"));
  if (hasPdf) {
    store.setFileDragOver(true);
  }
  return;
}

if (event.type === "leave") {
  store.setFileDragOver(false);
  return;
}

if (event.type === "drop") {
  store.setFileDragOver(false);
  // ... existing drop logic
}
```

Verify the exact event type names from `@tauri-apps/api` type definitions before implementing.

---

## Step 3: Add drop overlay to App.tsx

**File**: `src/App.tsx`

Add inside the `<main>` element (which already has `relative` positioning), before the closing `</main>` tag:

```tsx
{isFileDragOver && (
  <div className="absolute inset-0 z-[60] flex items-center justify-center bg-background/60 backdrop-blur-[2px] pointer-events-none animate-in fade-in-0 duration-150">
    <div className="flex flex-col items-center gap-3 text-muted-foreground">
      <FileDown className="h-12 w-12" />
      <p className="text-sm font-medium">
        {pdfBytes ? t("canvas.dropToReplace") : t("canvas.dropToOpen")}
      </p>
    </div>
  </div>
)}
```

- `z-[60]` sits above all canvas overlays (z-50) but below context menu (z-[9999])
- `pointer-events-none` prevents the overlay from interfering with the drop target
- Uses existing `tw-animate-css` for fade-in animation (same pattern as dialog backdrop)
- Shows different text depending on whether a PDF is already loaded

Add selector for `isFileDragOver`:
```typescript
const isFileDragOver = useEditorStore((s) => s.isFileDragOver);
```

Import `FileDown` icon from lucide-react.

---

## Step 4: Add i18n keys

**File**: `src/i18n/en.json`

```json
"canvas.dropToOpen": "Drop PDF to open",
"canvas.dropToReplace": "Drop PDF to replace current document"
```

**File**: `src/i18n/de.json`

```json
"canvas.dropToOpen": "PDF zum Öffnen ablegen",
"canvas.dropToReplace": "PDF ablegen, um aktuelles Dokument zu ersetzen"
```

---

## Design Considerations

- **Empty state (no PDF loaded)**: The overlay augments the existing empty state, making the drop target more obvious
- **PDF loaded**: A subtle overlay (60% background + blur) that doesn't fully obscure the document but clearly indicates the drop zone
- The overlay is `pointer-events-none` so it doesn't block the Tauri drop event handler
- Animation uses existing `tw-animate-css` utilities — no new dependencies

---

## Files Changed Summary

| File | Change |
|------|--------|
| `src/stores/editor-store.ts` | Add `isFileDragOver` state + `setFileDragOver` action |
| `src/hooks/use-file-drop.ts` | Handle `over`/`leave` events, set drag-over state |
| `src/App.tsx` | Add drop overlay JSX + selector |
| `src/i18n/en.json` | Add `canvas.dropToOpen`, `canvas.dropToReplace` |
| `src/i18n/de.json` | Add German translations |

---

## Implementation Order

1. Add state to editor store
2. Update `use-file-drop.ts` (verify Tauri event type names first)
3. Add overlay to `App.tsx`
4. Add i18n keys
5. Test by dragging a PDF file over the app window
