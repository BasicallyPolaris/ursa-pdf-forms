import { describe, it, expect } from "vitest";
import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFDict,
  PDFRef,
} from "pdf-lib";
import { extractAcroFormFields } from "@/lib/pdf-form-reader";
import { exportFormElements } from "@/lib/pdf-export-engine";
import {
  createTextField,
  createCheckbox,
  createRadioButton,
  createButtonField,
  createDropdownField,
  createOptionListField,
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

  it("extracts a push button", async () => {
    const basePdf = await createPdfWithTextField();
    const elements: FormElement[] = [
      createButtonField({
        x: 72,
        y: 700,
        pageNumber: 1,
        name: "submitBtn",
        label: "Submit",
        fontSize: 12,
        width: 80,
        height: 24,
      }),
    ];

    const exportedPdf = await exportFormElements(basePdf, elements);
    const extracted = await extractAcroFormFields(exportedPdf);

    expect(extracted.length).toBe(1);
    const field = extracted[0];
    expect(field.type).toBe("button");
    if (field.type === "button") {
      expect(field.name).toBe("submitBtn");
      expect(field.pageNumber).toBe(1);
      expect(field.fontSize).toBe(12);
    }
  });

  it("extracts a dropdown (combo box)", async () => {
    const basePdf = await createPdfWithTextField();
    const elements: FormElement[] = [
      createDropdownField({
        x: 72,
        y: 700,
        pageNumber: 1,
        name: "country",
        options: ["USA", "Canada", "Mexico"],
        defaultValue: "Canada",
        fontSize: 12,
        width: 150,
        height: 20,
      }),
    ];

    const exportedPdf = await exportFormElements(basePdf, elements);
    const extracted = await extractAcroFormFields(exportedPdf);

    expect(extracted.length).toBe(1);
    const field = extracted[0];
    expect(field.type).toBe("dropdown");
    if (field.type === "dropdown") {
      expect(field.name).toBe("country");
      expect(field.pageNumber).toBe(1);
      expect(field.options).toEqual(["USA", "Canada", "Mexico"]);
      expect(field.fontSize).toBe(12);
    }
  });

  it("extracts an option list (list box)", async () => {
    const basePdf = await createPdfWithTextField();
    const elements: FormElement[] = [
      createOptionListField({
        x: 72,
        y: 600,
        pageNumber: 1,
        name: "colors",
        options: ["Red", "Green", "Blue"],
        defaultValue: "Green",
        fontSize: 12,
        width: 150,
        height: 60,
      }),
    ];

    const exportedPdf = await exportFormElements(basePdf, elements);
    const extracted = await extractAcroFormFields(exportedPdf);

    expect(extracted.length).toBe(1);
    const field = extracted[0];
    expect(field.type).toBe("optionlist");
    if (field.type === "optionlist") {
      expect(field.name).toBe("colors");
      expect(field.pageNumber).toBe(1);
      expect(field.options).toEqual(["Red", "Green", "Blue"]);
      expect(field.fontSize).toBe(12);
    }
  });

  it("distinguishes button, checkbox, and radio in mixed document", async () => {
    const basePdf = await createPdfWithTextField();
    const elements: FormElement[] = [
      createButtonField({
        x: 72,
        y: 720,
        pageNumber: 1,
        name: "btn",
        label: "Click",
      }),
      createCheckbox({
        x: 72,
        y: 700,
        pageNumber: 1,
        name: "check",
      }),
      createRadioButton({
        x: 72,
        y: 680,
        pageNumber: 1,
        groupName: "group",
        value: "a",
      }),
      createRadioButton({
        x: 72,
        y: 660,
        pageNumber: 1,
        groupName: "group",
        value: "b",
      }),
    ];

    const exportedPdf = await exportFormElements(basePdf, elements);
    const extracted = await extractAcroFormFields(exportedPdf);

    expect(extracted.length).toBe(4);
    const types = extracted.map((el) => el.type).sort();
    expect(types).toEqual(["button", "checkbox", "radio", "radio"]);
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
    const pagesTree = reloaded.catalog.lookup(PDFName.of("Pages")) as PDFDict;
    const kids = pagesTree.lookup(PDFName.of("Kids")) as PDFArray;

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
    pagesTree.set(PDFName.of("Count"), ctx.obj(4));

    const modifiedPdf = await reloaded.save();

    const extracted = await extractAcroFormFields(modifiedPdf);
    expect(extracted.length).toBe(2);
    const pageNumbers = extracted.map((el) => el.pageNumber).sort();
    expect(pageNumbers).toEqual([1, 4]);
  });

  it("preserves multiline flag after round-trip", async () => {
    const basePdf = await createPdfWithTextField();
    const elements: FormElement[] = [
      createTextField({
        x: 72,
        y: 600,
        pageNumber: 1,
        name: "single",
        multiline: false,
        width: 200,
        height: 20,
      }),
      createTextField({
        x: 72,
        y: 500,
        pageNumber: 1,
        name: "multi",
        multiline: true,
        width: 200,
        height: 60,
      }),
    ];

    const exportedPdf = await exportFormElements(basePdf, elements);
    const extracted = await extractAcroFormFields(exportedPdf);

    expect(extracted.length).toBe(2);
    const single = extracted.find(
      (el) => el.type === "text" && el.name === "single",
    );
    const multi = extracted.find(
      (el) => el.type === "text" && el.name === "multi",
    );
    expect(single).toBeDefined();
    expect(multi).toBeDefined();
    if (single?.type === "text") {
      expect(single.multiline).toBe(false);
    }
    if (multi?.type === "text") {
      expect(multi.multiline).toBe(true);
    }
  });

  it("preserves text field typography and appearance after round-trip", async () => {
    const basePdf = await createPdfWithTextField();
    const elements: FormElement[] = [
      {
        type: "text",
        id: "el_1",
        x: 72,
        y: 700,
        width: 200,
        height: 24,
        pageNumber: 1,
        name: "styledField",
        defaultValue: "Hello",
        fontSize: 14,
        multiline: false,
        required: false,
        maxLength: undefined,
        textColor: "#cc3300",
        fontFamily: "Helvetica",
        fontWeight: "bold",
        backgroundColor: "#f0f0e0",
        borderColor: "#808080",
        borderWidth: 2,
      },
    ];

    const exportedPdf = await exportFormElements(basePdf, elements);
    const extracted = await extractAcroFormFields(exportedPdf);

    expect(extracted.length).toBe(1);
    const field = extracted[0];
    expect(field.type).toBe("text");
    if (field.type === "text") {
      expect(field.fontSize).toBe(14);
      expect(field.textColor).toBe("#cc3300");
      expect(field.backgroundColor).toBe("#f0f0e0");
      expect(field.borderColor).toBe("#808080");
      expect(field.borderWidth).toBe(2);
    }
  });

  it("preserves dropdown typography and appearance after round-trip", async () => {
    const basePdf = await createPdfWithTextField();
    const elements: FormElement[] = [
      {
        type: "dropdown",
        id: "el_1",
        x: 72,
        y: 700,
        width: 150,
        height: 20,
        pageNumber: 1,
        name: "styledDropdown",
        options: ["A", "B", "C"],
        defaultValue: "",
        fontSize: 11,
        required: false,
        editable: false,
        fontFamily: "Courier",
        fontWeight: "regular",
        textColor: "#0000ff",
        backgroundColor: "#ffffee",
        borderColor: "#000000",
        borderWidth: 1,
      },
    ];

    const exportedPdf = await exportFormElements(basePdf, elements);
    const extracted = await extractAcroFormFields(exportedPdf);

    expect(extracted.length).toBe(1);
    const field = extracted[0];
    expect(field.type).toBe("dropdown");
    if (field.type === "dropdown") {
      expect(field.fontSize).toBe(11);
      expect(field.textColor).toBe("#0000ff");
      expect(field.backgroundColor).toBe("#ffffee");
      expect(field.borderColor).toBe("#000000");
    }
  });

  it("preserves button typography and appearance after round-trip", async () => {
    const basePdf = await createPdfWithTextField();
    const elements: FormElement[] = [
      {
        type: "button",
        id: "el_1",
        x: 72,
        y: 700,
        width: 100,
        height: 28,
        pageNumber: 1,
        name: "styledBtn",
        label: "Click Me",
        fontSize: 16,
        fontFamily: "Helvetica",
        fontWeight: "bold-italic",
        textColor: "#ffffff",
        backgroundColor: "#3366cc",
        borderColor: "#1a3366",
        borderWidth: 2,
      },
    ];

    const exportedPdf = await exportFormElements(basePdf, elements);
    const extracted = await extractAcroFormFields(exportedPdf);

    expect(extracted.length).toBe(1);
    const field = extracted[0];
    expect(field.type).toBe("button");
    if (field.type === "button") {
      expect(field.fontSize).toBe(16);
      expect(field.textColor).toBe("#ffffff");
      expect(field.backgroundColor).toBe("#3366cc");
      expect(field.borderColor).toBe("#1a3366");
      expect(field.borderWidth).toBe(2);
    }
  });

  it("preserves option list typography and appearance after round-trip", async () => {
    const basePdf = await createPdfWithTextField();
    const elements: FormElement[] = [
      {
        type: "optionlist",
        id: "el_1",
        x: 72,
        y: 600,
        width: 150,
        height: 60,
        pageNumber: 1,
        name: "styledList",
        options: ["X", "Y", "Z"],
        defaultValue: "",
        fontSize: 10,
        required: false,
        fontFamily: "Times-Roman",
        fontWeight: "italic",
        textColor: "#333333",
        backgroundColor: "#fafafa",
        borderColor: "#aaaaaa",
        borderWidth: 1,
      },
    ];

    const exportedPdf = await exportFormElements(basePdf, elements);
    const extracted = await extractAcroFormFields(exportedPdf);

    expect(extracted.length).toBe(1);
    const field = extracted[0];
    expect(field.type).toBe("optionlist");
    if (field.type === "optionlist") {
      expect(field.fontSize).toBe(10);
      expect(field.textColor).toBe("#333333");
      expect(field.backgroundColor).toBe("#fafafa");
      expect(field.borderColor).toBe("#aaaaaa");
    }
  });

  it("corrects dimensions for border width on text field round-trip", async () => {
    const basePdf = await createPdfWithTextField();
    const elements: FormElement[] = [
      {
        type: "text",
        id: "el_1",
        x: 100,
        y: 600,
        width: 200,
        height: 5,
        pageNumber: 1,
        name: "bordered",
        defaultValue: "",
        fontSize: 12,
        multiline: false,
        required: false,
        maxLength: undefined,
        textColor: "#000000",
        fontFamily: "Helvetica",
        fontWeight: "regular",
        backgroundColor: null,
        borderColor: "#000000",
        borderWidth: 5,
      },
    ];

    const exportedPdf = await exportFormElements(basePdf, elements);
    const extracted = await extractAcroFormFields(exportedPdf);

    expect(extracted.length).toBe(1);
    const field = extracted[0];
    expect(field.type).toBe("text");
    if (field.type === "text") {
      expect(field.borderWidth).toBe(5);
      expect(field.x).toBeCloseTo(100, 0);
      expect(field.y).toBeCloseTo(600, 0);
      expect(field.width).toBeCloseTo(200, 0);
      expect(field.height).toBeCloseTo(5, 0);
    }
  });

  it("corrects dimensions for border on checkbox round-trip", async () => {
    const basePdf = await createPdfWithTextField();
    const elements: FormElement[] = [
      createCheckbox({
        x: 100,
        y: 700,
        pageNumber: 1,
        name: "cb",
        width: 15,
        height: 15,
      }),
    ];

    const exportedPdf = await exportFormElements(basePdf, elements);
    const extracted = await extractAcroFormFields(exportedPdf);

    expect(extracted.length).toBe(1);
    expect(extracted[0].type).toBe("checkbox");
    if (extracted[0].type === "checkbox") {
      expect(extracted[0].x).toBeCloseTo(100, 0);
      expect(extracted[0].y).toBeCloseTo(700, 0);
      expect(extracted[0].width).toBeCloseTo(15, 0);
      expect(extracted[0].height).toBeCloseTo(15, 0);
    }
  });

  it("corrects dimensions for border on radio button round-trip", async () => {
    const basePdf = await createPdfWithTextField();
    const elements: FormElement[] = [
      createRadioButton({
        x: 100,
        y: 700,
        pageNumber: 1,
        groupName: "grp",
        value: "a",
        width: 12,
        height: 12,
      }),
    ];

    const exportedPdf = await exportFormElements(basePdf, elements);
    const extracted = await extractAcroFormFields(exportedPdf);

    expect(extracted.length).toBe(1);
    expect(extracted[0].type === "radio").toBe(true);
    if (extracted[0].type === "radio") {
      expect(extracted[0].x).toBeCloseTo(100, 0);
      expect(extracted[0].y).toBeCloseTo(700, 0);
      expect(extracted[0].width).toBeCloseTo(12, 0);
      expect(extracted[0].height).toBeCloseTo(12, 0);
    }
  });

  it("corrects dimensions for border on button round-trip", async () => {
    const basePdf = await createPdfWithTextField();
    const elements: FormElement[] = [
      {
        type: "button",
        id: "el_1",
        x: 72,
        y: 700,
        width: 80,
        height: 5,
        pageNumber: 1,
        name: "btn",
        label: "Go",
        fontSize: 12,
        fontFamily: "Helvetica",
        fontWeight: "regular",
        textColor: "#000000",
        backgroundColor: null,
        borderColor: null,
        borderWidth: 4,
      },
    ];

    const exportedPdf = await exportFormElements(basePdf, elements);
    const extracted = await extractAcroFormFields(exportedPdf);

    expect(extracted.length).toBe(1);
    expect(extracted[0].type).toBe("button");
    if (extracted[0].type === "button") {
      expect(extracted[0].width).toBeCloseTo(80, 0);
      expect(extracted[0].height).toBeCloseTo(5, 0);
    }
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
    const pagesTree = reloaded.catalog.lookup(PDFName.of("Pages")) as PDFDict;
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
