import { PDFDocument, PDFName, PDFPage } from "pdf-lib";
import type { FormElement, TextField, Checkbox, RadioButton } from "./form-element-model";

export async function exportFormElements(
  originalPdfBytes: Uint8Array,
  elements: FormElement[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(originalPdfBytes);

  const existingForm = pdf.catalog.lookup(PDFName.of("AcroForm"));
  if (existingForm) {
    pdf.catalog.delete(PDFName.of("AcroForm"));
  }

  const form = pdf.getForm();

  const radioElements = elements.filter((el): el is RadioButton => el.type === "radio");
  const nonRadioElements = elements.filter((el) => el.type !== "radio");

  for (const el of nonRadioElements) {
    const page = pdf.getPage(el.pageNumber - 1);
    const { height: pageHeight } = page.getSize();

    switch (el.type) {
      case "text":
        addTextField(form, page, el, pageHeight);
        break;
      case "checkbox":
        addCheckboxField(form, page, el, pageHeight);
        break;
    }
  }

  const groups = new Map<string, RadioButton[]>();
  for (const el of radioElements) {
    const existing = groups.get(el.groupName) ?? [];
    existing.push(el);
    groups.set(el.groupName, existing);
  }

  for (const [groupName, radios] of groups) {
    if (!groupName) continue;
    const radioGroup = form.createRadioGroup(groupName);
    for (const el of radios) {
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

  if (el.fontSize) {
    field.setFontSize(el.fontSize);
  }

  field.setText(el.defaultValue);

  if (el.multiline) {
    field.enableMultiline();
  }

  if (el.required) {
    field.isRequired();
  }

  if (el.maxLength !== undefined && el.maxLength > 0) {
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
