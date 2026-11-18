import type { FormElement } from "@/lib/form-element-model";

export function getFieldsInTabOrder<T extends FormElement>(elements: T[]): T[] {
  const radioGroups = new Map<string, number>();
  return elements
    .map((element) => {
      let radioGroup = -1;
      if (element.type === "radio") {
        const group = element.groupName || `group_${element.id}`;
        if (!radioGroups.has(group)) radioGroups.set(group, radioGroups.size);
        radioGroup = radioGroups.get(group)!;
      }
      return { element, radioGroup };
    })
    .sort((a, b) => {
      const aOrder = a.element.tabOrder ?? Infinity;
      const bOrder = b.element.tabOrder ?? Infinity;
      return aOrder === bOrder ? a.radioGroup - b.radioGroup : aOrder - bOrder;
    })
    .map(({ element }) => element);
}
