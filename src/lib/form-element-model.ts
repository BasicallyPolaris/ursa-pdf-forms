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

export type FormElement = TextField;

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


