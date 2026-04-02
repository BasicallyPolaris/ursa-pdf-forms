# Plan: Unsaved Changes Protection + State Reset

**Goal**: When opening a new PDF (via dialog, Ctrl+O, or drag-drop), check for unsaved changes and ask the user. Also ensure state fully resets so old form elements don't persist. Add window close protection.

**Dependencies**: This plan overlaps heavily with Plans 01 and 02. The `setPdf` fix is listed in all three. Implement the common changes once.

---

## Phase 1: Fix State Reset on New PDF (Bug Fix)

### Modify: `src/stores/editor-store.ts`

**`setPdf` action** — currently only sets 4 fields. Must reset all editing state:

```typescript
setPdf: (fileName, bytes, pages) => {
  set({
    pdfFileName: fileName,
    pdfBytes: bytes,
    pages,
    isLoadingPdf: false,
    elements: [],
    selectedIds: new Set<string>(),
    clipboard: [],
    guides: [],
    selectedGuideId: null,
    previewGuide: null,
    dragLivePositions: new Map(),
    activeTool: "select",
  });
  useEditorStore.temporal.getState().clear();
},
```

**`clearPdf` action** — same comprehensive reset:
```typescript
clearPdf: () => {
  set({
    pdfFileName: null,
    pdfBytes: null,
    pages: [],
    elements: [],
    selectedIds: new Set<string>(),
    clipboard: [],
    guides: [],
    selectedGuideId: null,
    previewGuide: null,
    dragLivePositions: new Map(),
    activeTool: "select",
  });
  useEditorStore.temporal.getState().clear();
},
```

**Also add** `setInitialElements` for AcroForm reader integration (see Plan 01).

---

## Phase 2: Add Dirty State Tracking

### Modify: `src/stores/editor-store.ts`

Add module-level functions (NOT store state, to avoid polluting undo history):

```typescript
let _lastSavedElementsJson: string = "[]";
let _lastSavedGuidesJson: string = "[]";

export function isDirty(): boolean {
  const state = useEditorStore.getState();
  if (!state.pdfBytes) return false;
  return (
    JSON.stringify(state.elements) !== _lastSavedElementsJson ||
    JSON.stringify(state.guides) !== _lastSavedGuidesJson
  );
}

export function markClean(): void {
  const state = useEditorStore.getState();
  _lastSavedElementsJson = JSON.stringify(state.elements);
  _lastSavedGuidesJson = JSON.stringify(state.guides);
}
```

Call `markClean()` after:
- Successful PDF export in `src/lib/export-pdf.ts`
- `setPdf` / `setInitialElements` (loading a new PDF is the new "clean" baseline)

---

## Phase 3: Create Unsaved Changes Guard

### New file: `src/lib/unsaved-guard.ts`

Or add to `src/lib/file-operations.ts` — whichever fits the codebase pattern better.

```typescript
import { ask } from "@tauri-apps/plugin-dialog";
import { isDirty, markClean } from "@/stores/editor-store";
import { exportPdf } from "@/lib/export-pdf";

export type UnsavedAction = "save" | "discard" | "cancel";

export async function confirmUnsavedChanges(): Promise<UnsavedAction> {
  if (!isDirty()) return "discard";

  const result = await ask(t("dialog.unsavedChanges"), {
    title: t("dialog.unsavedTitle"),
    kind: "warning",
    okLabel: t("dialog.save"),
    cancelLabel: t("dialog.discard"),
  });

  if (result) {
    await exportPdf();
    markClean();
    return "save";
  }
  return "discard";
}
```

**Note on Tauri dialog API**: The `ask()` function returns a boolean. For a 3-way dialog (Save / Discard / Cancel), use `message()` with custom buttons if available, or simplify to a 2-way dialog. Check Tauri v2 plugin-dialog API for exact capabilities. If 3-way isn't supported, use:
- `ask("Save changes before opening a new file?")` → Yes = save + proceed, No = discard + proceed
- User cannot cancel the operation (acceptable for V1)

**For 3-way dialog** (if Tauri supports it via `message()`):
```typescript
const result = await message(t("dialog.unsavedChanges"), {
  title: t("dialog.unsavedTitle"),
  kind: "warning",
  buttons: { yes: "Save", no: "Don't Save", cancel: "Cancel" },
});
// result: 'yes' | 'no' | 'cancel'
```

---

## Phase 4: Integrate Guard into Entry Points

### Modify: `src/lib/file-operations.ts` — `openPdfFile()`

```typescript
export async function openPdfFile(): Promise<string | null> {
  const action = await confirmUnsavedChanges();
  if (action === "cancel") return null;
  // ... existing dialog + readFile + loadPdfIntoStore logic
}
```

### Modify: `src/hooks/use-file-drop.ts`

```typescript
// Inside drop handler:
const action = await confirmUnsavedChanges();
if (action === "cancel") return;
// ... existing loadPdfIntoStore logic
```

### Modify: `src/App.tsx` (or new hook) — Window close protection

```typescript
import { getCurrentWindow } from "@tauri-apps/api/window";

useEffect(() => {
  const unlisten = getCurrentWindow().onCloseRequested(async (event) => {
    if (isDirty()) {
      const action = await confirmUnsavedChanges();
      if (action === "cancel") {
        event.preventDefault();
      }
    }
  });
  return () => { unlisten.then(fn => fn()); };
}, []);
```

---

## Phase 5: Add Tauri Capabilities

### Modify: `src-tauri/capabilities/default.json`

Add to permissions array:
```json
"dialog:allow-ask",
"dialog:allow-message"
```

Check what's already granted and only add what's missing.

---

## Phase 6: Add i18n Keys

### `src/i18n/en.json`
```json
"dialog.unsavedTitle": "Unsaved Changes",
"dialog.unsavedChanges": "You have unsaved changes. Save before continuing?",
"dialog.save": "Save",
"dialog.discard": "Don't Save",
"dialog.cancel": "Cancel"
```

### `src/i18n/de.json`
```json
"dialog.unsavedTitle": "Ungespeicherte Änderungen",
"dialog.unsavedChanges": "Sie haben ungespeicherte Änderungen. Speichern bevor Sie fortfahren?",
"dialog.save": "Speichern",
"dialog.discard": "Nicht speichern",
"dialog.cancel": "Abbrechen"
```

---

## Files Changed Summary

| File | Change |
|------|--------|
| `src/stores/editor-store.ts` | Fix `setPdf`/`clearPdf` reset, add `isDirty`/`markClean` |
| `src/lib/file-operations.ts` | Add guard to `openPdfFile` |
| `src/hooks/use-file-drop.ts` | Add guard to drop handler |
| `src/App.tsx` | Add window close protection |
| `src-tauri/capabilities/default.json` | Add dialog permissions |
| `src/i18n/en.json` | Add dialog translation keys |
| `src/i18n/de.json` | Add German translations |

---

## Cross-Plan Dependencies

- **Plan 01** (AcroForm): `setPdf` fix is shared. `setInitialElements` calls `markClean()`.
- **Plan 02** (Undo/Redo): `temporal.getState().clear()` is shared. Do it once in `setPdf`.
- **Plan 04** (Drag-drop indicator): `use-file-drop.ts` changes overlap. Coordinate drag-over state with unsaved guard.

**Recommended order**: Fix `setPdf` + temporal clearing first (shared), then add dirty tracking, then integrate guard.

---

## Implementation Order

1. Fix `setPdf` / `clearPdf` state reset + temporal clearing (shared with Plans 01, 02)
2. Add `isDirty` / `markClean` to editor store
3. Create unsaved changes guard
4. Add guard to `openPdfFile` and drop handler
5. Add window close protection
6. Add Tauri capabilities
7. Add i18n keys
8. Test all 3 entry points (Open button, Ctrl+O, drag-drop) + window close
