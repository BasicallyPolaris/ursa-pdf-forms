import type { FormElement } from "@/lib/form-element-model";
import {
  Type,
  Square,
  CircleDot,
  AlignLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ElementStyleConfig {
  label: string;
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
    label: "Text Field",
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
    label: "Checkbox",
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
    label: "Radio Button",
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
    label: "Multiline",
    icon: AlignLeft,
    colorClass: "text-field-multiline",
    borderClass: "border-field-multiline/30",
    borderBgClass: (selected) =>
      selected
        ? "border-2 border-field-multiline bg-field-multiline-bg"
        : "border border-field-multiline-dim bg-field-multiline-bg",
    dimBorderClass: "border-field-multiline-dim",
    textColorClass: "text-field-multiline",
    drawPreviewClass: "border-2 border-field-multiline/60 bg-field-multiline-bg",
  },
};

export function getElementStyleConfig(
  element: FormElement
): ElementStyleConfig {
  if (element.type === "text" && "multiline" in element && element.multiline) {
    return CONFIGS.multiline;
  }
  return CONFIGS[element.type] ?? CONFIGS.text;
}

export function getElementStyleConfigByType(
  type: string
): ElementStyleConfig | undefined {
  return CONFIGS[type];
}
