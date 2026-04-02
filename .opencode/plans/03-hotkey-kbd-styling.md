# Plan: Hotkey Preview Styling — KBD + KBD

**Goal**: Change keyboard shortcut display from `<Kbd>Ctrl+Z</Kbd>` to `<Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd>` — each key gets its own styled element, joined by a plain `+`.

---

## Current State

`formatShortcut()` in `shortcuts.ts` returns a single string like `"Ctrl+Z"`. Every consumer wraps it in one `<Kbd>`, rendering the `+` inside the styled element.

---

## Step 1: Add `formatShortcutParts()` to `src/lib/shortcuts.ts`

New function returning array of key strings:

```typescript
export function formatShortcutParts(id: ShortcutId): string[] {
  const s = shortcutMap.get(id);
  if (!s) return [];
  const parts: string[] = [];
  if (s.mod) parts.push(modSymbol);
  if (s.shift) parts.push(shiftSymbol);
  parts.push(s.key.length === 1 ? s.key.toUpperCase() : s.key);
  return parts;
}
```

Keep `formatShortcut()` as-is (used by canvas context menu for plain text).

---

## Step 2: Create `ShortcutKbd` component in `src/components/ui/kbd.tsx`

Add to the existing kbd file:

```tsx
export function ShortcutKbd({ shortcutId }: { shortcutId: ShortcutId }) {
  const parts = formatShortcutParts(shortcutId);
  if (parts.length === 0) return null;
  const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  return (
    <span className="inline-flex items-center gap-0.5">
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && !isMac && <span className="text-muted-foreground text-[10px]">+</span>}
          <Kbd>{part}</Kbd>
        </Fragment>
      ))}
    </span>
  );
}
```

On Mac: adjacent `<Kbd>` elements (no `+` separator — `⌘Z` convention).
On Windows/Linux: `<Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd>`.

Import `formatShortcutParts` and `ShortcutId` from `@/lib/shortcuts`.

---

## Step 3: Update consumers

### `src/components/shortcuts-dialog.tsx` (~line 65)

```tsx
// Before:
<Kbd>{formatShortcut(shortcut.id)}</Kbd>

// After:
<ShortcutKbd shortcutId={shortcut.id} />
```

### `src/components/floating-toolbar.tsx` (~lines 69-71)

```tsx
// Before:
<Kbd>{formatShortcut(TOOL_SHORTCUT_MAP[id] as ShortcutId)}</Kbd>

// After:
<ShortcutKbd shortcutId={TOOL_SHORTCUT_MAP[id] as ShortcutId} />
```

### `src/components/app-header.tsx` (7 occurrences — lines 52, 83, 109, 121, 137, 149, 163)

```tsx
// Before:
<Kbd>{formatShortcut("open")}</Kbd>

// After:
<ShortcutKbd shortcutId="open" />
```

Repeat for: `open`, `save`, `export`, `undo`, `redo`, `zoomOut`, `zoomIn`.

Note: `save` will be removed by the project files plan. If done first, only update the remaining 6.

Remove unused `formatShortcut` import from these 3 files.

### `src/components/status-bar.tsx` (hardcoded shortcuts)

```tsx
// Before:
<Kbd>Shift+Arrow</Kbd>

// After:
<Kbd>Shift</Kbd>+<Kbd>Arrow</Kbd>
```

Other lines (`<Kbd>Shift</Kbd>`, `<Kbd>Ctrl</Kbd>`, etc.) are already single keys — no change needed.

### `src/components/pdf-canvas.tsx` (hardcoded shortcuts)

```tsx
// Before:
<Kbd>Ctrl+O</Kbd>
<Kbd>Ctrl+Scroll</Kbd>

// After:
<Kbd>Ctrl</Kbd>+<Kbd>O</Kbd>
<Kbd>Ctrl</Kbd>+<Kbd>Scroll</Kbd>
```

### `src/components/canvas-context-menu.tsx` — **No change needed**

Uses plain text (no `<Kbd>` elements). `formatShortcut()` string output is correct.

---

## Files Changed Summary

| File | Change |
|------|--------|
| `src/lib/shortcuts.ts` | Add `formatShortcutParts()` |
| `src/components/ui/kbd.tsx` | Add `ShortcutKbd` component |
| `src/components/shortcuts-dialog.tsx` | Use `ShortcutKbd` |
| `src/components/floating-toolbar.tsx` | Use `ShortcutKbd` |
| `src/components/app-header.tsx` | Use `ShortcutKbd` (6-7 places) |
| `src/components/status-bar.tsx` | Fix `Shift+Arrow` hardcoded combo |
| `src/components/pdf-canvas.tsx` | Fix `Ctrl+O` and `Ctrl+Scroll` hardcoded combos |

---

## Implementation Order

1. Add `formatShortcutParts()` to `shortcuts.ts`
2. Add `ShortcutKbd` to `kbd.tsx`
3. Update all 5 consumer files
4. Run `bun run build` to verify no type errors
