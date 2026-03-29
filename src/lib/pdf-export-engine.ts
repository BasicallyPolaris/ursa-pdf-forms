import { PDFDocument, PDFPage } from "pdf-lib";
import type { FormElement, TextField } from "./form-element-model";

export async function exportFormElements(
  originalPdfBytes: Uint8Array,
  elements: FormElement[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(originalPdfBytes);
  const form = pdf.getForm();

  for (const el of elements) {
    const page = pdf.getPage(el.pageNumber - 1);
    const { height: pageHeight } = page.getSize();

    switch (el.type) {
      case "text":
        addTextField(form, page, el, pageHeight);
        break;
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
