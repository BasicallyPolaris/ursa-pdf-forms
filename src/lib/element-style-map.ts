import i18n from "@/i18n";
import type { FormElement } from "@/lib/form-element-model";
import type { LucideIcon } from "lucide-react";
import {
  AlignLeft,
  CircleDot,
  ChevronDown,
  MousePointerSquare,
  List,
  PenLine,
  Square,
  Type,
} from "lucide-react";

export interface ElementStyleConfig {
  labelKey: string;
  icon: LucideIcon;
  colorClass: string;
  borderClass: string;
  borderBgClass: (selected: boolean) => string;
  dimBorderClass: string;
  textColorClass: string;
  drawPreviewClass: string;
}

const CONFIGS: Record<string, ElementStyleConfig> = {
  text: {
    labelKey: "fieldTypes.textField",
    icon: Type,
    colorClass: "text-field-text",
    borderClass: "border-field-text/30",
    borderBgClass: (selected) =>
      selected
        ? "border-2 border-field-text bg-field-text-bg"
        : "border border-field-text-dim bg-field-text-bg",
    dimBorderClass: "border-field-text-dim",
    textColorClass: "text-field-text",
    drawPreviewClass: "border-2 border-field-text/60 bg-field-text-bg",
  },
  checkbox: {
    labelKey: "fieldTypes.checkbox",
    icon: Square,
    colorClass: "text-field-checkbox",
    borderClass: "border-field-checkbox/30",
    borderBgClass: (selected) =>
      selected
        ? "border-2 border-field-checkbox bg-field-checkbox-bg"
        : "border border-field-checkbox-dim bg-field-checkbox-bg",
    dimBorderClass: "border-field-checkbox-dim",
    textColorClass: "text-field-checkbox",
    drawPreviewClass: "border-2 border-field-checkbox/60 bg-field-checkbox-bg",
  },
  radio: {
    labelKey: "fieldTypes.radioButton",
    icon: CircleDot,
    colorClass: "text-field-radio",
    borderClass: "border-field-radio/30",
    borderBgClass: (selected) =>
      selected
        ? "border-2 border-field-radio bg-field-radio-bg"
        : "border border-field-radio-dim bg-field-radio-bg",
    dimBorderClass: "border-field-radio-dim",
    textColorClass: "text-field-radio",
    drawPreviewClass: "border-2 border-field-radio/60 bg-field-radio-bg",
  },
  multiline: {
    labelKey: "fieldTypes.multiline",
    icon: AlignLeft,
    colorClass: "text-field-multiline",
    borderClass: "border-field-multiline/30",
    borderBgClass: (selected) =>
      selected
        ? "border-2 border-field-multiline bg-field-multiline-bg"
        : "border border-field-multiline-dim bg-field-multiline-bg",
    dimBorderClass: "border-field-multiline-dim",
    textColorClass: "text-field-multiline",
    drawPreviewClass:
      "border-2 border-field-multiline/60 bg-field-multiline-bg",
  },
  dropdown: {
    labelKey: "fieldTypes.dropdown",
    icon: ChevronDown,
    colorClass: "text-field-dropdown",
    borderClass: "border-field-dropdown/30",
    borderBgClass: (selected) =>
      selected
        ? "border-2 border-field-dropdown bg-field-dropdown-bg"
        : "border border-field-dropdown-dim bg-field-dropdown-bg",
    dimBorderClass: "border-field-dropdown-dim",
    textColorClass: "text-field-dropdown",
    drawPreviewClass:
      "border-2 border-field-dropdown/60 bg-field-dropdown-bg",
  },
  button: {
    labelKey: "fieldTypes.button",
    icon: MousePointerSquare,
    colorClass: "text-field-button",
    borderClass: "border-field-button/30",
    borderBgClass: (selected) =>
      selected
        ? "border-2 border-field-button bg-field-button-bg"
        : "border border-field-button-dim bg-field-button-bg",
    dimBorderClass: "border-field-button-dim",
    textColorClass: "text-field-button",
    drawPreviewClass:
      "border-2 border-field-button/60 bg-field-button-bg",
  },
  optionlist: {
    labelKey: "fieldTypes.optionlist",
    icon: List,
    colorClass: "text-field-optionlist",
    borderClass: "border-field-optionlist/30",
    borderBgClass: (selected) =>
      selected
        ? "border-2 border-field-optionlist bg-field-optionlist-bg"
        : "border border-field-optionlist-dim bg-field-optionlist-bg",
    dimBorderClass: "border-field-optionlist-dim",
    textColorClass: "text-field-optionlist",
    drawPreviewClass:
      "border-2 border-field-optionlist/60 bg-field-optionlist-bg",
  },
  signature: {
    labelKey: "fieldTypes.signature",
    icon: PenLine,
    colorClass: "text-field-signature",
    borderClass: "border-field-signature/30",
    borderBgClass: (selected) =>
      selected
        ? "border-2 border-field-signature bg-field-signature-bg"
        : "border border-field-signature-dim bg-field-signature-bg",
    dimBorderClass: "border-field-signature-dim",
    textColorClass: "text-field-signature",
    drawPreviewClass:
      "border-2 border-field-signature/60 bg-field-signature-bg",
  },
};

export function getElementStyleConfig(
  element: FormElement,
): ElementStyleConfig {
  if (element.type === "text" && "multiline" in element && element.multiline) {
    return CONFIGS.multiline;
  }
  return CONFIGS[element.type] ?? CONFIGS.text;
}

export function getElementStyleConfigByType(
  type: string,
): ElementStyleConfig | undefined {
  return CONFIGS[type];
}

export function getFieldTypeLabel(config: ElementStyleConfig): string {
  return i18n.t(config.labelKey);
}
