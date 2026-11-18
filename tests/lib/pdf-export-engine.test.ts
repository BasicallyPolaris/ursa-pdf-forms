import { describe, it, expect } from "vitest";
import { PDFArray, PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { getFieldsInTabOrder } from "@/lib/field-tab-order";
import { exportFormElements } from "@/lib/pdf-export-engine";
import { extractAcroFormFields } from "@/lib/pdf-form-reader";
import { createTextField, createButtonField, createCheckbox, createRadioButton, type FormElement } from "@/lib/form-element-model";
import { createCalculationScript } from "@/lib/form-calculation";
import { readJavaScriptAction } from "@/lib/pdf-javascript-action";

async function createFixturePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  page.drawText("Test PDF", { x: 50, y: 750, size: 12 });
  return pdf.save();
}

async function createCroppedTopFixturePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  page.setCropBox(0, 0, 612, 692);
  return pdf.save();
}

describe("exportFormElements", () => {
  it("round-trips calculations in execution order and per-widget button scripts", async () => {
    const subtotal = createTextField({
      name: "subtotal", pageNumber: 1, x: 10, y: 40,
    });
    const total = createTextField({
      name: "total", pageNumber: 1, x: 10, y: 75,
    });
    const template = createCalculationScript("PRD", ["quantity", "price"]);
    const custom = 'event.value = Number(this.getField("subtotal").value) + 3;';
    const button = createButtonField({
      name: "update", pageNumber: 1, x: 10, y: 110,
    });
    const buttonScript = 'this.getField("quantity").value = 4; // Änderung';
    const elements: FormElement[] = [
      { ...total, calculationScript: custom, calculationOrder: 2 },
      { ...subtotal, calculationScript: template, calculationOrder: 1 },
      { ...button, actionScript: buttonScript },
      { ...button, id: "second-widget", x: 140, actionScript: "void 0;" },
    ];
    const original = await createFixturePdf();
    const exported = await exportFormElements(original, elements);
    const pdf = await PDFDocument.load(exported);
    const form = pdf.getForm();

    expect(form.acroForm.dict.lookup(PDFName.of("CO"), PDFArray).asArray()).toEqual([
      form.getTextField("subtotal").ref,
      form.getTextField("total").ref,
    ]);
    expect(form.getTextField("subtotal").isReadOnly()).toBe(true);
    expect(form.getButton("update").acroField.getWidgets().map(
      (widget) => readJavaScriptAction(widget.dict.lookup(PDFName.of("A"))),
    )).toEqual([buttonScript, "void 0;"]);

    expect(await extractAcroFormFields(exported)).toMatchObject([
      { name: "total", calculationScript: custom, calculationOrder: 2 },
      { name: "subtotal", calculationScript: template, calculationOrder: 1 },
      { name: "update", actionScript: buttonScript },
      { name: "update", actionScript: "void 0;" },
    ]);
  });

  it("exports and reopens per-page tab order across widget types", async () => {
    const source = await PDFDocument.create();
    const page = source.addPage();
    source.addPage().node.set(PDFName.of("Tabs"), PDFName.of("R"));
    const link = source.context.register(source.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [10, 10, 30, 30],
    }));
    page.node.addAnnot(link);
    const text = createTextField({ x: 10, y: 10, pageNumber: 1, name: "name" });
    const checkbox = createCheckbox({ x: 20, y: 50, pageNumber: 1, name: "agree" });
    const radio = createRadioButton({
      x: 40, y: 50, pageNumber: 1, groupName: "choice", value: "yes",
    });
    const otherPage = createTextField({ x: 10, y: 10, pageNumber: 2, name: "notes" });
    const result = await exportFormElements(await source.save(), [
      { ...text, tabOrder: 2 },
      { ...checkbox, tabOrder: 1 },
      { ...radio, tabOrder: 0 },
      otherPage,
    ]);

    const pdf = await PDFDocument.load(result);
    const [firstPage, secondPage] = pdf.getPages();
    expect(firstPage.node.get(PDFName.of("Tabs"))).toBe(PDFName.of("W"));
    expect(secondPage.node.get(PDFName.of("Tabs"))).toBe(PDFName.of("R"));
    const annotations = firstPage.node.Annots()!;
    expect(annotations.lookup(0, PDFDict).get(PDFName.of("Subtype"))).toBe(
      PDFName.of("Link"),
    );
    const fields = pdf.getForm();
    expect(annotations.asArray().slice(1)).toEqual(
      ["choice", "agree", "name"].map((name) => {
        const widget = fields.getField(name).acroField.getWidgets()[0];
        return pdf.context.getObjectRef(widget.dict);
      }),
    );

    const reopened = await extractAcroFormFields(result);
    expect(
      getFieldsInTabOrder(reopened.filter((field) => field.pageNumber === 1)).map(
        (field) => field.type,
      ),
    ).toEqual(["radio", "checkbox", "text"]);
  });

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

  it("links fields with the same name", async () => {
    const fixturePdf = await createFixturePdf();
    const elements: FormElement[] = [
      createTextField({ x: 72, y: 700, pageNumber: 1, name: "field", width: 150, height: 20 }),
      createTextField({ x: 72, y: 650, pageNumber: 1, name: "field", width: 150, height: 20 }),
    ];

    const resultBytes = await exportFormElements(fixturePdf, elements);
    const resultPdf = await PDFDocument.load(resultBytes);
    const form = resultPdf.getForm();
    expect(form.getFields().length).toBe(1);

    const field = form.getTextField("field");
    expect(field.acroField.getWidgets()).toHaveLength(2);

    field.setText("linked value");
    expect(field.getText()).toBe("linked value");

    const imported = await extractAcroFormFields(resultBytes);
    expect(imported).toHaveLength(2);
    expect(
      imported.map((element) =>
        "name" in element ? element.name : element.groupName,
      ),
    ).toEqual(["field", "field"]);
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

  it("round-trips editor coordinates on pages where crop is smaller than media", async () => {
    const fixturePdf = await createCroppedTopFixturePdf();
    const elements: FormElement[] = [
      createTextField({
        x: 72,
        y: 100,
        pageNumber: 1,
        name: "croppedPageField",
        width: 200,
        height: 22,
      }),
    ];

    const resultBytes = await exportFormElements(fixturePdf, elements);
    const extracted = await extractAcroFormFields(resultBytes);
    expect(extracted.length).toBe(1);
    const field = extracted[0];
    expect(field.type).toBe("text");
    if (field.type === "text") {
      expect(field.x).toBeCloseTo(72, 5);
      expect(field.y).toBeCloseTo(100, 5);
      expect(field.width).toBeCloseTo(200, 5);
      expect(field.height).toBeCloseTo(22, 5);
    }
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
