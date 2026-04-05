import { describe, it, expect } from "vitest";
import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFDict,
  PDFRef,
  PDFNumber,
  PDFHexString,
} from "pdf-lib";
import { extractAcroFormFields } from "@/lib/pdf-form-reader";
import { exportFormElements } from "@/lib/pdf-export-engine";
import {
  createTextField,
  createCheckbox,
  createRadioButton,
  type FormElement,
} from "@/lib/form-element-model";

async function createPdfWithTextField(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  return pdf.save();
}

async function createPdfWithPages(pageCount: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    pdf.addPage([612, 792]);
  }
  return pdf.save();
}

describe("extractAcroFormFields", () => {
  it("returns empty array for PDF without AcroForm", async () => {
    const pdfBytes = await createPdfWithTextField();
    const elements = await extractAcroFormFields(pdfBytes);
    expect(elements).toEqual([]);
  });

  it("returns empty array for PDF with empty AcroForm", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([612, 792]);
    pdf.getForm();
    const pdfBytes = await pdf.save();
    const elements = await extractAcroFormFields(pdfBytes);
    expect(elements).toEqual([]);
  });

  it("extracts a text field", async () => {
    const basePdf = await createPdfWithTextField();
    const elements: FormElement[] = [
      createTextField({
        x: 72,
        y: 700,
        pageNumber: 1,
        name: "fullName",
        defaultValue: "John",
        fontSize: 14,
        width: 200,
        height: 24,
      }),
    ];

    const exportedPdf = await exportFormElements(basePdf, elements);
    const extracted = await extractAcroFormFields(exportedPdf);

    expect(extracted.length).toBe(1);
    const field = extracted[0];
    expect(field.type).toBe("text");
    if (field.type === "text") {
      expect(field.name).toBe("fullName");
      expect(field.x).toBeCloseTo(72, -1);
      expect(field.width).toBeCloseTo(200, -1);
      expect(field.fontSize).toBe(14);
      expect(field.pageNumber).toBe(1);
    }
  });

  it("extracts a checkbox", async () => {
    const basePdf = await createPdfWithTextField();
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

    const exportedPdf = await exportFormElements(basePdf, elements);
    const extracted = await extractAcroFormFields(exportedPdf);

    expect(extracted.length).toBe(1);
    const field = extracted[0];
    expect(field.type).toBe("checkbox");
    if (field.type === "checkbox") {
      expect(field.name).toBe("agree");
      expect(field.defaultChecked).toBe(true);
      expect(field.pageNumber).toBe(1);
    }
  });

  it("extracts radio button group", async () => {
    const basePdf = await createPdfWithTextField();
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
    ];

    const exportedPdf = await exportFormElements(basePdf, elements);
    const extracted = await extractAcroFormFields(exportedPdf);

    expect(extracted.length).toBe(2);
    expect(extracted.every((el) => el.type === "radio")).toBe(true);
    const radios = extracted.filter((el) => el.type === "radio");
    expect(radios[0].groupName).toBe("color");
    expect(radios[1].groupName).toBe("color");
    expect(radios.some((r) => r.value === "red")).toBe(true);
    expect(radios.some((r) => r.value === "blue")).toBe(true);
  });

  it("extracts text field with default value", async () => {
    const basePdf = await createPdfWithTextField();
    const elements: FormElement[] = [
      createTextField({
        x: 72,
        y: 600,
        pageNumber: 1,
        name: "address",
        defaultValue: "123 Main St",
        fontSize: 12,
        width: 200,
        height: 20,
      }),
    ];

    const exportedPdf = await exportFormElements(basePdf, elements);
    const extracted = await extractAcroFormFields(exportedPdf);

    expect(extracted.length).toBe(1);
    if (extracted[0].type === "text") {
      expect(extracted[0].name).toBe("address");
      expect(extracted[0].defaultValue).toBe("123 Main St");
    }
  });

  it("extracts fields from multi-page PDF", async () => {
    const basePdf = await createPdfWithPages(3);
    const elements: FormElement[] = [
      createTextField({
        x: 72,
        y: 700,
        pageNumber: 1,
        name: "page1Field",
        width: 150,
        height: 20,
      }),
      createTextField({
        x: 72,
        y: 700,
        pageNumber: 3,
        name: "page3Field",
        width: 150,
        height: 20,
      }),
    ];

    const exportedPdf = await exportFormElements(basePdf, elements);
    const extracted = await extractAcroFormFields(exportedPdf);

    expect(extracted.length).toBe(2);
    const pageNumbers = extracted.map((el) => el.pageNumber).sort();
    expect(pageNumbers).toEqual([1, 3]);
  });

  it("extracts mixed field types", async () => {
    const basePdf = await createPdfWithTextField();
    const elements: FormElement[] = [
      createTextField({
        x: 72,
        y: 700,
        pageNumber: 1,
        name: "name",
        width: 200,
        height: 20,
      }),
      createCheckbox({
        x: 72,
        y: 670,
        pageNumber: 1,
        name: "subscribe",
        defaultChecked: false,
      }),
      createRadioButton({
        x: 72,
        y: 640,
        pageNumber: 1,
        groupName: "size",
        value: "small",
      }),
      createRadioButton({
        x: 72,
        y: 620,
        pageNumber: 1,
        groupName: "size",
        value: "large",
      }),
    ];

    const exportedPdf = await exportFormElements(basePdf, elements);
    const extracted = await extractAcroFormFields(exportedPdf);

    expect(extracted.length).toBe(4);
    const types = extracted.map((el) => el.type).sort();
    expect(types).toEqual(["checkbox", "radio", "radio", "text"]);
  });

  it("handles unchecked checkbox", async () => {
    const basePdf = await createPdfWithTextField();
    const elements: FormElement[] = [
      createCheckbox({
        x: 72,
        y: 700,
        pageNumber: 1,
        name: "unchecked",
        defaultChecked: false,
      }),
    ];

    const exportedPdf = await exportFormElements(basePdf, elements);
    const extracted = await extractAcroFormFields(exportedPdf);

    expect(extracted.length).toBe(1);
    if (extracted[0].type === "checkbox") {
      expect(extracted[0].defaultChecked).toBe(false);
    }
  });

  it("preserves coordinate positions after round-trip", async () => {
    const basePdf = await createPdfWithTextField();
    const originalEl = createTextField({
      x: 100,
      y: 500,
      pageNumber: 1,
      name: "positioned",
      width: 180,
      height: 22,
    });

    const exportedPdf = await exportFormElements(basePdf, [originalEl]);
    const extracted = await extractAcroFormFields(exportedPdf);

    expect(extracted.length).toBe(1);
    const field = extracted[0];
    expect(field.x).toBeCloseTo(100, -1);
    expect(field.y).toBeCloseTo(500, -1);
    expect(field.width).toBeCloseTo(180, -1);
    expect(field.height).toBeCloseTo(22, -1);
  });

  it("extracts font size from default appearance", async () => {
    const basePdf = await createPdfWithTextField();
    const elements: FormElement[] = [
      createTextField({
        x: 72,
        y: 700,
        pageNumber: 1,
        name: "sized",
        fontSize: 18,
        width: 200,
        height: 22,
      }),
    ];

    const exportedPdf = await exportFormElements(basePdf, elements);
    const extracted = await extractAcroFormFields(exportedPdf);

    expect(extracted.length).toBe(1);
    if (extracted[0].type === "text") {
      expect(extracted[0].fontSize).toBe(18);
    }
  });

  it("extracts fields from PDF with hierarchical page tree", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([612, 792]);
    pdf.addPage([612, 792]);
    pdf.addPage([612, 792]);
    pdf.addPage([612, 792]);
    const basePdf = await pdf.save();

    const elements: FormElement[] = [
      createTextField({
        x: 72,
        y: 700,
        pageNumber: 1,
        name: "page1",
        width: 150,
        height: 20,
      }),
      createTextField({
        x: 72,
        y: 700,
        pageNumber: 4,
        name: "page4",
        width: 150,
        height: 20,
      }),
    ];

    const exportedPdf = await exportFormElements(basePdf, elements);

    const reloaded = await PDFDocument.load(exportedPdf, {
      ignoreEncryption: true,
    });
    const ctx = reloaded.context;
    const pagesTree = reloaded.catalog.lookup(PDFName.of("Pages"));
    const kids = pagesTree.lookup(PDFName.of("Kids"));

    const intermediateKids = PDFArray.withContext(ctx);
    intermediateKids.push(kids.get(0));
    intermediateKids.push(kids.get(1));
    const intermediateNode = ctx.obj({
      Type: "Pages",
      Kids: intermediateKids,
      Count: 2,
    });
    const intermediateRef = ctx.register(intermediateNode);

    intermediateKids.get(0) instanceof PDFRef;
    const p0 = kids.get(0) as PDFRef;
    const p1 = kids.get(1) as PDFRef;
    const p0Dict = ctx.lookup(p0) as PDFDict;
    const p1Dict = ctx.lookup(p1) as PDFDict;
    p0Dict.set(PDFName.of("Parent"), intermediateRef);
    p1Dict.set(PDFName.of("Parent"), intermediateRef);

    const newTopKids = PDFArray.withContext(ctx);
    newTopKids.push(intermediateRef);
    newTopKids.push(kids.get(2));
    newTopKids.push(kids.get(3));
    pagesTree.set(PDFName.of("Kids"), newTopKids);

    const modifiedPdf = await reloaded.save();

    const extracted = await extractAcroFormFields(modifiedPdf);
    expect(extracted.length).toBe(2);
    const pageNumbers = extracted.map((el) => el.pageNumber).sort();
    expect(pageNumbers).toEqual([1, 4]);
  });

  it("extracts fields when /P is only on parent dict", async () => {
    const basePdf = await createPdfWithPages(1);
    const elements: FormElement[] = [
      createTextField({
        x: 72,
        y: 700,
        pageNumber: 1,
        name: "inheritedPage",
        width: 150,
        height: 20,
      }),
    ];

    const exportedPdf = await exportFormElements(basePdf, elements);
    const reloaded = await PDFDocument.load(exportedPdf, {
      ignoreEncryption: true,
    });
    const ctx = reloaded.context;
    const pagesTree = reloaded.catalog.lookup(PDFName.of("Pages"));
    const pageRef = (pagesTree.lookup(PDFName.of("Kids")) as PDFArray).get(0) as PDFRef;

    const acroForm = reloaded.catalog.lookup(PDFName.of("AcroForm")) as PDFDict;
    const fields = acroForm.lookup(PDFName.of("Fields")) as PDFArray;
    const fieldRef = fields.get(0) as PDFRef;
    const fieldDict = ctx.lookup(fieldRef) as PDFDict;

    const kids = fieldDict.lookup(PDFName.of("Kids"));
    if (kids instanceof PDFArray && kids.size() > 0) {
      const kidRef = kids.get(0) as PDFRef;
      const kidDict = ctx.lookup(kidRef) as PDFDict;
      kidDict.delete(PDFName.of("P"));
      fieldDict.set(PDFName.of("P"), pageRef);
    }

    const modifiedPdf = await reloaded.save();

    const extracted = await extractAcroFormFields(modifiedPdf);
    expect(extracted.length).toBe(1);
    expect(extracted[0].pageNumber).toBe(1);
    if (extracted[0].type === "text") {
      expect(extracted[0].name).toBe("inheritedPage");
    }
  });
});
