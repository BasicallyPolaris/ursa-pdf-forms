import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFPage,
  PDFRef,
  rgb,
  StandardFonts,
} from "pdf-lib";

const RESOLVED_FONT_TO_ENUM_KEY: Record<string, keyof typeof StandardFonts> = {
  Helvetica: "Helvetica",
  "Helvetica-Bold": "HelveticaBold",
  "Helvetica-Oblique": "HelveticaOblique",
  "Helvetica-BoldOblique": "HelveticaBoldOblique",
  Courier: "Courier",
  "Courier-Bold": "CourierBold",
  "Courier-Oblique": "CourierOblique",
  "Courier-BoldOblique": "CourierBoldOblique",
  "Times-Roman": "TimesRoman",
  "Times-Bold": "TimesRomanBold",
  "Times-Italic": "TimesRomanItalic",
  "Times-BoldItalic": "TimesRomanBoldItalic",
  Symbol: "Symbol",
  ZapfDingbats: "ZapfDingbats",
};

function embedStandardFont(pdfDoc: PDFDocument, resolvedName: string) {
  const key = RESOLVED_FONT_TO_ENUM_KEY[resolvedName] ?? "Helvetica";
  return pdfDoc.embedStandardFont(StandardFonts[key]);
}

import type {
  Checkbox,
  DropdownField,
  FormElement,
  RadioButton,
  TextField,
  ButtonField,
  OptionListField,
} from "./form-element-model";
import { hexToRgb, resolveFontFamily } from "./font-utils";
import {
  editorRectToPdfLowerLeft,
  getPageViewQuadForPdfLibPage,
  type PdfViewQuad,
} from "./pdf-page-view";

export class ExportValidationError extends Error {
  errors: string[];
  constructor(errors: string[]) {
    super("Export validation failed");
    this.name = "ExportValidationError";
    this.errors = errors;
  }
}

function dedupeFieldName(
  name: string,
  usedNames: Set<string>,
  index: number,
): string {
  if (!name || name.trim() === "") {
    return `field_${index + 1}`;
  }
  const safe = name.slice(0, 100);
  if (!usedNames.has(safe)) return safe;
  let i = 2;
  for (let attempts = 0; attempts < 10000; attempts++) {
    const candidate = `${safe}_${i}`;
    if (!usedNames.has(candidate)) return candidate;
    i++;
  }
  return `field_${index + 1}_${Date.now().toString(36)}`;
}



export async function exportFormElements(
  originalPdfBytes: Uint8Array,
  elements: FormElement[],
): Promise<Uint8Array> {
  if (!originalPdfBytes || originalPdfBytes.length === 0) {
    throw new Error("Cannot export: no PDF data provided");
  }
  if (!Array.isArray(elements)) {
    throw new Error("Cannot export: invalid elements");
  }

  const pdf = await PDFDocument.load(originalPdfBytes);
  const pageCount = pdf.getPageCount();

  const existingForm = pdf.catalog.lookup(PDFName.of("AcroForm"));
  if (existingForm) {
    pdf.catalog.delete(PDFName.of("AcroForm"));
    stripWidgetAnnotations(pdf);
  }

  const form = pdf.getForm();

  const validElements = elements.filter(
    (el) =>
      Number.isFinite(el.pageNumber) &&
      el.pageNumber >= 1 &&
      el.pageNumber <= pageCount &&
      Number.isFinite(el.x) &&
      Number.isFinite(el.y) &&
      Number.isFinite(el.width) &&
      el.width > 0 &&
      Number.isFinite(el.height) &&
      el.height > 0,
  );

  const usedNames = new Set<string>();
  const radioElements = validElements.filter(
    (el): el is RadioButton => el.type === "radio",
  );
  const nonRadioElements = validElements.filter((el) => el.type !== "radio");

  for (let i = 0; i < nonRadioElements.length; i++) {
    const el = nonRadioElements[i];
    const page = pdf.getPage(el.pageNumber - 1);
    const view = getPageViewQuadForPdfLibPage(page);

    const safeName = dedupeFieldName("name" in el ? el.name : "", usedNames, i);
    usedNames.add(safeName);

    try {
      switch (el.type) {
        case "text":
          addTextField(form, page, { ...el, name: safeName }, view, pdf);
          break;
        case "checkbox":
          addCheckboxField(form, page, { ...el, name: safeName }, view);
          break;
        case "dropdown":
          addDropdownField(form, page, { ...el, name: safeName }, view, pdf);
          break;
        case "button":
          addButtonField(form, page, { ...el, name: safeName }, view, pdf);
          break;
        case "optionlist":
          addOptionListField(form, page, { ...el, name: safeName }, view, pdf);
          break;
      }
    } catch (err) {
      console.warn(`Skipping field "${safeName}" due to export error:`, err);
    }
  }

  const groups = new Map<string, RadioButton[]>();
  for (const el of radioElements) {
    const key = el.groupName || `group_${el.id}`;
    const existing = groups.get(key) ?? [];
    existing.push(el);
    groups.set(key, existing);
  }

  for (const [groupName, radios] of groups) {
    try {
      const radioGroup = form.createRadioGroup(groupName);

      for (const el of radios) {
        if (el.pageNumber < 1 || el.pageNumber > pageCount) continue;
        const page = pdf.getPage(el.pageNumber - 1);
        const view = getPageViewQuadForPdfLibPage(page);
        const { x, y } = editorRectToPdfLowerLeft(el, view);
        radioGroup.addOptionToPage(el.value || el.id, page, {
          x,
          y,
          width: el.width,
          height: el.height,
        });
      }
    } catch (err) {
      console.warn(`Skipping radio group "${groupName}" due to export error:`, err);
    }
  }

  return pdf.save();
}

function addTextField(
  form: ReturnType<PDFDocument["getForm"]>,
  page: PDFPage,
  el: TextField,
  view: PdfViewQuad,
  pdfDoc: PDFDocument,
): void {
  const field = form.createTextField(el.name);

  const { x: pdfX, y: pdfY } = editorRectToPdfLowerLeft(el, view);

  const resolvedFont = resolveFontFamily(el.fontFamily, el.fontWeight);
  const font = embedStandardFont(pdfDoc, resolvedFont);

  const textColor = el.textColor ? hexToRgb(el.textColor) : undefined;
  const backgroundColor = el.backgroundColor ? hexToRgb(el.backgroundColor) : undefined;
  const borderColor = el.borderColor ? hexToRgb(el.borderColor) : undefined;

  field.addToPage(page, {
    x: pdfX,
    y: pdfY,
    width: el.width,
    height: el.height,
    font,
    textColor: textColor ? rgb(textColor.r, textColor.g, textColor.b) : undefined,
    backgroundColor: backgroundColor ? rgb(backgroundColor.r, backgroundColor.g, backgroundColor.b) : undefined,
    borderColor: borderColor ? rgb(borderColor.r, borderColor.g, borderColor.b) : undefined,
    borderWidth: el.borderWidth > 0 ? el.borderWidth : undefined,
  });

  if (el.fontSize && Number.isFinite(el.fontSize) && el.fontSize > 0) {
    field.setFontSize(el.fontSize);
  }

  field.setText(el.defaultValue ?? "");

  if (el.multiline) {
    field.enableMultiline();
  }

  if (el.required) {
    field.isRequired();
  }

  if (
    el.maxLength !== undefined &&
    Number.isFinite(el.maxLength) &&
    el.maxLength > 0
  ) {
    field.setMaxLength(el.maxLength);
  }

  field.updateAppearances(font);
}

function addCheckboxField(
  form: ReturnType<PDFDocument["getForm"]>,
  page: PDFPage,
  el: Checkbox,
  view: PdfViewQuad,
): void {
  const field = form.createCheckBox(el.name);

  const { x: pdfX, y: pdfY } = editorRectToPdfLowerLeft(el, view);

  field.addToPage(page, {
    x: pdfX,
    y: pdfY,
    width: el.width,
    height: el.height,
  });

  if (el.defaultChecked) {
    field.check();
  }
}

function addDropdownField(
  form: ReturnType<PDFDocument["getForm"]>,
  page: PDFPage,
  el: DropdownField & { name: string },
  view: PdfViewQuad,
  pdfDoc: PDFDocument,
): void {
  const field = form.createDropdown(el.name);
  const { x: pdfX, y: pdfY } = editorRectToPdfLowerLeft(el, view);

  const resolvedFont = resolveFontFamily(el.fontFamily, el.fontWeight);
  const font = embedStandardFont(pdfDoc, resolvedFont);

  const textColor = el.textColor ? hexToRgb(el.textColor) : undefined;
  const backgroundColor = el.backgroundColor ? hexToRgb(el.backgroundColor) : undefined;
  const borderColor = el.borderColor ? hexToRgb(el.borderColor) : undefined;

  field.addToPage(page, {
    x: pdfX,
    y: pdfY,
    width: el.width,
    height: el.height,
    font,
    textColor: textColor ? rgb(textColor.r, textColor.g, textColor.b) : undefined,
    backgroundColor: backgroundColor ? rgb(backgroundColor.r, backgroundColor.g, backgroundColor.b) : undefined,
    borderColor: borderColor ? rgb(borderColor.r, borderColor.g, borderColor.b) : undefined,
    borderWidth: el.borderWidth > 0 ? el.borderWidth : undefined,
  });

  if (el.fontSize && Number.isFinite(el.fontSize) && el.fontSize > 0) {
    field.setFontSize(el.fontSize);
  }

  if (el.options.length > 0) {
    field.setOptions(el.options);
  }

  if (el.defaultValue) {
    field.select(el.defaultValue);
  }

  if (el.required) {
    field.isRequired();
  }

  if (el.editable) {
    field.enableEditing();
  }
}

function addButtonField(
  form: ReturnType<PDFDocument["getForm"]>,
  page: PDFPage,
  el: ButtonField & { name: string },
  view: PdfViewQuad,
  pdfDoc: PDFDocument,
): void {
  const field = form.createButton(el.name);
  const { x: pdfX, y: pdfY } = editorRectToPdfLowerLeft(el, view);

  const resolvedFont = resolveFontFamily(el.fontFamily, el.fontWeight);
  const font = embedStandardFont(pdfDoc, resolvedFont);

  const textColor = el.textColor ? hexToRgb(el.textColor) : undefined;
  const backgroundColor = el.backgroundColor ? hexToRgb(el.backgroundColor) : undefined;
  const borderColor = el.borderColor ? hexToRgb(el.borderColor) : undefined;

  field.addToPage(el.label, page, {
    x: pdfX,
    y: pdfY,
    width: el.width,
    height: el.height,
    font,
    textColor: textColor ? rgb(textColor.r, textColor.g, textColor.b) : rgb(0, 0, 0),
    backgroundColor: backgroundColor ? rgb(backgroundColor.r, backgroundColor.g, backgroundColor.b) : rgb(0.9, 0.9, 0.9),
    borderColor: borderColor ? rgb(borderColor.r, borderColor.g, borderColor.b) : rgb(0.5, 0.5, 0.5),
    borderWidth: el.borderWidth > 0 ? el.borderWidth : 1,
  });

  if (el.fontSize && Number.isFinite(el.fontSize) && el.fontSize > 0) {
    field.setFontSize(el.fontSize);
  }
}

function addOptionListField(
  form: ReturnType<PDFDocument["getForm"]>,
  page: PDFPage,
  el: OptionListField & { name: string },
  view: PdfViewQuad,
  pdfDoc: PDFDocument,
): void {
  const field = form.createOptionList(el.name);
  const { x: pdfX, y: pdfY } = editorRectToPdfLowerLeft(el, view);

  const resolvedFont = resolveFontFamily(el.fontFamily, el.fontWeight);
  const font = embedStandardFont(pdfDoc, resolvedFont);

  const textColor = el.textColor ? hexToRgb(el.textColor) : undefined;
  const backgroundColor = el.backgroundColor ? hexToRgb(el.backgroundColor) : undefined;
  const borderColor = el.borderColor ? hexToRgb(el.borderColor) : undefined;

  field.addToPage(page, {
    x: pdfX,
    y: pdfY,
    width: el.width,
    height: el.height,
    font,
    textColor: textColor ? rgb(textColor.r, textColor.g, textColor.b) : undefined,
    backgroundColor: backgroundColor ? rgb(backgroundColor.r, backgroundColor.g, backgroundColor.b) : undefined,
    borderColor: borderColor ? rgb(borderColor.r, borderColor.g, borderColor.b) : undefined,
    borderWidth: el.borderWidth > 0 ? el.borderWidth : undefined,
  });

  if (el.fontSize && Number.isFinite(el.fontSize) && el.fontSize > 0) {
    field.setFontSize(el.fontSize);
  }

  if (el.options.length > 0) {
    field.setOptions(el.options);
  }

  if (el.defaultValue) {
    field.select(el.defaultValue);
  }

  if (el.required) {
    field.isRequired();
  }
}

function stripWidgetAnnotations(pdf: PDFDocument): void {
  const pages = pdf.getPages();
  for (const page of pages) {
    const annots = page.node.lookup(PDFName.of("Annots"));
    if (!(annots instanceof PDFArray)) continue;

    const kept: (PDFRef | PDFDict)[] = [];
    for (let i = 0; i < annots.size(); i++) {
      const annotRef = annots.get(i) as PDFRef | PDFDict;
      const annotDict =
        annotRef instanceof PDFRef ? pdf.context.lookup(annotRef) : annotRef;

      if (annotDict instanceof PDFDict) {
        const subtype = annotDict.get(PDFName.of("Subtype"));
        if (subtype === PDFName.of("Widget")) continue;
      }
      kept.push(annotRef);
    }

    if (kept.length === 0) {
      page.node.delete(PDFName.of("Annots"));
    } else {
      page.node.set(PDFName.of("Annots"), pdf.context.obj(kept));
    }
  }
}

export async function stripAcroFormFromPdf(
  pdfBytes: Uint8Array,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const existingForm = pdf.catalog.lookup(PDFName.of("AcroForm"));
  if (!existingForm) return pdfBytes;
  pdf.catalog.delete(PDFName.of("AcroForm"));
  stripWidgetAnnotations(pdf);
  return pdf.save();
}
