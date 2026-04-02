# PDF Rendering Fix Plan

## Problem Statement

Three categories of issues after migrating to virtualized rendering:

1. **Text renders as boxes/bounding boxes** — PDFs don't show real characters
2. **Large PDFs (200+ pages) are slow/laggy** — unusable due to lag
3. **Pages flash/re-render during scroll** — visible flicker, weird scrolling

---

## Root Cause Analysis

### P0: Boxes instead of text characters

**File**: `src/lib/pdf-worker.ts:40`

The Web Worker's `getDocument()` call has no font resource configuration:

```typescript
doc = await pdfjsLib.getDocument({ data: new Uint8Array(msg.data) }).promise;
```

pdfjs-dist requires two external resource directories to render text correctly:

1. **CMap data** (`cMapUrl` + `cMapDataPacked`): Maps character IDs to Unicode. Required for Identity-H encoded fonts, CJK fonts, and many embedded fonts. Without it, character code → glyph mapping fails → empty/box glyphs.
2. **Standard font data** (`standardFontDataUrl`): Glyph outlines for the 14 standard PDF fonts (Helvetica, Courier, Times, Symbol, ZapfDingbats). Without it, pdfjs can't draw the character shapes → bounding boxes.

Additionally, `GlobalWorkerOptions.workerSrc` is set *inside* the worker file (`pdf-worker.ts:3-6`). This is a main-thread configuration — inside the worker it's a no-op. Vite bundles the worker via `new URL()` which creates a blob URL, breaking relative path resolution.

The same issue exists in the fallback path (`src/lib/pdf-loader.ts:100`).

### P1: Large PDFs are slow/laggy

**Four compounding problems:**

1. **All pages loaded at once** (`pdf-worker.ts:42-49`): `Promise.all` over all 200+ pages creates all page proxies concurrently, allocating memory for every page's resources before any rendering starts. Blocks the worker.

2. **Layout recomputed on every scroll** (`pdf-canvas.tsx:41`): `syncVisiblePages()` calls `computePageLayouts()` which iterates ALL pages and creates a new `Map` every time. Called ~60x/sec during scrolling.

3. **O(n) visibility scan** (`page-layout.ts:40-45`): Linear scan through all layouts. Pages are sorted by Y, so binary search would be O(log n).

4. **Zoom effect re-triggers on visiblePages change** (`pdf-canvas.tsx:156-193`): The effect depends on `visiblePages`, so every scroll that changes the visible set applies CSS scaling to all canvases and restarts the rasterize timer — even though zoom hasn't changed.

### P1/P2: Pages flash during scroll

1. **Canvases destroyed on scroll-out** (`pdf-canvas.tsx:124-133`): When a page leaves the visible set, its canvas is removed and discarded. Re-entry requires a full worker render → blank during delay → flash.

2. **Small 800px buffer** (`page-layout.ts:35`): ~1 page height at standard zoom. During moderate scrolling, pages rapidly enter/leave the set, causing constant canvas creation/destruction.

---

## Implementation Plan

### Phase 1: Fix text rendering (P0)

#### 1a. Remove incorrect GlobalWorkerOptions from worker

**File**: `src/lib/pdf-worker.ts`

- Remove lines 3-6 (`GlobalWorkerOptions.workerSrc = ...`)
- This is a main-thread setting; inside the worker it does nothing and may cause confusion

#### 1b. Configure font resources in worker's getDocument()

**File**: `src/lib/pdf-worker.ts`

Change the `getDocument()` call to:

```typescript
doc = await pdfjsLib.getDocument({
  data: new Uint8Array(msg.data),
  cMapUrl: "/cmaps/",
  cMapDataPacked: true,
  standardFontDataUrl: "/standard_fonts/",
  useSystemFonts: true,
}).promise;
```

These paths reference `/cmaps/` and `/standard_fonts/` which will be served from the `public/` directory in dev and built output.

#### 1c. Configure font resources in fallback path

**File**: `src/lib/pdf-loader.ts`

Apply the same configuration to the `loadFallback()` function's `getDocument()` call.

#### 1d. Create asset copy script

**New file**: `scripts/copy-pdf-assets.mjs`

Copy required static assets from `pdfjs-dist` to `public/`:
- `node_modules/pdfjs-dist/cmaps/` → `public/cmaps/`
- `node_modules/pdfjs-dist/standard_fonts/` → `public/standard_fonts/`

Uses Node.js `fs.cpSync()` (available in Node 16.7+). Skips if directories already exist and are non-empty (idempotent).

#### 1e. Add postinstall hook

**File**: `package.json`

Add to scripts:
```json
"postinstall": "node scripts/copy-pdf-assets.mjs"
```

#### 1f. Update .gitignore

Add:
```
public/cmaps/
public/standard_fonts/
```

These are generated files, not source.

---

### Phase 2: Fix scroll performance (P1)

#### 2a. Batch page info loading in worker

**File**: `src/lib/pdf-worker.ts`

Replace `Promise.all` over all pages with batched processing (batch size 20). This reduces peak memory allocation and returns page infos incrementally so the main thread can start rendering sooner.

```typescript
const BATCH = 20;
const infos: PageInfoResult[] = [];
for (let i = 0; i < doc.numPages; i += BATCH) {
  const batch = Array.from(
    { length: Math.min(BATCH, doc.numPages - i) },
    (_, j) => {
      const pageNum = i + j + 1;
      return doc!.getPage(pageNum).then((p) => {
        const vp = p.getViewport({ scale: 1 });
        return { width: vp.width, height: vp.height, pageNumber: pageNum };
      });
    },
  );
  infos.push(...(await Promise.all(batch)));
}
```

#### 2b. Cache layout computation in PdfCanvas

**File**: `src/components/pdf-canvas.tsx`

Add a `layoutCacheRef` that stores `{ zoom, containerWidth, layouts }`. In `syncVisiblePages()`:
- If `zoom` and `containerWidth` match the cache, reuse the cached `layouts` Map
- Otherwise, call `computePageLayouts()` and update the cache

This eliminates the O(n) recomputation on every scroll event. Layouts only change when zoom or container size changes.

```typescript
const layoutCacheRef = useRef<{ zoom: number; width: number; layouts: Map<number, PageLayout> } | null>(null);

// In syncVisiblePages:
const scrollEl = getScrollContainer();
if (!scrollEl || pages.length === 0) return;

const cache = layoutCacheRef.current;
let layouts: Map<number, PageLayout>;
if (cache && cache.zoom === zoomRef.current && cache.width === scrollEl.clientWidth) {
  layouts = cache.layouts;
} else {
  layouts = computePageLayouts(pages, zoomRef.current, scrollEl.clientWidth);
  layoutCacheRef.current = { zoom: zoomRef.current, width: scrollEl.clientWidth, layouts };
}
```

#### 2c. Separate zoom effect from visiblePages dependency

**File**: `src/components/pdf-canvas.tsx`

The zoom `useEffect` (line 156) currently depends on `[zoom, visiblePages, renderPageToCanvas]`. The `visiblePages` dependency causes it to re-run on every scroll change.

Fix:
- Use a `visiblePagesRef` that always holds the current visible set
- Remove `visiblePages` from the effect's dependency array
- Read `visiblePagesRef.current` inside the timer callback

```typescript
const visiblePagesRef = useRef(visiblePages);
visiblePagesRef.current = visiblePages;

useEffect(() => {
  // ... CSS scaling logic (only depends on zoom) ...

  rasterizeTimerRef.current = setTimeout(() => {
    if (!docRef.current) return;
    renderedZoomRef.current = zoomRef.current;
    for (const pageNum of visiblePagesRef.current) {
      renderPageToCanvas(pageNum, zoomRef.current);
    }
  }, RASTERIZE_DELAY);

  return () => { /* clearTimeout */ };
}, [zoom, renderPageToCanvas]); // visiblePages removed from deps
```

---

### Phase 3: Fix page flashing (P1/P2)

#### 3a. Cache rendered canvases instead of destroying

**File**: `src/components/pdf-canvas.tsx`

Currently the canvas management effect (line 120) removes canvases when pages leave the visible set. This causes re-rendering (and blank flash) when they re-enter.

Change:
- When a page leaves the visible set, detach the canvas from DOM but **keep it in canvasMap**
- When a page enters the visible set, check canvasMap first — if a canvas exists, just reattach it (instant, no re-render)
- Only create + render when no cached canvas exists

Add a secondary cleanup mechanism to limit memory: if canvasMap grows beyond a threshold (e.g., `visiblePages.size * 3`), evict the oldest entries that aren't in the visible set.

```typescript
useEffect(() => {
  const container = pagesRef.current;
  if (!container) return;

  // Detach canvases for pages that left visible set (but keep in cache)
  for (const [pageNum, canvas] of canvasMap.current) {
    if (!visiblePages.has(pageNum) && canvas.parentElement) {
      canvas.remove();
    }
  }

  // Attach or create canvases for newly visible pages
  for (const pageNum of visiblePages) {
    const existing = canvasMap.current.get(pageNum);
    const wrapper = container.querySelector<HTMLElement>(
      `[data-page-wrapper="${pageNum}"]`,
    );
    if (!wrapper) continue;

    if (existing) {
      // Reattach cached canvas
      if (!existing.parentElement) {
        wrapper.appendChild(existing);
      }
      continue;
    }

    // Create new canvas + render
    const canvas = document.createElement("canvas");
    canvas.draggable = false;
    canvas.style.display = "block";
    canvas.style.margin = "0 auto";
    (canvas.style as unknown as Record<string, string>).webkitUserDrag = "none";
    canvas.dataset.pageNumber = String(pageNum);
    wrapper.appendChild(canvas);
    canvasMap.current.set(pageNum, canvas);
    renderPageToCanvas(pageNum, zoomRef.current);
  }

  // Evict old entries if cache is too large
  const MAX_CACHED = visiblePages.size * 3 + 10;
  if (canvasMap.current.size > MAX_CACHED) {
    const toEvict: number[] = [];
    for (const [pageNum] of canvasMap.current) {
      if (!visiblePages.has(pageNum)) toEvict.push(pageNum);
      if (toEvict.length >= canvasMap.current.size - MAX_CACHED) break;
    }
    for (const pageNum of toEvict) {
      const canvas = canvasMap.current.get(pageNum);
      if (canvas) canvas.remove();
      canvasMap.current.delete(pageNum);
    }
  }
}, [visiblePages, renderPageToCanvas]);
```

#### 3b. Increase scroll buffer + early termination

**File**: `src/lib/page-layout.ts`

- Make buffer proportional to viewport height: `Math.max(800, Math.floor(viewportHeight * 2))`
- Add early loop termination since pages are sorted by Y: `break` when `yOffset > viewBottom`

```typescript
export function getVisiblePageNumbers(
  layouts: Map<number, PageLayout>,
  scrollTop: number,
  viewportHeight: number,
  bufferPx?: number,
): Set<number> {
  const buffer = bufferPx ?? Math.max(800, Math.floor(viewportHeight * 2));
  const visible = new Set<number>();
  const viewTop = scrollTop - buffer;
  const viewBottom = scrollTop + viewportHeight + buffer;
  for (const [pageNumber, layout] of layouts) {
    if (layout.yOffset > viewBottom) break; // early termination
    const pageBottom = layout.yOffset + layout.screenHeight;
    if (pageBottom >= viewTop) {
      visible.add(pageNumber);
    }
  }
  return visible;
}
```

---

## Files Modified Summary

| File | Type | Changes |
|------|------|---------|
| `src/lib/pdf-worker.ts` | Edit | Remove GlobalWorkerOptions, add font config, batch page loading |
| `src/lib/pdf-loader.ts` | Edit | Add font config to fallback getDocument() |
| `src/components/pdf-canvas.tsx` | Edit | Cache layouts, cache canvases, fix zoom effect deps |
| `src/lib/page-layout.ts` | Edit | Dynamic buffer, early loop termination |
| `scripts/copy-pdf-assets.mjs` | New | Copy pdfjs-dist static assets to public/ |
| `package.json` | Edit | Add postinstall script |
| `.gitignore` | Edit | Ignore generated asset dirs |

## Risk Assessment

- **Font asset paths**: The `/cmaps/` and `/standard_fonts/` paths work for Vite dev server and production builds (served from `public/`). For Tauri's custom protocol, these may need adjustment — Tauri serves from `tauri://localhost/` which maps to the dist directory. Since Vite copies `public/` to `dist/` during build, the paths should resolve correctly.
- **Canvas cache memory**: The eviction threshold (`visiblePages.size * 3 + 10`) limits memory growth while still providing smooth scrolling. For a document with 20 visible pages, ~70 canvases would be cached max.
- **Binary search opportunity**: Noted but deferred — the early `break` in the visibility scan provides most of the benefit for sorted data without the complexity of binary search on a Map iterator.

## Verification

1. `bun run build` — TypeScript compilation + Vite build must pass
2. `bun run test` — All existing tests pass
3. Manual test: Open a PDF with text → verify characters render (not boxes)
4. Manual test: Open a 200+ page PDF → verify smooth scrolling, no lag
5. Manual test: Scroll rapidly → verify no page flashing
