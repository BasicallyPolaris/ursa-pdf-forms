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
import type {
  Checkbox,
  FormElement,
  RadioButton,
  TextField,
} from "./form-element-model";
import { hexToRgb, resolveFontFamily } from "./font-utils";

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
  if (!usedNames.has(name)) return name;
  let i = 2;
  while (usedNames.has(`${name}_${i}`)) i++;
  return `${name}_${i}`;
}

export async function exportFormElements(
  originalPdfBytes: Uint8Array,
  elements: FormElement[],
): Promise<Uint8Array> {
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
    const { height: pageHeight } = page.getSize();

    const safeName = dedupeFieldName("name" in el ? el.name : "", usedNames, i);
    usedNames.add(safeName);

    switch (el.type) {
      case "text":
        addTextField(form, page, { ...el, name: safeName }, pageHeight, pdf);
        break;
      case "checkbox":
        addCheckboxField(form, page, { ...el, name: safeName }, pageHeight);
        break;
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
    const radioGroup = form.createRadioGroup(groupName);
    for (const el of radios) {
      if (el.pageNumber < 1 || el.pageNumber > pageCount) continue;
      const page = pdf.getPage(el.pageNumber - 1);
      const { height: pageHeight } = page.getSize();
      const pdfY = pageHeight - el.y - el.height;
      radioGroup.addOptionToPage(el.value || el.id, page, {
        x: el.x,
        y: pdfY,
        width: el.width,
        height: el.height,
      });
    }
  }

  return pdf.save();
}

function addTextField(
  form: ReturnType<PDFDocument["getForm"]>,
  page: PDFPage,
  el: TextField,
  pageHeight: number,
  pdfDoc: PDFDocument,
): void {
  const field = form.createTextField(el.name);

  const pdfY = pageHeight - el.y - el.height;

  const resolvedFont = resolveFontFamily(el.fontFamily, el.fontWeight);
  const font = pdfDoc.embedStandardFont(
    StandardFonts[resolvedFont as keyof typeof StandardFonts] ?? StandardFonts.Helvetica,
  );

  const textColor = el.textColor ? hexToRgb(el.textColor) : undefined;
  const backgroundColor = el.backgroundColor ? hexToRgb(el.backgroundColor) : undefined;
  const borderColor = el.borderColor ? hexToRgb(el.borderColor) : undefined;

  field.addToPage(page, {
    x: el.x,
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
}

function addCheckboxField(
  form: ReturnType<PDFDocument["getForm"]>,
  page: PDFPage,
  el: Checkbox,
  pageHeight: number,
): void {
  const field = form.createCheckBox(el.name);

  const pdfY = pageHeight - el.y - el.height;

  field.addToPage(page, {
    x: el.x,
    y: pdfY,
    width: el.width,
    height: el.height,
  });

  if (el.defaultChecked) {
    field.check();
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
