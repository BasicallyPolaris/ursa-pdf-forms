import { describe, it, expect } from "vitest";
import { PDFDocument, PDFName } from "pdf-lib";
import { exportFormElements } from "@/lib/pdf-export-engine";
import { createTextField, createCheckbox, createRadioButton, type FormElement } from "@/lib/form-element-model";

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

  it("exports checkbox fields with correct properties", async () => {
    const fixturePdf = await createFixturePdf();
    const elements: FormElement[] = [
      createCheckbox({
        x: 72,
        y: 700,
        pageNumber: 1,
        name: "agree",
        defaultChecked: true,
        width: 15,
        height: 15,
      }),
    ];

    const resultBytes = await exportFormElements(fixturePdf, elements);
    const resultPdf = await PDFDocument.load(resultBytes);
    const form = resultPdf.getForm();
    expect(form.getFields().length).toBe(1);

    const checkbox = form.getCheckBox("agree");
    expect(checkbox).toBeDefined();
    expect(checkbox.isChecked()).toBe(true);
  });

  it("exports mixed text fields and checkboxes", async () => {
    const fixturePdf = await createFixturePdf();
    const elements: FormElement[] = [
      createTextField({
        x: 72,
        y: 700,
        pageNumber: 1,
        name: "name",
        width: 150,
        height: 20,
      }),
      createCheckbox({
        x: 72,
        y: 680,
        pageNumber: 1,
        name: "subscribe",
        defaultChecked: false,
      }),
    ];

    const resultBytes = await exportFormElements(fixturePdf, elements);
    const resultPdf = await PDFDocument.load(resultBytes);
    const form = resultPdf.getForm();
    expect(form.getFields().length).toBe(2);
    expect(form.getField("name")).toBeDefined();
    expect(form.getField("subscribe")).toBeDefined();
  });

  it("exports radio buttons as a mutually exclusive group", async () => {
    const fixturePdf = await createFixturePdf();
    const elements: FormElement[] = [
      createRadioButton({
        x: 72,
        y: 700,
        pageNumber: 1,
        groupName: "color",
        value: "red",
      }),
      createRadioButton({
        x: 72,
        y: 680,
        pageNumber: 1,
        groupName: "color",
        value: "blue",
      }),
      createRadioButton({
        x: 72,
        y: 660,
        pageNumber: 1,
        groupName: "color",
        value: "green",
      }),
    ];

    const resultBytes = await exportFormElements(fixturePdf, elements);
    const resultPdf = await PDFDocument.load(resultBytes);
    const form = resultPdf.getForm();

    const radioGroup = form.getRadioGroup("color");
    expect(radioGroup).toBeDefined();
    expect(form.getFields().length).toBe(1);
  });

  it("exports multiple radio groups independently", async () => {
    const fixturePdf = await createFixturePdf();
    const elements: FormElement[] = [
      createRadioButton({
        x: 72,
        y: 700,
        pageNumber: 1,
        groupName: "size",
        value: "small",
      }),
      createRadioButton({
        x: 72,
        y: 680,
        pageNumber: 1,
        groupName: "size",
        value: "large",
      }),
      createRadioButton({
        x: 200,
        y: 700,
        pageNumber: 1,
        groupName: "color",
        value: "red",
      }),
      createRadioButton({
        x: 200,
        y: 680,
        pageNumber: 1,
        groupName: "color",
        value: "blue",
      }),
    ];

    const resultBytes = await exportFormElements(fixturePdf, elements);
    const resultPdf = await PDFDocument.load(resultBytes);
    const form = resultPdf.getForm();
    expect(form.getFields().length).toBe(2);
    expect(form.getRadioGroup("size")).toBeDefined();
    expect(form.getRadioGroup("color")).toBeDefined();
  });

  it("deduplicates field names with same name", async () => {
    const fixturePdf = await createFixturePdf();
    const elements: FormElement[] = [
      createTextField({ x: 72, y: 700, pageNumber: 1, name: "field", width: 150, height: 20 }),
      createTextField({ x: 72, y: 650, pageNumber: 1, name: "field", width: 150, height: 20 }),
    ];

    const resultBytes = await exportFormElements(fixturePdf, elements);
    const resultPdf = await PDFDocument.load(resultBytes);
    const form = resultPdf.getForm();
    expect(form.getFields().length).toBe(2);
    expect(form.getField("field")).toBeDefined();
    expect(form.getField("field_2")).toBeDefined();
  });

  it("auto-generates name for empty-named elements", async () => {
    const fixturePdf = await createFixturePdf();
    const elements: FormElement[] = [
      createTextField({ x: 72, y: 700, pageNumber: 1, width: 150, height: 20 }),
    ];

    const resultBytes = await exportFormElements(fixturePdf, elements);
    const resultPdf = await PDFDocument.load(resultBytes);
    const form = resultPdf.getForm();
    expect(form.getFields().length).toBe(1);
    expect(form.getField("field_1")).toBeDefined();
  });

  it("filters out elements with invalid page numbers", async () => {
    const fixturePdf = await createFixturePdf();
    const elements: FormElement[] = [
      createTextField({ x: 72, y: 700, pageNumber: 1, name: "valid", width: 150, height: 20 }),
      createTextField({ x: 72, y: 700, pageNumber: 99, name: "invalid_page", width: 150, height: 20 }),
      createTextField({ x: 72, y: 700, pageNumber: 0, name: "zero_page", width: 150, height: 20 }),
      createTextField({ x: 72, y: 700, pageNumber: -1, name: "neg_page", width: 150, height: 20 }),
    ];

    const resultBytes = await exportFormElements(fixturePdf, elements);
    const resultPdf = await PDFDocument.load(resultBytes);
    const form = resultPdf.getForm();
    expect(form.getFields().length).toBe(1);
    expect(form.getField("valid")).toBeDefined();
  });

  it("filters out elements with NaN coordinates", async () => {
    const fixturePdf = await createFixturePdf();
    const elements: FormElement[] = [
      createTextField({ x: 72, y: 700, pageNumber: 1, name: "valid", width: 150, height: 20 }),
      { ...createTextField({ x: 72, y: 700, pageNumber: 1, name: "nan_x", width: 150, height: 20 }), x: NaN },
    ];

    const resultBytes = await exportFormElements(fixturePdf, elements);
    const resultPdf = await PDFDocument.load(resultBytes);
    const form = resultPdf.getForm();
    expect(form.getFields().length).toBe(1);
  });

  it("filters out elements with zero or negative dimensions", async () => {
    const fixturePdf = await createFixturePdf();
    const elements: FormElement[] = [
      createTextField({ x: 72, y: 700, pageNumber: 1, name: "valid", width: 150, height: 20 }),
      { ...createTextField({ x: 72, y: 700, pageNumber: 1, name: "zero_w", width: 150, height: 20 }), width: 0 },
      { ...createTextField({ x: 72, y: 700, pageNumber: 1, name: "neg_h", width: 150, height: 20 }), height: -5 },
    ];

    const resultBytes = await exportFormElements(fixturePdf, elements);
    const resultPdf = await PDFDocument.load(resultBytes);
    const form = resultPdf.getForm();
    expect(form.getFields().length).toBe(1);
  });

  it("handles radio with empty value by using element id", async () => {
    const fixturePdf = await createFixturePdf();
    const el = createRadioButton({ x: 72, y: 700, pageNumber: 1, groupName: "testGroup" });
    expect(el.value).toBe("");

    const resultBytes = await exportFormElements(fixturePdf, [el]);
    const resultPdf = await PDFDocument.load(resultBytes);
    const form = resultPdf.getForm();
    const group = form.getRadioGroup("testGroup");
    expect(group).toBeDefined();
  });

  it("handles radio with empty groupName by using fallback", async () => {
    const fixturePdf = await createFixturePdf();
    const el = createRadioButton({ x: 72, y: 700, pageNumber: 1, value: "a" });
    expect(el.groupName).toBe("");

    const resultBytes = await exportFormElements(fixturePdf, [el]);
    const resultPdf = await PDFDocument.load(resultBytes);
    const form = resultPdf.getForm();
    expect(form.getFields().length).toBe(1);
  });

  it("handles empty element array", async () => {
    const fixturePdf = await createFixturePdf();
    const resultBytes = await exportFormElements(fixturePdf, []);
    const resultPdf = await PDFDocument.load(resultBytes);
    expect(resultPdf.getPageCount()).toBe(1);
  });

  it("handles NaN fontSize gracefully", async () => {
    const fixturePdf = await createFixturePdf();
    const el = { ...createTextField({ x: 72, y: 700, pageNumber: 1, name: "nanFont", width: 150, height: 20 }), fontSize: NaN };

    const resultBytes = await exportFormElements(fixturePdf, [el]);
    const resultPdf = await PDFDocument.load(resultBytes);
    const form = resultPdf.getForm();
    expect(form.getField("nanFont")).toBeDefined();
  });

  it("handles NaN maxLength gracefully", async () => {
    const fixturePdf = await createFixturePdf();
    const el = { ...createTextField({ x: 72, y: 700, pageNumber: 1, name: "nanMax", width: 150, height: 20 }), maxLength: NaN };

    const resultBytes = await exportFormElements(fixturePdf, [el]);
    const resultPdf = await PDFDocument.load(resultBytes);
    const form = resultPdf.getForm();
    expect(form.getField("nanMax")).toBeDefined();
  });
});
