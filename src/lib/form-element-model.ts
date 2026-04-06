export interface TextField {
  type: "text";
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  name: string;
  defaultValue: string;
  fontSize: number;
  multiline: boolean;
  required: boolean;
  maxLength: number | undefined;
  textColor: string;
  fontFamily: string;
  fontWeight: "regular" | "bold" | "italic" | "bold-italic";
  backgroundColor: string | null;
  borderColor: string | null;
  borderWidth: number;
}

export interface Checkbox {
  type: "checkbox";
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  name: string;
  defaultChecked: boolean;
}

export interface RadioButton {
  type: "radio";
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  groupName: string;
  value: string;
  label: string;
  fillStyle: "circle" | "checkmark" | "cross" | "star" | "diamond";
}

export interface DropdownField {
  type: "dropdown";
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  name: string;
  options: string[];
  defaultValue: string;
  fontSize: number;
  required: boolean;
  editable: boolean;
}

export interface ButtonField {
  type: "button";
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  name: string;
  label: string;
  fontSize: number;
}

export interface OptionListField {
  type: "optionlist";
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  name: string;
  options: string[];
  defaultValue: string;
  fontSize: number;
  required: boolean;
}

export interface SignatureField {
  type: "signature";
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  name: string;
}

export type FormElement =
  | TextField
  | Checkbox
  | RadioButton
  | DropdownField
  | ButtonField
  | OptionListField
  | SignatureField;

let nextId = 1;
function generateId(): string {
  return `el_${nextId++}_${Date.now().toString(36)}`;
}

export function heightFromFontSize(fontSize: number): number {
  const safe = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 12;
  return Math.round(safe * 1.2 * 2) / 2;
}

function safePositive(value: number | undefined, fallback: number): number {
  if (value == null) return fallback;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getUniqueName(
  baseName: string,
  existingElements: FormElement[],
): string {
  const existingNames = new Set(
    existingElements.map((el) =>
      "name" in el ? (el as { name: string }).name : "",
    ),
  );
  const match = baseName.match(/^(.*?)(\d+)$/);
  if (match) {
    const prefix = match[1];
    let num = parseInt(match[2], 10);
    while (existingNames.has(`${prefix}${num}`)) {
      num++;
    }
    return `${prefix}${num}`;
  }
  if (!existingNames.has(baseName)) return baseName;
  let i = 2;
  while (existingNames.has(`${baseName}_${i}`)) {
    i++;
  }
  return `${baseName}_${i}`;
}

interface TextFieldOptions {
  x: number;
  y: number;
  pageNumber: number;
  name?: string;
  defaultValue?: string;
  fontSize?: number;
  multiline?: boolean;
  required?: boolean;
  maxLength?: number;
  width?: number;
  height?: number;
}

export function createTextField(opts: TextFieldOptions): TextField {
  const rawFontSize = opts.fontSize ?? 12;
  const fontSize =
    Number.isFinite(rawFontSize) && rawFontSize > 0 ? rawFontSize : 12;
  const multiline = opts.multiline ?? false;
  return {
    type: "text",
    id: generateId(),
    x: opts.x,
    y: opts.y,
    width: safePositive(opts.width, 150),
    height: safePositive(
      opts.height,
      multiline ? 60 : heightFromFontSize(fontSize),
    ),
    pageNumber: opts.pageNumber,
    name: opts.name ?? "",
    defaultValue: opts.defaultValue ?? "",
    fontSize,
    multiline,
    required: opts.required ?? false,
    maxLength: opts.maxLength,
    textColor: "#000000",
    fontFamily: "Helvetica",
    fontWeight: "regular" as const,
    backgroundColor: null,
    borderColor: null,
    borderWidth: 1,
  };
}

interface CheckboxOptions {
  x: number;
  y: number;
  pageNumber: number;
  name?: string;
  defaultChecked?: boolean;
  width?: number;
  height?: number;
}

export function createCheckbox(opts: CheckboxOptions): Checkbox {
  return {
    type: "checkbox",
    id: generateId(),
    x: opts.x,
    y: opts.y,
    width: safePositive(opts.width, 15),
    height: safePositive(opts.height, 15),
    pageNumber: opts.pageNumber,
    name: opts.name ?? "",
    defaultChecked: opts.defaultChecked ?? false,
  };
}

export function isTextField(el: FormElement): el is TextField {
  return el.type === "text";
}

export function isCheckbox(el: FormElement): el is Checkbox {
  return el.type === "checkbox";
}

interface RadioButtonOptions {
  x: number;
  y: number;
  pageNumber: number;
  groupName?: string;
  value?: string;
  label?: string;
  width?: number;
  height?: number;
}

export function createRadioButton(opts: RadioButtonOptions): RadioButton {
  return {
    type: "radio",
    id: generateId(),
    x: opts.x,
    y: opts.y,
    width: safePositive(opts.width, 15),
    height: safePositive(opts.height, 15),
    pageNumber: opts.pageNumber,
    groupName: opts.groupName ?? "",
    value: opts.value ?? "",
    label: opts.label ?? "",
    fillStyle: "circle",
  };
}

export function isRadioButton(el: FormElement): el is RadioButton {
  return el.type === "radio";
}

interface DropdownFieldOptions {
  x: number;
  y: number;
  pageNumber: number;
  name?: string;
  options?: string[];
  defaultValue?: string;
  fontSize?: number;
  required?: boolean;
  editable?: boolean;
  width?: number;
  height?: number;
}

export function createDropdownField(opts: DropdownFieldOptions): DropdownField {
  const fontSize = opts.fontSize ?? 12;
  return {
    type: "dropdown",
    id: generateId(),
    x: opts.x,
    y: opts.y,
    width: safePositive(opts.width, 150),
    height: safePositive(opts.height, heightFromFontSize(fontSize)),
    pageNumber: opts.pageNumber,
    name: opts.name ?? "",
    options: opts.options ?? ["Option 1", "Option 2"],
    defaultValue: opts.defaultValue ?? "",
    fontSize,
    required: opts.required ?? false,
    editable: opts.editable ?? false,
  };
}

export function isDropdownField(el: FormElement): el is DropdownField {
  return el.type === "dropdown";
}

interface ButtonFieldOptions {
  x: number;
  y: number;
  pageNumber: number;
  name?: string;
  label?: string;
  fontSize?: number;
  width?: number;
  height?: number;
}

export function createButtonField(opts: ButtonFieldOptions): ButtonField {
  const fontSize = opts.fontSize ?? 12;
  return {
    type: "button",
    id: generateId(),
    x: opts.x,
    y: opts.y,
    width: safePositive(opts.width, 80),
    height: safePositive(opts.height, heightFromFontSize(fontSize)),
    pageNumber: opts.pageNumber,
    name: opts.name ?? "",
    label: opts.label ?? "Button",
    fontSize,
  };
}

export function isButtonField(el: FormElement): el is ButtonField {
  return el.type === "button";
}

interface OptionListFieldOptions {
  x: number;
  y: number;
  pageNumber: number;
  name?: string;
  options?: string[];
  defaultValue?: string;
  fontSize?: number;
  required?: boolean;
  width?: number;
  height?: number;
}

export function createOptionListField(opts: OptionListFieldOptions): OptionListField {
  return {
    type: "optionlist",
    id: generateId(),
    x: opts.x,
    y: opts.y,
    width: safePositive(opts.width, 150),
    height: safePositive(opts.height, 80),
    pageNumber: opts.pageNumber,
    name: opts.name ?? "",
    options: opts.options ?? ["Option 1", "Option 2"],
    defaultValue: opts.defaultValue ?? "",
    fontSize: opts.fontSize ?? 12,
    required: opts.required ?? false,
  };
}

export function isOptionListField(el: FormElement): el is OptionListField {
  return el.type === "optionlist";
}

interface SignatureFieldOptions {
  x: number;
  y: number;
  pageNumber: number;
  name?: string;
  width?: number;
  height?: number;
}

export function createSignatureField(opts: SignatureFieldOptions): SignatureField {
  return {
    type: "signature",
    id: generateId(),
    x: opts.x,
    y: opts.y,
    width: safePositive(opts.width, 150),
    height: safePositive(opts.height, 40),
    pageNumber: opts.pageNumber,
    name: opts.name ?? "",
  };
}

export function isSignatureField(el: FormElement): el is SignatureField {
  return el.type === "signature";
}

export function sanitizeNumericValue(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
  return num;
}

export function getElementName(el: FormElement): string {
  if (el.type === "radio" && "groupName" in el)
    return (el as RadioButton).groupName || (el as RadioButton).value;
  if ("name" in el) return (el as { name: string }).name;
  return "";
}

export function validateElementForExport(elements: FormElement[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const names = new Map<string, number>();
  const radioGroupNames = new Set<string>();

  for (const el of elements) {
    if (el.type === "radio") {
      const radio = el as RadioButton;
      if (!radio.groupName || radio.groupName.trim() === "") {
        errors.push("empty-group-name");
      } else {
        radioGroupNames.add(radio.groupName);
      }
      if (!radio.value || radio.value.trim() === "") {
        errors.push("empty-radio-value");
      }
      continue;
    }

    const name = getElementName(el);
    if (!name || name.trim() === "") {
      errors.push("empty-name");
    } else {
      const count = names.get(name) ?? 0;
      names.set(name, count + 1);
    }
  }

  for (const [, count] of names) {
    if (count > 1) {
      errors.push("duplicate-name");
      break;
    }
  }

  return { valid: errors.length === 0, errors };
}
