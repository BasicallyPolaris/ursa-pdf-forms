import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFPage,
  PDFRef,
  PDFOperator,
  rgb,
  StandardFonts,
  degrees,
  drawCheckBox,
  drawRadioButton,
  drawCheckMark,
  drawEllipse,
  drawRectangle,
  pushGraphicsState,
  popGraphicsState,
  moveTo,
  lineTo,
  closePath,
  fill,
  stroke,
  setFillingColor,
  setStrokingColor,
  setLineWidth,
} from "pdf-lib";
import type { PDFCheckBox, PDFRadioGroup } from "pdf-lib";
import type { Color } from "pdf-lib";

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
  FillStyle,
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

function drawFillMark(
  fillStyle: FillStyle,
  cx: number,
  cy: number,
  size: number,
  markColor: Color,
): PDFOperator[] {
  const half = size / 2;
  switch (fillStyle) {
    case "checkmark":
      return drawCheckMark({
        x: cx,
        y: cy,
        size: half,
        thickness: Math.max(0.5, size * 0.08),
        color: markColor,
      });
    case "circle":
      return drawEllipse({
        x: cx,
        y: cy,
        xScale: half * 0.5,
        yScale: half * 0.5,
        color: markColor,
        borderColor: undefined,
        borderWidth: 0,
      });
    case "cross": {
      const arm = half * 0.65;
      return [
        pushGraphicsState(),
        setStrokingColor(markColor),
        setLineWidth(Math.max(0.5, size * 0.08)),
        moveTo(cx - arm, cy - arm),
        lineTo(cx + arm, cy + arm),
        moveTo(cx + arm, cy - arm),
        lineTo(cx - arm, cy + arm),
        stroke(),
        popGraphicsState(),
      ];
    }
    case "diamond": {
      const d = half * 0.6;
      return [
        pushGraphicsState(),
        setFillingColor(markColor),
        moveTo(cx, cy + d),
        lineTo(cx + d, cy),
        lineTo(cx, cy - d),
        lineTo(cx - d, cy),
        closePath(),
        fill(),
        popGraphicsState(),
      ];
    }
    case "star": {
      const outer = half * 0.7;
      const inner = half * 0.3;
      const ops: PDFOperator[] = [
        pushGraphicsState(),
        setFillingColor(markColor),
        moveTo(cx, cy + outer),
      ];
      for (let i = 0; i < 5; i++) {
        const innerAngle = Math.PI / 2 + ((2 * i + 1) * Math.PI) / 5;
        const outerAngle = Math.PI / 2 + ((2 * i + 2) * Math.PI) / 5;
        ops.push(
          lineTo(cx + inner * Math.cos(innerAngle), cy + inner * Math.sin(innerAngle)),
          lineTo(cx + outer * Math.cos(outerAngle), cy + outer * Math.sin(outerAngle)),
        );
      }
      ops.push(closePath(), fill(), popGraphicsState());
      return ops;
    }
    default:
      return drawCheckMark({
        x: cx,
        y: cy,
        size: half,
        thickness: Math.max(0.5, size * 0.08),
        color: markColor,
      });
  }
}

interface WidgetLike {
  getRectangle: () => { width: number; height: number };
  getAppearanceCharacteristics: () => {
    getBackgroundColor: () => number[] | undefined;
    getBorderColor: () => number[] | undefined;
  } | null;
  getBorderStyle: () => { getWidth: () => number } | null;
}

function readWidgetStyle(widget: WidgetLike) {
  const rectangle = widget.getRectangle();
  const ap = widget.getAppearanceCharacteristics();
  const bs = widget.getBorderStyle();
  const borderWidth = bs?.getWidth() ?? 0;
  const width = rectangle.width;
  const height = rectangle.height;
  const black = rgb(0, 0, 0);
  const rawBorder = ap?.getBorderColor();
  const borderColor = rawBorder
    ? rgb(rawBorder[0] / 255, rawBorder[1] / 255, rawBorder[2] / 255)
    : black;
  const rawBg = ap?.getBackgroundColor();
  const backgroundColor = rawBg
    ? rgb(rawBg[0] / 255, rawBg[1] / 255, rawBg[2] / 255)
    : undefined;
  const downBackgroundColor = rawBg
    ? rgb((rawBg[0] / 255) * 0.8, (rawBg[1] / 255) * 0.8, (rawBg[2] / 255) * 0.8)
    : undefined;
  return { width, height, borderWidth, borderColor, backgroundColor, downBackgroundColor, markColor: black };
}

function rectBox(
  x: number,
  y: number,
  w: number,
  h: number,
  borderWidth: number,
  color: Color | undefined,
  borderColor: Color,
) {
  return drawRectangle({
    x, y, width: w, height: h,
    borderWidth,
    color,
    borderColor,
    rotate: degrees(0),
    xSkew: degrees(0),
    ySkew: degrees(0),
  });
}

function makeCheckBoxAppearanceProvider(fillStyle: FillStyle) {
  return (_field: PDFCheckBox, widget: WidgetLike) => {
    const s = readWidgetStyle(widget);
    const x = s.borderWidth / 2;
    const y = s.borderWidth / 2;
    const w = s.width - s.borderWidth;
    const h = s.height - s.borderWidth;
    const markCx = x + w / 2;
    const markCy = y + h / 2;
    const markSize = Math.min(w, h) * 0.5;

    if (fillStyle === "checkmark") {
      const opts = { x, y, width: w, height: h, borderWidth: s.borderWidth, borderColor: s.borderColor, color: s.backgroundColor, thickness: Math.max(0.5, Math.min(w, h) * 0.08), markColor: s.markColor };
      return {
        normal: {
          on: [...drawCheckBox({ ...opts, filled: true })],
          off: [...drawCheckBox({ ...opts, filled: false })],
        },
        down: {
          on: [...drawCheckBox({ ...opts, color: s.downBackgroundColor, filled: true })],
          off: [...drawCheckBox({ ...opts, color: s.downBackgroundColor, filled: false })],
        },
      };
    }

    return {
      normal: {
        on: [pushGraphicsState(), ...rectBox(x, y, w, h, s.borderWidth, s.backgroundColor, s.borderColor), ...drawFillMark(fillStyle, markCx, markCy, markSize, s.markColor), popGraphicsState()],
        off: [pushGraphicsState(), ...rectBox(x, y, w, h, s.borderWidth, s.backgroundColor, s.borderColor), popGraphicsState()],
      },
      down: {
        on: [pushGraphicsState(), ...rectBox(x, y, w, h, s.borderWidth, s.downBackgroundColor, s.borderColor), ...drawFillMark(fillStyle, markCx, markCy, markSize, s.markColor), popGraphicsState()],
        off: [pushGraphicsState(), ...rectBox(x, y, w, h, s.borderWidth, s.downBackgroundColor, s.borderColor), popGraphicsState()],
      },
    };
  };
}

function makeRadioGroupAppearanceProvider(fillStyle: FillStyle) {
  return (_field: PDFRadioGroup, widget: WidgetLike) => {
    const s = readWidgetStyle(widget);
    const cx = s.width / 2;
    const cy = s.height / 2;
    const outerScale = Math.min(s.width, s.height) / 2;
    const markSize = Math.min(s.width, s.height) * 0.5;

    if (fillStyle === "circle") {
      const opts = { x: cx, y: cy, width: s.width - s.borderWidth, height: s.height - s.borderWidth, borderWidth: s.borderWidth, borderColor: s.borderColor, color: s.backgroundColor, dotColor: s.markColor };
      return {
        normal: {
          on: [...drawRadioButton({ ...opts, filled: true })],
          off: [...drawRadioButton({ ...opts, filled: false })],
        },
        down: {
          on: [...drawRadioButton({ ...opts, color: s.downBackgroundColor, filled: true })],
          off: [...drawRadioButton({ ...opts, color: s.downBackgroundColor, filled: false })],
        },
      };
    }

    return {
      normal: {
        on: [pushGraphicsState(), ...drawEllipse({ x: cx, y: cy, xScale: outerScale, yScale: outerScale, color: s.backgroundColor, borderColor: s.borderColor, borderWidth: s.borderWidth }), ...drawFillMark(fillStyle, cx, cy, markSize, s.markColor), popGraphicsState()],
        off: [pushGraphicsState(), ...drawEllipse({ x: cx, y: cy, xScale: outerScale, yScale: outerScale, color: s.backgroundColor, borderColor: s.borderColor, borderWidth: s.borderWidth }), popGraphicsState()],
      },
      down: {
        on: [pushGraphicsState(), ...drawEllipse({ x: cx, y: cy, xScale: outerScale, yScale: outerScale, color: s.downBackgroundColor, borderColor: s.borderColor, borderWidth: s.borderWidth }), ...drawFillMark(fillStyle, cx, cy, markSize, s.markColor), popGraphicsState()],
        off: [pushGraphicsState(), ...drawEllipse({ x: cx, y: cy, xScale: outerScale, yScale: outerScale, color: s.downBackgroundColor, borderColor: s.borderColor, borderWidth: s.borderWidth }), popGraphicsState()],
      },
    };
  };
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
      case "dropdown":
        addDropdownField(form, page, { ...el, name: safeName }, pageHeight, pdf);
        break;
      case "button":
        addButtonField(form, page, { ...el, name: safeName }, pageHeight, pdf);
        break;
      case "optionlist":
        addOptionListField(form, page, { ...el, name: safeName }, pageHeight, pdf);
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

    const nonCircleStyle = radios.find((r) => r.fillStyle !== "circle")?.fillStyle;
    if (nonCircleStyle) {
      const provider = makeRadioGroupAppearanceProvider(nonCircleStyle);
      radioGroup.updateAppearances(
        provider as Parameters<typeof radioGroup.updateAppearances>[0],
      );
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
  const font = embedStandardFont(pdfDoc, resolvedFont);

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

  field.updateAppearances(font);
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

  if (el.fillStyle !== "checkmark") {
    const provider = makeCheckBoxAppearanceProvider(el.fillStyle);
    field.updateAppearances(
      provider as Parameters<typeof field.updateAppearances>[0],
    );
  }
}

function addDropdownField(
  form: ReturnType<PDFDocument["getForm"]>,
  page: PDFPage,
  el: DropdownField & { name: string },
  pageHeight: number,
  pdfDoc: PDFDocument,
): void {
  const field = form.createDropdown(el.name);
  const pdfY = pageHeight - el.y - el.height;

  const resolvedFont = resolveFontFamily(el.fontFamily, el.fontWeight);
  const font = embedStandardFont(pdfDoc, resolvedFont);

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
  pageHeight: number,
  pdfDoc: PDFDocument,
): void {
  const field = form.createButton(el.name);
  const pdfY = pageHeight - el.y - el.height;

  const resolvedFont = resolveFontFamily(el.fontFamily, el.fontWeight);
  const font = embedStandardFont(pdfDoc, resolvedFont);

  const textColor = el.textColor ? hexToRgb(el.textColor) : undefined;
  const backgroundColor = el.backgroundColor ? hexToRgb(el.backgroundColor) : undefined;
  const borderColor = el.borderColor ? hexToRgb(el.borderColor) : undefined;

  field.addToPage(el.label, page, {
    x: el.x,
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
  pageHeight: number,
  pdfDoc: PDFDocument,
): void {
  const field = form.createOptionList(el.name);
  const pdfY = pageHeight - el.y - el.height;

  const resolvedFont = resolveFontFamily(el.fontFamily, el.fontWeight);
  const font = embedStandardFont(pdfDoc, resolvedFont);

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
