# Core Editing Features Plan (Issues #9--#15)

## Status: Issues #7 and #8 -- COMPLETE

Both verified and ready to close.

## Dependency Graph

```
#12 (Selection) ← foundation for everything
  ├→ #11 (Properties panel)
  ├→ #13 (Copy/paste/delete/undo-redo)
  ├→ #15 (Zoom controls)
  └→ #14 (Multi-element editing) ← also needs #11

#9 (Checkbox) ← needs properties panel (#11)
  └→ #10 (Radio button) ← needs checkbox pattern (#9)
```

## User Requirements (additional from conversation)

- **Auto-increment names on paste**: When copy/pasting, element `name` fields must be auto-incremented to avoid PDF field name collisions. Internal `id` already unique via counter+timestamp. Users can manually change names in properties panel later.
- **Preserve spacing on paste**: Offset entire group uniformly (+10pt x, +10pt) so relative positions between pasted elements are maintained.
- **Auto-select pasted elements**: All pasted elements become the new selection, enabling immediate group repositioning.
- **Group drag**: When multiple elements are selected and one is dragged, all selected elements move by the same delta.
- **Visual differentiation**: Multiline text fields should look visually different from single-line (taller default, corner grip, etc.).

---

## Phase 1: Selection System (#12)

### Store changes (`editor-store.ts`)
- Extend `activeTool` type: `"select" | "text" | "checkbox" | "radio"` (prepare for later phases)
- Add `toggleInSelection(id: string)` action for shift-click
- Add `addToSelection(ids: string[])` action for marquee
- No new state needed -- `selectedIds`, `selectElements`, `clearSelection` already exist

### New utility (`src/lib/geometry.ts`)
- `rectsOverlap(a, b): boolean` -- pure function for marquee hit testing
- `getElementBounds(el): {x, y, width, height}` -- normalized bounds

### `canvas-overlay.tsx` changes
1. **Click-to-select**: On `Rnd` mousedown (not drag), if shift held, toggle element in selection; otherwise select only that element
2. **Click empty space**: On overlay click (not on element), `clearSelection()`
3. **Visual selection state**: Selected elements get bright border + ring; unselected get muted border
4. **Marquee selection**: On mousedown on empty canvas + drag, draw dashed rectangle. On mouseup, find elements on current page whose bounds overlap the marquee rect
5. **Ctrl+A**: Keydown handler selects all elements on current page
6. **Group drag**: When dragging a selected element, compute delta and apply to all selected elements simultaneously

### Current page detection
Use scroll position + page layouts to determine which page center is in viewport.

### Tests
- `tests/lib/geometry.test.ts` -- rectsOverlap unit tests

---

## Phase 2: Properties Panel (#11)

### ShadCN setup (one-time)
- Create `src/lib/utils.ts` with `cn()` (clsx + tailwind-merge)
- Generate components: `input`, `label`, `switch`, `separator`, `scroll-area`

### New component (`src/components/properties-panel.tsx`)
- Reads `selectedIds` from store, finds selected element(s)
- Nothing selected: "No selection" placeholder
- TextField: name, defaultValue, fontSize, multiline, required, maxLength
- All inputs call `updateElement(id, { prop: value })` on change
- Visual differentiation: multiline fields show taller overlay in canvas

### `App.tsx` changes
- Replace empty `<aside>` with `<PropertiesPanel />`

### Tests
- `tests/components/properties-panel.test.tsx` -- renders for text field, updates store

---

## Phase 3: Copy/Paste + Delete + Undo/Redo (#13)

### Store changes (`editor-store.ts`)
- Add `clipboard: FormElement[]` state (not tracked by zundo)
- Add `copySelection()`: deep clone selected elements to clipboard
- Add `pasteClipboard()`: paste with +10pt offset, auto-increment names, auto-select pasted elements
- Expose `undo()` / `redo()` from zundo temporal store

### Name auto-increment logic (`src/lib/form-element-model.ts`)
- Add `getUniqueName(baseName: string, existingElements: FormElement[]): string`
- Parses trailing number from name (e.g., `text_3` → base `text_`, num `3`)
- Finds next available number (e.g., if `text_3` and `text_4` exist → `text_5`)
- If no trailing number, appends `_2`
- Used during paste to prevent field name collisions

### New hook (`src/hooks/use-keyboard-shortcuts.ts`)
- Ctrl+C → `copySelection()`
- Ctrl+V → `pasteClipboard()`
- Delete/Backspace → `removeElements([...selectedIds])`
- Ctrl+Z → `undo()`
- Ctrl+Y / Ctrl+Shift+Z → `redo()`
- Escape → `clearSelection()`

### `App.tsx` changes
- Render `useKeyboardShortcuts` hook
- Add undo/redo buttons to toolbar, disabled based on history state

### Paste behavior
- All elements offset uniformly (+10pt x, +10pt) preserving relative spacing
- All pasted elements auto-selected for immediate group repositioning
- Names auto-incremented to avoid collisions
- New IDs generated for each element

### Tests
- `tests/stores/editor-store.test.ts` -- copy/paste/delete state transitions, undo/redo
- `tests/lib/form-element-model.test.ts` -- getUniqueName tests

---

## Phase 4: Zoom Controls (#15)

### New hook (`src/hooks/use-zoom.ts`)
- Ctrl+Scroll: zoom in 10% steps, clamped 50%--400%
- Ctrl+0: fit-to-width (page width / viewport width)
- Ctrl+1: reset to 100%
- Maintain scroll position relative to viewport center during zoom

### `App.tsx` changes
- Zoom dropdown/presets in toolbar: 50%, 75%, 100%, 150%, 200%, 400%
- Fit-to-width button

### No changes needed
- `canvas-overlay.tsx` -- already zoom-aware
- `pdf-canvas.tsx` -- already re-renders on zoom change

### Tests
- `tests/hooks/use-zoom.test.ts` -- zoom clamping, fit-to-width calculation

---

## Phase 5: Checkbox Element (#9)

### `form-element-model.ts` changes
- Add `Checkbox` interface: type, id, x, y, width, height, pageNumber, name, defaultChecked
- Extend `FormElement = TextField | Checkbox`
- `createCheckbox(opts)` factory (default 15x15)
- `isCheckbox(el)` type guard

### Store changes
- `activeTool` already extended in Phase 1

### `canvas-overlay.tsx` changes
- Handle `activeTool === "checkbox"` click-to-place
- Render checkbox overlay: square with checkmark indicator (green border)

### `pdf-export-engine.ts` changes
- Add `case "checkbox"`: `form.createCheckBox(name)`, position with Y-inversion, set checked

### `properties-panel.tsx` changes
- Checkbox properties: name, defaultChecked toggle

### `App.tsx` changes
- Add "Checkbox" tool button

### Tests
- `tests/lib/form-element-model.test.ts` -- checkbox factory, type guard
- `tests/lib/pdf-export-engine.test.ts` -- checkbox export verification

---

## Phase 6: Radio Button Element (#10)

### `form-element-model.ts` changes
- Add `RadioButton` interface: type, id, x, y, width, height, pageNumber, groupName, value, label
- Extend `FormElement = TextField | Checkbox | RadioButton`
- `createRadioButton(opts)` factory (default 15x15)
- `isRadioButton(el)` type guard

### `canvas-overlay.tsx` changes
- Handle `activeTool === "radio"` click-to-place
- Render radio overlay: circle with dot indicator, show group name + label

### `pdf-export-engine.ts` changes
- Group radio buttons by `groupName` before export
- For each group: create radio group, add options with positions
- Most complex export logic -- careful PDFDict construction

### `properties-panel.tsx` changes
- Radio properties: groupName, value, label

### `App.tsx` changes
- Add "Radio" tool button

### Tests
- `tests/lib/form-element-model.test.ts` -- radio factory, type guard
- `tests/lib/pdf-export-engine.test.ts` -- radio group export, mutual exclusivity

---

## Phase 7: Multi-Element Property Editing (#14)

### `properties-panel.tsx` changes
- Multiple elements selected, same type: show shared fields with indeterminate state for differing values
- Multiple elements selected, mixed types: show only common fields or "Mixed selection" message
- "(N selected)" indicator in panel header
- Changes apply to ALL selected elements via batch update
- Radio buttons: groupName field available when multiple radios selected

### Tests
- `tests/components/properties-panel.test.tsx` -- multi-select rendering, batch update

---

## Phase Parallelism

Phases 3 and 4 are independent of each other (can be done in parallel).
Phase 5 can start as soon as Phase 2 is complete.
Phase 4 can start as soon as Phase 1 is complete (or even in parallel).
