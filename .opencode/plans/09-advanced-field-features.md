# Plan: Advanced Field Features

**Goal**: Implement a set of new features for richer AcroForm field support, typography controls, visual styling, and live preview.

---

## Feature 1: Additional AcroForm Field Types (Dropdown, Button, Option List, Signature Placeholder)

### Feasibility: ✅ Partially Implementable

**What pdf-lib supports:**

| Field Type | pdf-lib API | Supported |
|---|---|---|
| **Dropdown** (Combo Box) | `form.createDropdown()` + `dropdown.setOptions()` + `dropdown.addToPage()` | ✅ Full |
| **Button** (Push Button) | `form.createButton()` + `button.addToPage('label', page, opts)` | ✅ Full |
| **Option List** (List Box) | `form.createOptionList()` + `optionList.setOptions()` + `optionList.addToPage()` | ✅ Full |
| **Signature** | `PDFSignature` class exists but pdf-lib explicitly states: *"does not currently provide any specialized APIs for creating digital signatures"* | ⚠️ Placeholder only |

**What this means:**
- **Dropdown, Button, Option List** are fully implementable. They follow the same pattern as existing `TextField` / `Checkbox` / `RadioGroup`.
- **Signature Block** can only be a visual placeholder rectangle on the canvas. pdf-lib cannot create actual digital signature fields with cryptographic signing. We can place a `/Sig` widget annotation manually via low-level pdf-lib dict operations (the field type exists in the spec), but it would be an empty placeholder that a PDF reader like Adobe Acrobat could later activate for signing. This is still useful for form layout purposes.

### Implementation

#### Phase 1: New domain types in `form-element-model.ts`

Add new interfaces:

```ts
export interface DropdownField {
  type: "dropdown";
  id: string;
  x: number; y: number; width: number; height: number;
  pageNumber: number;
  name: string;
  options: string[];          // available choices
  defaultValue: string;       // selected value
  fontSize: number;
  required: boolean;
  editable: boolean;          // allow custom text entry
}

export interface ButtonField {
  type: "button";
  id: string;
  x: number; y: number; width: number; height: number;
  pageNumber: number;
  name: string;
  label: string;              // button text
  fontSize: number;
}

export interface OptionListField {
  type: "optionlist";
  id: string;
  x: number; y: number; width: number; height: number;
  pageNumber: number;
  name: string;
  options: string[];
  defaultValue: string;
  fontSize: number;
  required: boolean;
}

export interface SignatureField {
  type: "signature";
  id: string;
  x: number; y: number; width: number; height: number;
  pageNumber: number;
  name: string;
}

export type FormElement =
  | TextField | Checkbox | RadioButton
  | DropdownField | ButtonField | OptionListField | SignatureField;
```

Add factory functions (`createDropdownField`, `createButtonField`, etc.) and type guards.

#### Phase 2: Export engine (`pdf-export-engine.ts`)

Add cases to the switch in the export loop:
- **Dropdown**: `form.createDropdown()`, `.setOptions()`, `.select()`, `.addToPage()` with `font`, `textColor`, `backgroundColor` options.
- **Button**: `form.createButton()`, `.addToPage(label, page, opts)`.
- **Option List**: `form.createOptionList()`, `.setOptions()`, `.addToPage()`.
- **Signature**: Manually construct a `/Sig` widget annotation via low-level pdf-lib `PDFDict` operations. The field widget appears as a rectangle; PDF readers will recognize it as a signature field.

#### Phase 3: Style config (`element-style-map.ts`)

Add style configs for each new type with distinct semantic colors (e.g., orange for dropdown, pink for button, teal for option list, gray for signature).

#### Phase 4: Store (`editor-store.ts`)

Extend `activeTool` type:
```ts
activeTool: "select" | "input" | "textarea" | "checkbox" | "radio"
  | "dropdown" | "button" | "optionlist" | "signature";
```

#### Phase 5: Toolbar (`floating-toolbar.tsx`) + shared constants

Add toolbar buttons for new field types. Register new tools in `CLICK_TOOLS` (signature, button) or `RECT_DRAW_TOOLS` (dropdown, option list).

#### Phase 6: Canvas overlay (`canvas-overlay.tsx`)

Add SVG icons for each new field type in the element render (similar to checkbox checkmark and radio circle):
- Dropdown: small triangle/chevron icon
- Button: outlined rectangle with text label
- Option List: stacked horizontal lines
- Signature: pen/signature squiggle icon

#### Phase 7: Properties panel (`properties-panel.tsx`)

Add `DropdownProperties`, `ButtonProperties`, `OptionListProperties`, `SignatureProperties` components with type-specific fields:
- Dropdown: name, options list (editable array), default selection, editable toggle, required
- Button: name, label text
- Option List: name, options list, default selection, required
- Signature: name only

#### Phase 8: AcroForm reader (`pdf-form-reader.ts`)

Extend `extractAcroFormFields()` to read `/Ch` (Choice → Dropdown/OptionList) and `/Btn` (Push Button) fields from existing PDFs. Signature fields (`/Sig`) should also be read as placeholder elements.

---

## Feature 2: Font Family for Input Fields / Textareas

### Feasibility: ✅ Implementable (with constraints)

**How it works in PDF / pdf-lib:**

1. **Standard 14 Fonts** — pdf-lib ships with `StandardFonts` enum (Helvetica, Courier, Times Roman + Bold/Italic/BoldItalic variants, Symbol, ZapfDingbats). These require no external files. Available via `pdfDoc.embedStandardFont(StandardFonts.Helvetica)`.

2. **Custom Fonts (TTF/OTF)** — pdf-lib supports `pdfDoc.embedFont(bytes)` for any TrueType/OpenType font. The font bytes must be available at export time. This means:
   - **Bundled fonts**: Ship a curated set of common fonts with the app (stored in Tauri's resource dir).
   - **User-loaded fonts**: User picks a `.ttf`/`.otf` file from their machine. Store the font bytes in the project state (or reference the path and re-read at export).
   - **Google Fonts**: Not directly embeddable from a URL. Would need to download the `.ttf`/`.otf` file at runtime and cache it. Feasible via `fetch()` + caching, but requires network access and a license check.

**Recommended approach:**
- **Phase A**: Standard Fonts selector (14 options, zero dependencies). This gives immediate value.
- **Phase B**: Local font file picker via Tauri dialog. User picks `.ttf`/`.otf`, bytes are stored alongside the element data. Most flexible, works offline.
- **Phase C** (optional, future): Google Fonts search. Would need an API integration (Google Fonts API or a bundled font list), font downloading, and caching. Lower priority because it requires network.

### Implementation

#### Phase A: Standard Fonts

1. **Model**: Add `fontFamily: string` to `TextField` (default `""` = Helvetica, pdf-lib default). Store the `StandardFonts` enum value (e.g., `"Courier"`).

2. **Properties panel**: Add a `<select>` dropdown under Typography section with all 14 standard fonts. Preview shows font name in the actual font face.

3. **Export engine**: In `addTextField()`, embed the selected standard font and pass it to `field.addToPage()` via `FieldAppearanceOptions.font`:
   ```ts
   const font = pdfDoc.embedStandardFont(StandardFonts[el.fontFamily]);
   field.addToPage(page, { ...opts, font });
   ```

4. **Canvas overlay**: The canvas preview doesn't need to render in the actual PDF font — it just shows a label. The font family is a data property applied at export time.

#### Phase B: Custom Local Fonts

1. **Font storage model**: Add to `TextField`:
   ```ts
   fontFamily: string;           // display name, e.g. "Ubuntu"
   fontDataId: string | null;    // reference into a font data store
   ```
   Create a new store slice or module `font-store.ts` that holds `Map<string, Uint8Array>` for loaded custom fonts.

2. **Font picker UI**: "Load Font..." button in properties panel that opens Tauri file dialog filtered to `.ttf,.otf,.woff2`. Selected file bytes are loaded, stored in font-store, and the font name is displayed.

3. **Export engine**: For custom fonts, use `await pdfDoc.embedFont(fontBytes)` and pass the resulting `PDFFont` to `addToPage()`.

4. **Project serialization**: Font bytes need to be included in project saves (or referenced by path). Base64 encoding in the project JSON is the simplest approach but increases file size. Alternatively, save fonts as separate files alongside the project.

---

## Feature 3: Text Color, Font Weight, Bold/Italic/Underline (Advanced Typography Settings)

### Feasibility: ✅ Mostly Implementable (with caveats)

| Property | PDF/AcroForm Support | pdf-lib Support | Notes |
|---|---|---|---|
| **Text Color** | ✅ `/DA` string with `rg`/`g` operators | ✅ `FieldAppearanceOptions.textColor` with `rgb()` | Full support |
| **Font Weight (Bold)** | ✅ Use Bold variant of font family | ✅ `StandardFonts.HelveticaBold`, etc. | Bold is a separate font, not a toggle |
| **Italic** | ✅ Use Oblique/Italic variant | ✅ `StandardFonts.HelveticaOblique`, etc. | Same — separate font |
| **Underline** | ⚠️ Not a standard AcroForm property | ❌ No built-in support | Not supported in PDF form fields |
| **Bold + Italic** | ✅ BoldOblique variants | ✅ `StandardFonts.HelveticaBoldOblique` | Works for standard fonts |

**Underline is NOT supported** for AcroForm text fields. The PDF specification does not have an underline flag for form fields. Underline can only be achieved by drawing a line in the appearance stream manually (custom appearance provider), which is complex and fragile across PDF readers.

**Bold and Italic are font variants, not boolean flags.** The UI should present them as toggles that map to the appropriate font variant:
- Regular → `Helvetica`
- Bold → `HelveticaBold`
- Italic → `HelveticaOblique`
- Bold Italic → `HelveticaBoldOblique`

For custom fonts, the user would need to load the specific bold/italic font file separately.

### Implementation

1. **Model additions to `TextField`**:
   ```ts
   textColor: string;        // hex color, default "#000000"
   fontWeight: "regular" | "bold" | "italic" | "bold-italic";  // maps to font variant
   ```

2. **Properties panel**: Add "Advanced Typography" collapsible section:
   - **Text Color**: Color picker (native `<input type="color">` styled to match dark theme).
   - **Style toggles**: Bold / Italic button group (like a rich text toolbar). The combination determines the font variant.
   - Underline is **not included** — explain in UI tooltip or docs.

3. **Export engine**: Map `fontWeight` to `StandardFonts` variant:
   ```ts
   const fontMap = {
     regular: StandardFonts.Helvetica,
     bold: StandardFonts.HelveticaBold,
     italic: StandardFonts.HelveticaOblique,
     "bold-italic": StandardFonts.HelveticaBoldOblique,
   };
   // Same pattern for Courier, Times Roman families
   ```
   Pass `textColor` as `rgb(r, g, b)` to `FieldAppearanceOptions.textColor`.

4. **Canvas overlay**: The element border/bg color on canvas can hint at text color, but exact text color rendering isn't necessary for the overlay (it's a placement tool, not a WYSIWYG renderer).

---

## Feature 4: Border Radius, Background Color, Shadow Styling for AcroForm Fields

### Feasibility: ⚠️ Severely Limited

| Property | PDF/AcroForm Support | pdf-lib Support | Notes |
|---|---|---|---|
| **Background Color** | ✅ `/DA` or widget `/MK` dict `BG` entry | ✅ `FieldAppearanceOptions.backgroundColor` with `rgb()` | Full support |
| **Border Color** | ✅ Widget `/MK` dict `BC` entry | ✅ `FieldAppearanceOptions.borderColor` | Full support |
| **Border Width** | ✅ Widget `/BS` dict `W` entry | ✅ `FieldAppearanceOptions.borderWidth` | Full support |
| **Border Radius** | ❌ Not a standard AcroForm property | ❌ Not supported | No concept of rounded corners in PDF widget annotations |
| **Shadow** | ❌ Not supported in AcroForm fields | ❌ Not supported | PDF has no box-shadow equivalent for form fields |

**Border Radius and Shadow are NOT possible in the PDF AcroForm specification.** Form field widgets are rectangular annotations. While you could theoretically draw a custom appearance stream with rounded corners, this would break in most PDF readers which generate their own appearances. It's not reliable.

**What IS possible:**
- Background color (fill)
- Border color
- Border width (1–3px typical)
- Border style (solid, dashed, etc.) via `/BS` dict — pdf-lib doesn't expose this directly but it can be set via low-level dict access

### Implementation (for supported properties only)

1. **Model additions to `TextField`**:
   ```ts
   backgroundColor: string | null;  // hex color, null = transparent
   borderColor: string | null;      // hex color
   borderWidth: number;             // 0 = no border
   ```

2. **Properties panel**: "Appearance" section with:
   - Background color picker (with "None" option)
   - Border color picker
   - Border width slider (0–5)

3. **Export engine**: Pass these to `FieldAppearanceOptions`:
   ```ts
   field.addToPage(page, {
     ...positionOpts,
     backgroundColor: el.backgroundColor ? hexToRgb(el.backgroundColor) : undefined,
     borderColor: el.borderColor ? hexToRgb(el.borderColor) : undefined,
     borderWidth: el.borderWidth,
     font: selectedFont,
     textColor: hexToRgb(el.textColor),
   });
   ```

4. **Border radius and shadow**: Not implemented. If desired in the future, these could be *canvas-only* visual hints (not exported to PDF) but this would be misleading to users.

---

## Feature 5: Radio Button Different Fills (Star, Emoji, etc.)

### Feasibility: ⚠️ Severely Limited

**PDF AcroForm Radio Button specification:**
- Radio buttons use an **appearance stream** (a Form XObject) for the "on" and "off" states.
- The `/AP` dict contains `/N` (normal), `/R` (rollover), `/D` (down) entries, each with `/Yes` (on) and `/Off` (off) streams.
- By default, PDF readers render radio buttons as circles with a filled dot.

**What can be changed:**
- The **appearance stream** can be replaced with any custom drawing. pdf-lib supports this via `updateOnOffWidgetAppearance()`.
- You could draw a star, checkmark, X, or any vector shape inside the appearance stream using pdf-lib's drawing operators.

**What CANNOT be changed:**
- **Emojis**: Not possible. PDF appearance streams are vector drawings (PostScript-like operators). They cannot render arbitrary Unicode characters or emoji glyphs unless the emoji is embedded as a custom font glyph, which is extremely complex and unreliable.
- The appearance is only reliably shown in readers that respect custom appearance streams (Adobe Acrobat does; some lightweight readers generate their own appearances and ignore custom ones).

### Implementation (for vector shapes only)

1. **Model addition to `RadioButton`**:
   ```ts
   fillStyle: "circle" | "checkmark" | "cross" | "star" | "diamond";
   ```

2. **Custom appearance provider**: Use pdf-lib's drawing operators (`drawCircle`, `drawLine`, `drawPolygon`) to create custom "on" state appearances for each shape:
   ```ts
   // Example: star shape
   const { drawPage } = pdfDoc.embedPage(...);
   // Or use low-level PDFOperator to draw vector paths
   ```

3. **Properties panel**: "Fill Style" dropdown for radio buttons showing the available shapes.

4. **Canvas overlay**: Update the SVG icon rendered for radio buttons to match the selected fill style.

**Emojis are excluded.** The UI should make clear that only geometric shape fills are available.

---

## Feature 6: Live Preview of Textarea / Input Styling

### Feasibility: ✅ Fully Implementable

The current canvas overlay already renders elements as positioned `<div>` elements via `react-rnd`. The "live preview" means styling these overlay elements to visually approximate how the final PDF field will look.

**What can be previewed on canvas:**
- ✅ Font size (already affects element height for single-line inputs)
- ✅ Background color, border color, border width (CSS on the overlay div)
- ✅ Text color (CSS on the overlay div)
- ✅ Default value text rendered inside the element
- ✅ Font family (if it's a web-safe font or loaded as a CSS `@font-face`)
- ✅ Multiline appearance

**What cannot be accurately previewed:**
- Exact font rendering differences between web and PDF
- Bold/Italic (requires having the web font variant loaded)
- Exact pixel-perfect alignment with how PDF readers render the field

### Implementation

1. **Extend the element overlay render** in `canvas-overlay.tsx`:

   Currently, text fields render a plain `<div>` with border styling. Replace with a richer preview:

   ```tsx
   {el.type === "text" && (
     <div
       className="h-full w-full flex items-start px-1 overflow-hidden"
       style={{
         fontSize: `${el.fontSize * zoom * 0.7}px`,  // scaled for visual approximation
         color: el.textColor ?? 'currentColor',
         fontFamily: fontFamilyToCss(el.fontFamily),
         backgroundColor: el.backgroundColor ?? undefined,
         borderColor: el.borderColor ?? undefined,
         borderWidth: el.borderWidth ? `${el.borderWidth}px` : undefined,
       }}
     >
       {el.defaultValue && (
         <span className="opacity-50 truncate">{el.defaultValue}</span>
       )}
     </div>
   )}
   ```

2. **CSS font mapping**: Create a utility `fontFamilyToCss()` that maps `StandardFonts` names to CSS equivalents:
   ```ts
   const STANDARD_TO_CSS: Record<string, string> = {
     "Helvetica": "Helvetica, Arial, sans-serif",
     "Courier": '"Courier New", Courier, monospace',
     "Times-Roman": '"Times New Roman", Times, serif',
     // Bold/Italic variants inherit the family
   };
   ```

3. **Custom font preview**: For locally loaded fonts, inject a `@font-face` rule into the document when a custom font is loaded. This enables accurate preview in the canvas overlay.

4. **Combine with Features 2–4**: As new styling properties are added to the model, the overlay rendering should read and apply them. This naturally creates the live preview experience.

5. **Performance**: The overlay already re-renders on element changes via Zustand selectors. No additional optimization needed — CSS style changes are cheap.

---

## Implementation Order

Recommended sequence based on dependencies and value:

| Step | Feature | Effort | Dependencies |
|---|---|---|---|
| 1 | **Feature 6: Live Preview** (foundation) | Small | None — just enhances existing canvas overlay rendering |
| 2 | **Feature 3: Text Color + Bold/Italic** | Medium | Feature 6 for preview; uses existing pdf-lib `textColor`/`font` options |
| 3 | **Feature 4: Background Color + Border** (supported only) | Medium | Feature 6 for preview; uses existing pdf-lib appearance options |
| 4 | **Feature 2 Phase A: Standard Fonts** | Medium | Feature 3 for font variant mapping |
| 5 | **Feature 1: New Field Types** (Dropdown, Button, Option List, Signature) | Large | Independent of typography features |
| 6 | **Feature 2 Phase B: Custom Local Fonts** | Medium | Feature 2 Phase A; needs Tauri file dialog integration |
| 7 | **Feature 5: Radio Fill Shapes** | Medium | Low-level pdf-lib appearance stream manipulation |

---

## Summary of Limitations

| Feature | Limitation | Reason |
|---|---|---|
| Signature Field | Cannot perform actual digital signing | pdf-lib has no signing API; field is a placeholder only |
| Underline | Not available | Not a property of PDF AcroForm text fields |
| Border Radius | Not available | PDF widget annotations are always rectangular |
| Shadow | Not available | No shadow concept in PDF form field widgets |
| Radio Emoji Fills | Not available | PDF appearance streams are vector drawings, cannot render emoji |
| Google Fonts | Requires network | Would need runtime download + cache of `.ttf` files |
| Exact WYSIWYG Preview | Approximation only | Web font rendering ≠ PDF reader rendering |
