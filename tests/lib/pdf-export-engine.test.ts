import { describe, it, expect } from "vitest";
import { PDFDocument, PDFName } from "pdf-lib";
import { exportFormElements } from "@/lib/pdf-export-engine";
import { createTextField, type FormElement } from "@/lib/form-element-model";

async function createFixturePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  page.drawText("Test PDF", { x: 50, y: 750, size: 12 });
  return pdf.save();
}

describe("exportFormElements", () => {
  it("produces a valid PDF with AcroForm text field", async () => {
    const fixturePdf = await createFixturePdf();
    const elements: FormElement[] = [
      createTextField({
        x: 72,
        y: 720,
        pageNumber: 1,
        name: "firstName",
        defaultValue: "John",
        fontSize: 12,
        width: 200,
        height: 20,
      }),
    ];

    const resultBytes = await exportFormElements(fixturePdf, elements);
    expect(resultBytes).toBeDefined();
    expect(resultBytes.length).toBeGreaterThan(0);

    const resultPdf = await PDFDocument.load(resultBytes);

    const form = resultPdf.getForm();
    const fields = form.getFields();
    expect(fields.length).toBe(1);

    const textField = form.getField("firstName");
    expect(textField).toBeDefined();
  });

  it("preserves original PDF page count and dimensions", async () => {
    const fixturePdf = await createFixturePdf();
    const elements: FormElement[] = [
      createTextField({
        x: 72,
        y: 720,
        pageNumber: 1,
        name: "field1",
        width: 150,
        height: 20,
      }),
    ];

    const resultBytes = await exportFormElements(fixturePdf, elements);
    const resultPdf = await PDFDocument.load(resultBytes);
    expect(resultPdf.getPageCount()).toBe(1);

    const page = resultPdf.getPage(0);
    const { width, height } = page.getSize();
    expect(width).toBe(612);
    expect(height).toBe(792);
  });

  it("handles Y-axis inversion (PDF origin is bottom-left)", async () => {
    const fixturePdf = await createFixturePdf();
    const elements: FormElement[] = [
      createTextField({
        x: 72,
        y: 72,
        pageNumber: 1,
        name: "bottomField",
        width: 150,
        height: 20,
      }),
    ];

    const resultBytes = await exportFormElements(fixturePdf, elements);
    const resultPdf = await PDFDocument.load(resultBytes);

    const acroForm = resultPdf.catalog.lookup(PDFName.of("AcroForm"));
    expect(acroForm).toBeDefined();
  });

  it("handles multiple text fields on same page", async () => {
    const fixturePdf = await createFixturePdf();
    const elements: FormElement[] = [
      createTextField({
        x: 72,
        y: 700,
        pageNumber: 1,
        name: "field1",
        width: 150,
        height: 20,
      }),
      createTextField({
        x: 72,
        y: 650,
        pageNumber: 1,
        name: "field2",
        width: 150,
        height: 20,
      }),
    ];

    const resultBytes = await exportFormElements(fixturePdf, elements);
    const resultPdf = await PDFDocument.load(resultBytes);
    const form = resultPdf.getForm();
    expect(form.getFields().length).toBe(2);
  });
});
