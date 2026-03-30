# AGENTS.md

## Commands

- **Dev server**: `bun run dev`
- **Build**: `bun run build`
- **Tests**: `bun run test`

## Architecture Overview

This is a Tauri v2 desktop app (Rust shell + React/TypeScript frontend) for placing interactive form fields onto PDF documents and exporting them as fillable PDFs.

### Directory Structure

```
src/
  components/       — React components
  hooks/            — React hooks
  lib/              — Pure functions and domain logic (no store dependencies)
  stores/           — Zustand stores
tests/              — Test files mirroring src/ structure
  lib/              — Unit tests for lib/ modules
  app.test.tsx      — Integration tests for App component
  test-setup.ts     — Vitest setup (jest-dom matchers)
```

### Key Modules

- `src/stores/editor-store.ts` — Central Zustand store with undo/redo (zundo). All state flows through here. Re-exports `PageInfo` from `pdf-loader`.
- `src/lib/pdf-loader.ts` — Centralized PDF parsing with caching. Owns the `PageInfo` type. All PDF entry points call `loadPdfDocument()`.
- `src/lib/pdf-export-engine.ts` — Pure function: takes `(Uint8Array, FormElement[])` and returns modified PDF with AcroForm fields. No store dependency.
- `src/lib/form-element-model.ts` — Domain types (`TextField`, `Checkbox`, `RadioButton`), factory functions, type guards. Pure, no store dependency.
- `src/lib/coordinates.ts` — Pure coordinate transforms between PDF space and screen space. Owns `TOP_PADDING` and `PAGE_GAP` layout constants used by `CanvasOverlay`.
- `src/lib/project-file-io.ts` — JSON serialization/deserialization for `.pfm` project files. Pure.
- `src/lib/file-operations.ts` — Orchestrates Tauri dialog + fs for open/save operations. Exports `loadPdfIntoStore()` and `extractFileName()` shared helpers.
- `src/components/pdf-canvas.tsx` — Renders full-size PDF pages. Uses cached document from `pdf-loader`.
- `src/components/page-sidebar.tsx` — Page thumbnails in left sidebar. Uses cached document from `pdf-loader`.
- `src/components/canvas-overlay.tsx` — Form field positioning/drag/resize via `react-rnd`. Uses `coordinates.ts` for transforms. Integrates snap engine for grid/element/guide snapping during drag.
- `src/lib/snap-engine.ts` — Pure snap/alignment engine. `snapPosition()` composes grid, page-edge, element-to-element, and ruler-guide snapping. Returns snapped position + visual guide lines.
- `src/lib/alignment.ts` — Pure alignment functions: align left/right/top/bottom/center, distribute horizontally/vertically, center on page. Operates on positionable elements.
- `src/components/grid-overlay.tsx` — Renders grid dots on canvas. Reads grid settings from store.
- `src/components/ruler.tsx` — Horizontal and vertical rulers with PDF point tick marks. Drag from ruler to create guide lines.
- `src/components/properties-panel.tsx` — Right sidebar with type-specific property editors, multi-selection batch editing, and alignment tool buttons.

### State Flow

```
User action → loadPdfIntoStore(bytes, name) → loadPdfDocument(bytes) → setPdf(name, bytes, pageInfos)
  → PdfCanvas: gets cached PDFDocumentProxy, renders pages
  → PageSidebar: gets cached PDFDocumentProxy, renders thumbnails
  → CanvasOverlay: reads pages + elements, positions form fields via coordinates.ts
```

Pages are populated atomically with pdfBytes (no async feedback loop).

## Known Architectural Opportunities

These are areas identified during architecture review but not yet addressed. Future agents should consider these when working on related code.

### 1. File I/O & Persistence Boundary

**Modules**: `file-operations.ts`, `export-pdf.ts`, `project-file-io.ts`

These modules import Tauri dialog/fs plugins and reach into the global store via `getState()`. The shared `loadPdfIntoStore()` helper reduced duplication, but there is still no port/interface for the Tauri boundary.

**Dependency category**: Local-substitutable (Tauri plugins can be replaced with in-memory stand-ins)

**Proposed direction**: Define a persistence interface with methods like `pickAndLoadPdf()`, `saveProject()`, `exportPdf()`. Implement with Tauri plugins for production and in-memory adapters for testing. This would make file operations testable end-to-end.

### 2. Page Layout Sync

`CanvasOverlay` layout constants (`TOP_PADDING`, `PAGE_GAP`) in `coordinates.ts` must match `PdfCanvas`'s `p-4` padding and `gap-2` spacing. If `PdfCanvas` changes its gap/spacing, the overlay silently breaks. A shared layout module that both components query would eliminate this coupling.

## Code Conventions

- No comments in code unless explicitly requested.
- Use `@/` path aliases for imports.
- Pure functions in `lib/` with no store dependencies are preferred.
- Components read from store via `useEditorStore()` hook selector pattern; non-React code uses `useEditorStore.getState()`.
- Tests live in `tests/` mirroring the `src/` structure.

## Design Context

### Users
Office workers and administrators who need to make existing PDF documents fillable. They are not designers or developers — they want a straightforward tool to place form fields (text inputs, checkboxes, radio buttons) onto PDFs and export them as fillable forms. Task-driven: open a PDF, place fields quickly, export, move on. Speed, clarity, and reliability over advanced features.

### Brand Personality
**Clean, precise, professional.** A well-made instrument — minimal, purposeful, trustworthy. No unnecessary decoration. Voice is direct, helpful, unassuming. Plain language, no jargon.

### Aesthetic Direction
- **Dark mode only** (enforced via `.dark` class)
- **Canvas-focused**: PDF document dominates the viewport; UI chrome is compact and collapsible
- **Typography**: Geist Variable. text-xs for labels, text-sm for headings, monospace for numeric values
- **Color**: Neutral base (oklch, no hue) for structure. Semantic accents: blue=text input, green=checkbox, purple=radio, amber=multiline. Cyan for ruler guides, orange for snap lines
- **References**: Figma (canvas editing, snap guides, compact property panels). Anti-reference: cluttered enterprise software, old-school PDF tools

### Design Principles
1. **Canvas first**: PDF document dominates. UI chrome is compact and collapsible, never competing for attention.
2. **Efficient interactions**: Fewest possible steps. Prefer direct manipulation over multi-step workflows. Discoverable keyboard shortcuts.
3. **Precision without complexity**: Exact positioning (snap, grid, numeric inputs) without requiring users to understand PDF coordinates. Optional and unobtrusive.
4. **Calm restraint**: Color used sparingly for semantic coding. No gradients, shadows, animations, or decoration. Quiet and purposeful.
5. **Accessible by default**: WCAG AA contrast. Keyboard-navigable. Visible focus states.
