import { PDFDocument, PDFName, PDFPage } from "pdf-lib";
import type { FormElement, TextField, Checkbox, RadioButton } from "./form-element-model";

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

    const safeName = dedupeFieldName(
      "name" in el ? el.name : "",
      usedNames,
      i,
    );
    usedNames.add(safeName);

    switch (el.type) {
      case "text":
        addTextField(form, page, { ...el, name: safeName }, pageHeight);
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
): void {
  const field = form.createTextField(el.name);

  const pdfY = pageHeight - el.y - el.height;

  field.addToPage(page, {
    x: el.x,
    y: pdfY,
    width: el.width,
    height: el.height,
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

  if (el.maxLength !== undefined && Number.isFinite(el.maxLength) && el.maxLength > 0) {
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
