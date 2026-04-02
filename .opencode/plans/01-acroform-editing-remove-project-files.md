# Plan: AcroForm Editing + Remove Project Files

**Goal**: Read existing AcroForm fields from PDFs on load, edit them like any other element, and export. Remove project file (.pfm) system entirely — the workflow becomes Open PDF → Edit → Export.

---

## Phase 1: Create AcroForm Reader

### New file: `src/lib/pdf-form-reader.ts`

Pure function module (no store dependency). Uses `pdf-lib` (already installed).

**Export**: `extractAcroFormFields(pdfBytes: Uint8Array): Promise<FormElement[]>`

**Mapping logic**:

| PDF Field Type | FT | Maps To | Extract |
|---|---|---|---|
| Text | `/Tx` | `TextField` | name, rect→position, defaultValue, fontSize (from `/DA`), multiline (flags), required (flags), maxLength (`/MaxLen`) |
| Checkbox | `/Btn` (toggle) | `Checkbox` | name, rect→position, defaultChecked |
| Radio | `/Btn` (radio) | `RadioButton` | groupName (field name), rect→position per widget, value (export value), label |
| Push button | `/Btn` (neither) | *Skip* | Log warning |
| Choice | `/Ch` | *Skip* | Log warning |
| Signature | `/Sig` | *Skip* | Log warning |

**Coordinate transform** (PDF rect `[x1, y1, x2, y2]` bottom-left → app top-left):
```
x = x1
y = pageHeight - y2
width = x2 - x1
height = y2 - y1
```

**Page number determination**: Match each widget's `/P` reference against the PDF page tree. Iterate pages, check `/Annots` arrays.

**Font size extraction**: Parse default appearance string (`/DA`) like `/Helv 12 Tf 0 g`. Extract number before `Tf`. If `0 Tf`, treat as auto-sized (use default 12).

**Widget handling**: One `FormElement` per widget. A text field with 2 widgets produces 2 `TextField` elements sharing the same `name`.

**Tests**: `tests/lib/pdf-form-reader.test.ts` — create test PDFs with known fields, verify extraction.

---

## Phase 2: Integrate into Load Flow

### Modify: `src/lib/file-operations.ts`

Update `loadPdfIntoStore`:
1. Set loading flag
2. Load PDF (quick)
3. Set PDF in store (via modified `setPdf` that clears all editing state)
4. **NEW**: `extractAcroFormFields(pdfBytes)` → `FormElement[]`
5. **NEW**: If elements found, add them to store via new `setInitialElements()` action
6. Background: refine page dimensions

---

## Phase 3: Fix Store Reset on New PDF

### Modify: `src/stores/editor-store.ts`

**Fix `setPdf`** — currently only sets 4 fields. Must clear all editing state:
```typescript
setPdf: (fileName, bytes, pages) => {
  set({
    pdfFileName: fileName, pdfBytes: bytes, pages, isLoadingPdf: false,
    elements: [], selectedIds: new Set<string>(), clipboard: [],
    guides: [], selectedGuideId: null, previewGuide: null,
    dragLivePositions: new Map(), activeTool: "select",
  });
  useEditorStore.temporal.getState().clear();
},
```

**Add `setInitialElements` action** — batch-sets elements without creating undo entry (these are the "original" state):
```typescript
setInitialElements: (elements: FormElement[]) => {
  set({ elements });
  useEditorStore.temporal.getState().clear();
},
```

**Fix `clearPdf`** similarly — clear all editing state + temporal history.

---

## Phase 4: Remove Project File Support

### Delete: `src/lib/project-file-io.ts`
### Delete: `tests/lib/project-file-io.test.ts`

### Modify: `src/lib/file-operations.ts`
- Delete `saveProjectFile()` function
- Delete `openProjectFile()` function
- Remove imports: `serializeProject`, `parseProject` from `./project-file-io`
- Remove `save` import from `@tauri-apps/plugin-dialog` (check if still needed)
- Keep: `openPdfFile()`, `loadPdfIntoStore()`, `extractFileName()`

### Modify: `src/components/app-header.tsx`
- Remove Save button (the second Tooltip block in the left group)
- Remove `saveProjectFile` import
- Remove `Save` icon import from lucide
- Result: header is `[Open]` ... zoom ... `[Undo] [Redo] | [Export]`

### Modify: `src/hooks/use-keyboard-shortcuts.ts`
- Remove `Ctrl+S` handler block
- Remove `saveProjectFile` import

### Modify: `src/lib/shortcuts.ts`
- Remove `{ id: "save", ... }` shortcut definition
- Remove `"save"` from `ShortcutId` type

### Modify: `src/i18n/en.json` — Remove keys:
- `header.save`, `header.saveProject`
- `file.projectFilter`, `file.defaultProjectName`
- `file.saveFailed`, `file.projectOpenFailed`, `file.invalidProject`
- `shortcuts.save`

### Modify: `src/i18n/de.json` — Same removals

---

## Files Changed Summary

| Action | File |
|--------|------|
| **Create** | `src/lib/pdf-form-reader.ts` |
| **Create** | `tests/lib/pdf-form-reader.test.ts` |
| **Modify** | `src/stores/editor-store.ts` |
| **Modify** | `src/lib/file-operations.ts` |
| **Modify** | `src/components/app-header.tsx` |
| **Modify** | `src/hooks/use-keyboard-shortcuts.ts` |
| **Modify** | `src/lib/shortcuts.ts` |
| **Modify** | `src/i18n/en.json` |
| **Modify** | `src/i18n/de.json` |
| **Delete** | `src/lib/project-file-io.ts` |
| **Delete** | `tests/lib/project-file-io.test.ts` |

---

## Implementation Order

1. Fix `setPdf` state reset (Phase 3) — fixes the confirmed bug regardless
2. Create `pdf-form-reader.ts` (Phase 1) with tests
3. Integrate reader into `loadPdfIntoStore` (Phase 2)
4. Remove project file support (Phase 4) — clean up UI
5. Run `bun run test` and `bun run build` to verify
