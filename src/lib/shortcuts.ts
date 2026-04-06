export type ShortcutId =
  | "open"
  | "export"
  | "undo"
  | "redo"
  | "redoAlt"
  | "copy"
  | "paste"
  | "cut"
  | "duplicate"
  | "selectAll"
  | "delete"
  | "deselect"
  | "toolSelect"
  | "toolInput"
  | "toolTextarea"
  | "toolCheckbox"
  | "toolRadio"
  | "toolDropdown"
  | "toolButton"
  | "toolOptionList"
  | "zoomIn"
  | "zoomOut"
  | "zoomFit"
  | "zoom100"
  | "nudge"
  | "nudge5";

export type ShortcutGroup = "file" | "edit" | "tools" | "view";

export interface ShortcutDef {
  id: ShortcutId;
  i18nKey: string;
  group: ShortcutGroup;
  mod?: boolean;
  shift?: boolean;
  key: string;
}

const isMac =
  typeof navigator !== "undefined" &&
  (navigator.platform?.toUpperCase().includes("MAC") ??
    navigator.userAgent?.toUpperCase().includes("MAC") ??
    false);

export const modSymbol = isMac ? "⌘" : "Ctrl";
export const shiftSymbol = isMac ? "⇧" : "Shift";

export const SHORTCUTS: ShortcutDef[] = [
  { id: "open", i18nKey: "shortcuts.open", group: "file", mod: true, key: "o" },
  {
    id: "export",
    i18nKey: "shortcuts.export",
    group: "file",
    mod: true,
    key: "e",
  },
  { id: "undo", i18nKey: "shortcuts.undo", group: "edit", mod: true, key: "z" },
  {
    id: "redo",
    i18nKey: "shortcuts.redo",
    group: "edit",
    mod: true,
    shift: true,
    key: "z",
  },
  {
    id: "redoAlt",
    i18nKey: "shortcuts.redo",
    group: "edit",
    mod: true,
    key: "y",
  },
  { id: "copy", i18nKey: "shortcuts.copy", group: "edit", mod: true, key: "c" },
  {
    id: "paste",
    i18nKey: "shortcuts.paste",
    group: "edit",
    mod: true,
    key: "v",
  },
  { id: "cut", i18nKey: "shortcuts.cut", group: "edit", mod: true, key: "x" },
  {
    id: "duplicate",
    i18nKey: "shortcuts.duplicate",
    group: "edit",
    mod: true,
    key: "d",
  },
  {
    id: "selectAll",
    i18nKey: "shortcuts.selectAll",
    group: "edit",
    mod: true,
    key: "a",
  },
  { id: "delete", i18nKey: "shortcuts.delete", group: "edit", key: "Del" },
  { id: "deselect", i18nKey: "shortcuts.deselect", group: "edit", key: "Esc" },
  {
    id: "toolSelect",
    i18nKey: "shortcuts.toolSelect",
    group: "tools",
    key: "v",
  },
  { id: "toolInput", i18nKey: "shortcuts.toolInput", group: "tools", key: "t" },
  {
    id: "toolTextarea",
    i18nKey: "shortcuts.toolTextarea",
    group: "tools",
    shift: true,
    key: "t",
  },
  {
    id: "toolCheckbox",
    i18nKey: "shortcuts.toolCheckbox",
    group: "tools",
    key: "c",
  },
  { id: "toolRadio", i18nKey: "shortcuts.toolRadio", group: "tools", key: "r" },
  {
    id: "toolDropdown",
    i18nKey: "shortcuts.toolDropdown",
    group: "tools",
    key: "d",
  },
  {
    id: "toolButton",
    i18nKey: "shortcuts.toolButton",
    group: "tools",
    key: "b",
  },
  {
    id: "toolOptionList",
    i18nKey: "shortcuts.toolOptionList",
    group: "tools",
    shift: true,
    key: "o",
  },
  {
    id: "zoomIn",
    i18nKey: "shortcuts.zoomIn",
    group: "view",
    mod: true,
    key: "+",
  },
  {
    id: "zoomOut",
    i18nKey: "shortcuts.zoomOut",
    group: "view",
    mod: true,
    key: "-",
  },
  {
    id: "zoomFit",
    i18nKey: "shortcuts.zoomFit",
    group: "view",
    mod: true,
    key: "0",
  },
  {
    id: "zoom100",
    i18nKey: "shortcuts.zoom100",
    group: "view",
    mod: true,
    key: "1",
  },
  { id: "nudge", i18nKey: "shortcuts.nudge", group: "view", key: "Arrow" },
  {
    id: "nudge5",
    i18nKey: "shortcuts.nudge5",
    group: "view",
    shift: true,
    key: "Arrow",
  },
];

const shortcutMap = new Map(SHORTCUTS.map((s) => [s.id, s]));

export function getShortcut(id: ShortcutId): ShortcutDef | undefined {
  return shortcutMap.get(id);
}

export function formatShortcut(id: ShortcutId): string {
  const s = shortcutMap.get(id);
  if (!s) return "";
  const parts: string[] = [];
  if (s.mod) parts.push(modSymbol);
  if (s.shift) parts.push(shiftSymbol);
  parts.push(s.key.length === 1 ? s.key.toUpperCase() : s.key);
  return parts.join(isMac ? "" : "+");
}

export function formatShortcutParts(id: ShortcutId): string[] {
  const s = shortcutMap.get(id);
  if (!s) return [];
  const parts: string[] = [];
  if (s.mod) parts.push(modSymbol);
  if (s.shift) parts.push(shiftSymbol);
  parts.push(s.key.length === 1 ? s.key.toUpperCase() : s.key);
  return parts;
}

export function getShortcutsByGroup(group: ShortcutGroup): ShortcutDef[] {
  return SHORTCUTS.filter((s) => s.group === group);
}

export const TOOL_SHORTCUT_MAP: Record<string, ShortcutId> = {
  select: "toolSelect",
  input: "toolInput",
  textarea: "toolTextarea",
  checkbox: "toolCheckbox",
  radio: "toolRadio",
  dropdown: "toolDropdown",
  button: "toolButton",
  optionlist: "toolOptionList",
};
