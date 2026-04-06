import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRef,
} from "pdf-lib";
import type { FormElement } from "./form-element-model";

export async function extractAcroFormFields(
  pdfBytes: Uint8Array,
): Promise<FormElement[]> {
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdf.getPages();
  const elements: FormElement[] = [];
  let nextId = 1;
  const generateId = () => `acro_${nextId++}_${Date.now().toString(36)}`;

  const acroForm = pdf.catalog.lookup(PDFName.of("AcroForm"));
  if (!(acroForm instanceof PDFDict)) return elements;

  const fieldsArray = acroForm.lookup(PDFName.of("Fields"));
  if (!(fieldsArray instanceof PDFArray)) return elements;

  const ctx = pdf.context;
  const pageRefToIndex = buildPageRefMap(pdf);

  for (let i = 0; i < fieldsArray.size(); i++) {
    const fieldRef = fieldsArray.get(i);
    const fieldDict = resolveDict(ctx, fieldRef);
    if (!fieldDict) continue;

    collectFields(
      ctx,
      fieldDict,
      pages,
      pageRefToIndex,
      generateId,
      elements,
      null,
    );
  }

  return elements;
}

function buildPageRefMap(pdf: PDFDocument): Map<string, number> {
  const map = new Map<string, number>();
  const pagesTree = pdf.catalog.lookup(PDFName.of("Pages"));
  if (!(pagesTree instanceof PDFDict)) return map;
  const kids = pagesTree.lookup(PDFName.of("Kids"));
  if (!(kids instanceof PDFArray)) return map;
  const ctx = pdf.context;
  let pageIndex = 1;
  function collectRefs(kidsArray: PDFArray): void {
    for (let i = 0; i < kidsArray.size(); i++) {
      const kidRef = kidsArray.get(i);
      const kidDict = resolveDict(ctx, kidRef);
      if (!kidDict) continue;
      const subKids = kidDict.lookup(PDFName.of("Kids"));
      if (subKids instanceof PDFArray) {
        collectRefs(subKids);
      } else if (kidRef instanceof PDFRef) {
        map.set(kidRef.toString(), pageIndex++);
      }
    }
  }
  collectRefs(kids);
  return map;
}

interface PDFPage {
  node: PDFDict;
  getSize(): { width: number; height: number };
}

type LookupCtx = { lookup: (ref: PDFRef) => unknown };

function collectFields(
  ctx: LookupCtx,
  fieldDict: PDFDict,
  pages: PDFPage[],
  pageRefToIndex: Map<string, number>,
  generateId: () => string,
  elements: FormElement[],
  parentPartialName: string | null,
): void {
  const kids = fieldDict.lookup(PDFName.of("Kids"));

  if (kids instanceof PDFArray && kids.size() > 0) {
    const ft = getInheritableAttr(fieldDict, PDFName.of("FT"), ctx);
    const parentName = getFieldName(fieldDict) ?? parentPartialName;

    if (ft === PDFName.of("Btn")) {
      const radio = isRadioField(fieldDict, ctx);
      if (radio) {
        collectRadioKids(
          ctx,
          fieldDict,
          kids,
          pages,
          pageRefToIndex,
          generateId,
          elements,
          parentName ?? "",
        );
        return;
      }
    }

    for (let i = 0; i < kids.size(); i++) {
      const kidRef = kids.get(i);
      const kidDict = resolveDict(ctx, kidRef);
      if (!kidDict) continue;
      collectFields(
        ctx,
        kidDict,
        pages,
        pageRefToIndex,
        generateId,
        elements,
        parentName,
      );
    }
    return;
  }

  const ft = getInheritableAttr(fieldDict, PDFName.of("FT"), ctx);
  if (!ft) return;

  const pageNumber = findWidgetPage(fieldDict, pageRefToIndex, ctx);
  if (pageNumber === null) return;

  const rect = getRect(fieldDict);
  if (!rect) return;

  const pageHeight = pages[pageNumber - 1].getSize().height;
  const x = rect.x1;
  const y = pageHeight - rect.y2;
  const width = rect.x2 - rect.x1;
  const height = rect.y2 - rect.y1;

  if (width <= 0 || height <= 0) return;

  if (ft === PDFName.of("Tx")) {
    elements.push(
      extractTextField(
        fieldDict,
        ctx,
        generateId(),
        x,
        y,
        width,
        height,
        pageNumber,
        parentPartialName,
      ),
    );
  } else if (ft === PDFName.of("Btn")) {
    if (isRadioField(fieldDict, ctx)) {
      const groupName = parentPartialName ?? "";
      const exportValue = getExportValue(fieldDict) ?? "";
      elements.push({
        type: "radio",
        id: generateId(),
        x,
        y,
        width,
        height,
        pageNumber,
        groupName,
        value: exportValue,
        label: "",
      });
    } else {
      const name = getFieldName(fieldDict) ?? parentPartialName ?? "";
      elements.push(
        extractCheckboxField(
          fieldDict,
          generateId(),
          x,
          y,
          width,
          height,
          pageNumber,
          name,
        ),
      );
    }
  }
}

function collectRadioKids(
  ctx: LookupCtx,
  parentDict: PDFDict,
  kids: PDFArray,
  pages: PDFPage[],
  pageRefToIndex: Map<string, number>,
  generateId: () => string,
  elements: FormElement[],
  groupName: string,
): void {
  const optValues = getOptValues(parentDict);

  for (let i = 0; i < kids.size(); i++) {
    const kidRef = kids.get(i);
    const kidDict = resolveDict(ctx, kidRef);
    if (!kidDict) continue;

    const pageNumber = findWidgetPage(kidDict, pageRefToIndex, ctx);
    if (pageNumber === null) continue;

    const rect = getRect(kidDict);
    if (!rect) continue;

    const pageHeight = pages[pageNumber - 1].getSize().height;
    const x = rect.x1;
    const y = pageHeight - rect.y2;
    const width = rect.x2 - rect.x1;
    const height = rect.y2 - rect.y1;

    if (width <= 0 || height <= 0) continue;

    const exportValue =
      optValues[i] ?? getExportValue(kidDict) ?? `Option${i + 1}`;

    elements.push({
      type: "radio",
      id: generateId(),
      x,
      y,
      width,
      height,
      pageNumber,
      groupName,
      value: exportValue,
      label: "",
    });
  }
}

function extractTextField(
  dict: PDFDict,
  ctx: LookupCtx,
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  pageNumber: number,
  parentName: string | null,
): FormElement {
  const name = getFieldName(dict) ?? parentName ?? "";
  const v = getInheritableAttr(dict, PDFName.of("V"), ctx);
  const defaultValue = tryAsString(v) ?? "";
  const da = getInheritableAttr(dict, PDFName.of("DA"), ctx);
  const daStr = tryAsString(da) ?? "";
  const fontSize = parseFontSizeFromDA(daStr);
  const flags = getInheritableAttr(dict, PDFName.of("Ff"), ctx);
  const flagNum = flags instanceof PDFNumber ? flags.asNumber() : 0;
  const multiline = (flagNum & (1 << 13)) !== 0;
  const required = (flagNum & (1 << 2)) !== 0;
  const maxLen = getInheritableAttr(dict, PDFName.of("MaxLen"), ctx);
  const maxLength = maxLen instanceof PDFNumber ? maxLen.asNumber() : undefined;

  return {
    type: "text",
    id,
    x,
    y,
    width,
    height,
    pageNumber,
    name,
    defaultValue,
    fontSize: fontSize > 0 ? fontSize : 12,
    multiline,
    required,
    maxLength,
  };
}

function extractCheckboxField(
  dict: PDFDict,
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  pageNumber: number,
  name: string,
): FormElement {
  const asValue = dict.lookup(PDFName.of("AS"));
  const defaultChecked =
    asValue instanceof PDFName && asValue !== PDFName.of("Off");

  return {
    type: "checkbox",
    id,
    x,
    y,
    width,
    height,
    pageNumber,
    name,
    defaultChecked,
  };
}

function tryAsString(val: unknown): string | null {
  if (val == null) return null;
  if (typeof (val as { decodeText?: unknown }).decodeText === "function") {
    try {
      return (val as { decodeText: () => string }).decodeText();
    } catch {
      return null;
    }
  }
  if (typeof (val as { asString?: unknown }).asString === "function") {
    try {
      return (val as { asString: () => string }).asString();
    } catch {
      return null;
    }
  }
  return null;
}

function getOptValues(dict: PDFDict): string[] {
  const opt = dict.lookup(PDFName.of("Opt"));
  if (!(opt instanceof PDFArray)) return [];
  const values: string[] = [];
  for (let i = 0; i < opt.size(); i++) {
    const val = opt.lookup(i);
    const str = tryAsString(val);
    if (str) values.push(str);
  }
  return values;
}

function getFieldName(dict: PDFDict): string | null {
  const t = dict.get(PDFName.of("T"));
  return tryAsString(t);
}

function getExportValue(dict: PDFDict): string | null {
  const ap = dict.lookup(PDFName.of("AP"));
  if (!(ap instanceof PDFDict)) return null;
  const n = ap.lookup(PDFName.of("N"));
  if (!(n instanceof PDFDict)) return null;
  const keys = n.entries();
  for (const [key] of keys) {
    if (key !== PDFName.of("Off")) {
      const str = tryAsString(key);
      return str ?? key.toString();
    }
  }
  return null;
}

function isRadioField(dict: PDFDict, ctx: LookupCtx): boolean {
  const flags = getInheritableAttr(dict, PDFName.of("Ff"), ctx);
  if (!(flags instanceof PDFNumber)) return false;
  const flagNum = flags.asNumber();
  return (flagNum & (1 << 15)) !== 0;
}

function parseFontSizeFromDA(da: string): number {
  const parts = da.split(/\s+/);
  const tfIdx = parts.indexOf("Tf");
  if (tfIdx >= 2) {
    const size = parseFloat(parts[tfIdx - 1]);
    if (Number.isFinite(size) && size > 0) return size;
  }
  return 0;
}

function getInheritableAttr(
  dict: PDFDict,
  name: PDFName,
  ctx: LookupCtx,
): unknown {
  let current: PDFDict | null = dict;
  while (current) {
    const val = current.get(name);
    if (val != null) return val;
    const parent = current.get(PDFName.of("Parent"));
    if (parent instanceof PDFRef) {
      const obj = ctx.lookup(parent);
      current = obj instanceof PDFDict ? obj : null;
    } else if (parent instanceof PDFDict) {
      current = parent;
    } else {
      break;
    }
  }
  return null;
}

interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function getRect(dict: PDFDict): Rect | null {
  const rectObj = dict.lookup(PDFName.of("Rect"));
  if (!(rectObj instanceof PDFArray) || rectObj.size() < 4) return null;
  const values: number[] = [];
  for (let i = 0; i < 4; i++) {
    const val = rectObj.lookup(i);
    if (val instanceof PDFNumber) {
      values.push(val.asNumber());
    } else {
      return null;
    }
  }
  return {
    x1: Math.min(values[0], values[2]),
    y1: Math.min(values[1], values[3]),
    x2: Math.max(values[0], values[2]),
    y2: Math.max(values[1], values[3]),
  };
}

function findWidgetPage(
  widgetDict: PDFDict,
  pageRefToIndex: Map<string, number>,
  ctx: LookupCtx,
): number | null {
  let current: PDFDict | null = widgetDict;
  while (current) {
    const p = current.get(PDFName.of("P"));
    if (p instanceof PDFRef) {
      const idx = pageRefToIndex.get(p.toString());
      if (idx !== undefined) return idx;
    }
    const parent = current.get(PDFName.of("Parent"));
    if (parent instanceof PDFRef) {
      const obj = ctx.lookup(parent);
      current = obj instanceof PDFDict ? obj : null;
    } else if (parent instanceof PDFDict) {
      current = parent;
    } else {
      break;
    }
  }
  return null;
}

function resolveDict(ctx: LookupCtx, ref: unknown): PDFDict | null {
  if (ref instanceof PDFDict) return ref;
  if (ref instanceof PDFRef) {
    try {
      const obj = ctx.lookup(ref);
      return obj instanceof PDFDict ? obj : null;
    } catch {
      return null;
    }
  }
  return null;
}
