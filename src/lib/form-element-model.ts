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
}

export type FormElement = TextField | Checkbox | RadioButton;

let nextId = 1;
function generateId(): string {
  return `el_${nextId++}_${Date.now().toString(36)}`;
}

export function getUniqueName(
  baseName: string,
  existingElements: FormElement[],
): string {
  const existingNames = new Set(
    existingElements.map((el) => ("name" in el ? (el as { name: string }).name : "")),
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
  return {
    type: "text",
    id: generateId(),
    x: opts.x,
    y: opts.y,
    width: opts.width ?? 150,
    height: opts.height ?? 20,
    pageNumber: opts.pageNumber,
    name: opts.name ?? "",
    defaultValue: opts.defaultValue ?? "",
    fontSize: opts.fontSize ?? 12,
    multiline: opts.multiline ?? false,
    required: opts.required ?? false,
    maxLength: opts.maxLength,
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
    width: opts.width ?? 15,
    height: opts.height ?? 15,
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
    width: opts.width ?? 15,
    height: opts.height ?? 15,
    pageNumber: opts.pageNumber,
    groupName: opts.groupName ?? "",
    value: opts.value ?? "",
    label: opts.label ?? "",
  };
}

export function isRadioButton(el: FormElement): el is RadioButton {
  return el.type === "radio";
}
