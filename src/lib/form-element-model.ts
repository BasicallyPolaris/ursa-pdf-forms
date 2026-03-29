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

export interface CheckboxField {
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

export interface RadioField {
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

export type FormElement = TextField | CheckboxField | RadioField;

let nextId = 1;
function generateId(): string {
  return `el_${nextId++}_${Date.now().toString(36)}`;
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

export function isTextField(el: FormElement): el is TextField {
  return el.type === "text";
}

export function isCheckboxField(el: FormElement): el is CheckboxField {
  return el.type === "checkbox";
}

export function isRadioField(el: FormElement): el is RadioField {
  return el.type === "radio";
}

export function validateElement(el: FormElement): string[] {
  const errors: string[] = [];

  if ("name" in el && !el.name) {
    errors.push("name is required");
  }
  if ("groupName" in el && !(el as RadioField).groupName) {
    errors.push("groupName is required");
  }
  if (el.pageNumber < 1) {
    errors.push("pageNumber must be >= 1");
  }
  if (el.width <= 0) {
    errors.push("width must be > 0");
  }
  if (el.height <= 0) {
    errors.push("height must be > 0");
  }

  return errors;
}
