import {
  type FormElement,
  isHeightLockedField,
  MAX_FIELD_NAME_LENGTH,
  MAX_OPTIONS_PER_FIELD,
} from "@/lib/form-element-model";
import type { PageInfo } from "@/lib/pdf-loader";

export const FORM_FIELDS_FILE_VERSION = 1;

export interface FormFieldsPageSnapshot {
  width: number;
  height: number;
}

export interface FormFieldsDocument {
  version: number;
  pages: FormFieldsPageSnapshot[];
  fields: FormElement[];
}

const FIELD_TYPES = new Set([
  "text",
  "checkbox",
  "radio",
  "dropdown",
  "button",
  "optionlist",
]);

const FONT_WEIGHTS = new Set(["regular", "bold", "italic", "bold-italic"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readFiniteNumber(
  obj: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value = obj[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return value;
}

function readString(obj: Record<string, unknown>, key: string, fallback = ""): string {
  const value = obj[key];
  return typeof value === "string" ? value : fallback;
}

function readBoolean(obj: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = obj[key];
  return typeof value === "boolean" ? value : fallback;
}

function readStringArray(obj: Record<string, unknown>, key: string): string[] {
  const value = obj[key];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .slice(0, MAX_OPTIONS_PER_FIELD);
}

function readNullableColor(obj: Record<string, unknown>, key: string): string | null {
  const value = obj[key];
  if (value === null) return null;
  return typeof value === "string" ? value : null;
}

type FontWeight = "regular" | "bold" | "italic" | "bold-italic";

function readFontWeight(obj: Record<string, unknown>): FontWeight {
  const fontWeight = readString(obj, "fontWeight", "regular");
  return FONT_WEIGHTS.has(fontWeight) ? (fontWeight as FontWeight) : "regular";
}

function sanitizeTypography(obj: Record<string, unknown>) {
  return {
    fontFamily: readString(obj, "fontFamily", "Helvetica"),
    fontWeight: readFontWeight(obj),
    textColor: readString(obj, "textColor", "#000000"),
    backgroundColor: readNullableColor(obj, "backgroundColor"),
    borderColor: readNullableColor(obj, "borderColor"),
    borderWidth: Math.max(0, readFiniteNumber(obj, "borderWidth", 1)),
  };
}

function parseField(raw: unknown): FormElement | null {
  if (!isRecord(raw)) return null;
  const type = raw.type;
  if (typeof type !== "string" || !FIELD_TYPES.has(type)) return null;

  const x = readFiniteNumber(raw, "x", 0);
  const y = readFiniteNumber(raw, "y", 0);
  const width = readFiniteNumber(raw, "width", 1);
  const height = readFiniteNumber(raw, "height", 1);
  const pageNumber = Math.max(1, Math.floor(readFiniteNumber(raw, "pageNumber", 1)));

  if (type === "text") {
    return {
      type: "text",
      id: readString(raw, "id", ""),
      x,
      y,
      width,
      height,
      pageNumber,
      name: readString(raw, "name").slice(0, MAX_FIELD_NAME_LENGTH),
      defaultValue: readString(raw, "defaultValue"),
      fontSize: readFiniteNumber(raw, "fontSize", 12),
      multiline: readBoolean(raw, "multiline", false),
      required: readBoolean(raw, "required", false),
      maxLength:
        raw.maxLength === undefined || raw.maxLength === null
          ? undefined
          : Math.max(0, readFiniteNumber(raw, "maxLength", 0)),
      ...sanitizeTypography(raw),
    };
  }

  if (type === "checkbox") {
    return {
      type: "checkbox",
      id: readString(raw, "id", ""),
      x,
      y,
      width,
      height,
      pageNumber,
      name: readString(raw, "name").slice(0, MAX_FIELD_NAME_LENGTH),
      defaultChecked: readBoolean(raw, "defaultChecked", false),
    };
  }

  if (type === "radio") {
    return {
      type: "radio",
      id: readString(raw, "id", ""),
      x,
      y,
      width,
      height,
      pageNumber,
      groupName: readString(raw, "groupName").slice(0, MAX_FIELD_NAME_LENGTH),
      value: readString(raw, "value"),
      label: readString(raw, "label"),
    };
  }

  if (type === "dropdown") {
    return {
      type: "dropdown",
      id: readString(raw, "id", ""),
      x,
      y,
      width,
      height,
      pageNumber,
      name: readString(raw, "name").slice(0, MAX_FIELD_NAME_LENGTH),
      options: readStringArray(raw, "options"),
      defaultValue: readString(raw, "defaultValue"),
      fontSize: readFiniteNumber(raw, "fontSize", 12),
      required: readBoolean(raw, "required", false),
      editable: readBoolean(raw, "editable", false),
      ...sanitizeTypography(raw),
    };
  }

  if (type === "button") {
    return {
      type: "button",
      id: readString(raw, "id", ""),
      x,
      y,
      width,
      height,
      pageNumber,
      name: readString(raw, "name").slice(0, MAX_FIELD_NAME_LENGTH),
      label: readString(raw, "label", "Button"),
      fontSize: readFiniteNumber(raw, "fontSize", 12),
      ...sanitizeTypography(raw),
    };
  }

  return {
    type: "optionlist",
    id: readString(raw, "id", ""),
    x,
    y,
    width,
    height,
    pageNumber,
    name: readString(raw, "name").slice(0, MAX_FIELD_NAME_LENGTH),
    options: readStringArray(raw, "options"),
    defaultValue: readString(raw, "defaultValue"),
    fontSize: readFiniteNumber(raw, "fontSize", 12),
    required: readBoolean(raw, "required", false),
    ...sanitizeTypography(raw),
  };
}

export function pageSnapshotsFromPages(pages: PageInfo[]): FormFieldsPageSnapshot[] {
  return pages.map((p) => ({ width: p.width, height: p.height }));
}

export function serializeFormFields(
  fields: FormElement[],
  pages: PageInfo[],
): string {
  const document: FormFieldsDocument = {
    version: FORM_FIELDS_FILE_VERSION,
    pages: pageSnapshotsFromPages(pages),
    fields,
  };
  return JSON.stringify(document, null, 2);
}

export function parseFormFieldsJson(text: string): FormFieldsDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("invalidJson");
  }
  if (!isRecord(parsed)) throw new Error("invalidFormat");

  const version = parsed.version;
  if (version !== FORM_FIELDS_FILE_VERSION) throw new Error("unsupportedVersion");

  const pagesRaw = parsed.pages;
  const pages: FormFieldsPageSnapshot[] = [];
  if (Array.isArray(pagesRaw)) {
    for (const page of pagesRaw) {
      if (!isRecord(page)) continue;
      const width = readFiniteNumber(page, "width", 0);
      const height = readFiniteNumber(page, "height", 0);
      if (width > 0 && height > 0) pages.push({ width, height });
    }
  }

  const fieldsRaw = parsed.fields;
  if (!Array.isArray(fieldsRaw)) throw new Error("invalidFormat");

  const fields: FormElement[] = [];
  for (const item of fieldsRaw) {
    const field = parseField(item);
    if (field) fields.push(field);
  }

  if (fields.length === 0 && fieldsRaw.length > 0) throw new Error("noValidFields");

  return { version: FORM_FIELDS_FILE_VERSION, pages, fields };
}

function scaleCoordinate(
  value: number,
  sourceSize: number,
  targetSize: number,
): number {
  if (sourceSize <= 0 || targetSize <= 0) return value;
  if (Math.abs(sourceSize - targetSize) < 0.01) return value;
  return (value / sourceSize) * targetSize;
}

export function remapImportedFields(
  fields: FormElement[],
  sourcePages: FormFieldsPageSnapshot[],
  targetPages: PageInfo[],
): FormElement[] {
  const pageCount = Math.max(1, targetPages.length);
  return fields.map((field) => {
    const pageIndex = Math.min(Math.max(1, field.pageNumber), pageCount) - 1;
    const target = targetPages[pageIndex];
    const source = sourcePages[pageIndex];
    const pageNumber = pageIndex + 1;

    if (!target || !source) {
      return { ...field, pageNumber };
    }

    const scaleX = target.width / source.width;
    const scaleY = target.height / source.height;
    if (
      Math.abs(scaleX - 1) < 0.001 &&
      Math.abs(scaleY - 1) < 0.001 &&
      field.pageNumber === pageNumber
    ) {
      return field;
    }

    const scaledHeight = isHeightLockedField(field)
      ? field.height
      : scaleCoordinate(field.height, source.height, target.height);

    return {
      ...field,
      pageNumber,
      x: scaleCoordinate(field.x, source.width, target.width),
      y: scaleCoordinate(field.y, source.height, target.height),
      width: scaleCoordinate(field.width, source.width, target.width),
      height: scaledHeight,
    };
  });
}

let importIdCounter = 0;

export function assignFreshFieldIds(fields: FormElement[]): FormElement[] {
  return fields.map((field) => ({
    ...field,
    id: `import_${++importIdCounter}_${Date.now().toString(36)}`,
  }));
}

export function prepareImportedFields(
  document: FormFieldsDocument,
  targetPages: PageInfo[],
): FormElement[] {
  const remapped = remapImportedFields(
    document.fields,
    document.pages,
    targetPages,
  );
  return assignFreshFieldIds(remapped);
}
