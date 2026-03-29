import { useEditorStore } from "@/stores/editor-store";
import {
  isTextField,
  isCheckbox,
  isRadioButton,
  type TextField,
  type RadioButton,
} from "@/lib/form-element-model";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

function PropertyField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function TextFieldProperties({ elementId }: { elementId: string }) {
  const element = useEditorStore((s) =>
    s.elements.find((el) => el.id === elementId),
  );
  const updateElement = useEditorStore((s) => s.updateElement);

  if (!element || !isTextField(element)) return null;

  return (
    <div className="flex flex-col gap-3">
      <PropertyField label="Name">
        <Input
          value={element.name}
          onChange={(e) => updateElement(element.id, { name: e.target.value })}
          className="h-7 text-xs"
        />
      </PropertyField>

      <PropertyField label="Default Value">
        <Input
          value={element.defaultValue}
          onChange={(e) =>
            updateElement(element.id, { defaultValue: e.target.value })
          }
          className="h-7 text-xs"
        />
      </PropertyField>

      <PropertyField label="Font Size">
        <Input
          type="number"
          value={element.fontSize}
          onChange={(e) =>
            updateElement(element.id, { fontSize: Number(e.target.value) })
          }
          className="h-7 text-xs"
        />
      </PropertyField>

      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Multiline</Label>
        <Switch
          checked={element.multiline}
          onCheckedChange={(checked) =>
            updateElement(element.id, { multiline: checked })
          }
        />
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Required</Label>
        <Switch
          checked={element.required}
          onCheckedChange={(checked) =>
            updateElement(element.id, { required: checked })
          }
        />
      </div>

      <PropertyField label="Max Length">
        <Input
          type="number"
          value={element.maxLength ?? ""}
          onChange={(e) =>
            updateElement(element.id, {
              maxLength: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          placeholder="No limit"
          className="h-7 text-xs"
        />
      </PropertyField>

      <Separator />

      <PropertyField label="Width">
        <Input
          type="number"
          value={Math.round(element.width)}
          onChange={(e) =>
            updateElement(element.id, { fontSize: Number(e.target.value) })
          }
          className="h-7 text-xs"
        />
      </PropertyField>

      <PropertyField label="Height">
        <Input
          type="number"
          value={Math.round(element.height)}
          onChange={(e) =>
            updateElement(element.id, {
              height: Number(e.target.value),
            })
          }
          className="h-7 text-xs"
        />
      </PropertyField>

      <PropertyField label="X">
        <Input
          type="number"
          value={Math.round(element.x)}
          onChange={(e) =>
            updateElement(element.id, { x: Number(e.target.value) })
          }
          className="h-7 text-xs"
        />
      </PropertyField>

      <PropertyField label="Y">
        <Input
          type="number"
          value={Math.round(element.y)}
          onChange={(e) =>
            updateElement(element.id, { y: Number(e.target.value) })
          }
          className="h-7 text-xs"
        />
      </PropertyField>
    </div>
  );
}

function CheckboxProperties({ elementId }: { elementId: string }) {
  const element = useEditorStore((s) =>
    s.elements.find((el) => el.id === elementId),
  );
  const updateElement = useEditorStore((s) => s.updateElement);

  if (!element || !isCheckbox(element)) return null;

  return (
    <div className="flex flex-col gap-3">
      <PropertyField label="Name">
        <Input
          value={element.name}
          onChange={(e) => updateElement(element.id, { name: e.target.value })}
          className="h-7 text-xs"
        />
      </PropertyField>

      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Default Checked</Label>
        <Switch
          checked={element.defaultChecked}
          onCheckedChange={(checked) =>
            updateElement(element.id, { defaultChecked: checked })
          }
        />
      </div>

      <Separator />

      <PropertyField label="Width">
        <Input
          type="number"
          value={Math.round(element.width)}
          onChange={(e) =>
            updateElement(element.id, { fontSize: Number(e.target.value) })
          }
          className="h-7 text-xs"
        />
      </PropertyField>

      <PropertyField label="Height">
        <Input
          type="number"
          value={Math.round(element.height)}
          onChange={(e) =>
            updateElement(element.id, {
              height: Number(e.target.value),
            })
          }
          className="h-7 text-xs"
        />
      </PropertyField>

      <PropertyField label="X">
        <Input
          type="number"
          value={Math.round(element.x)}
          onChange={(e) =>
            updateElement(element.id, { x: Number(e.target.value) })
          }
          className="h-7 text-xs"
        />
      </PropertyField>

      <PropertyField label="Y">
        <Input
          type="number"
          value={Math.round(element.y)}
          onChange={(e) =>
            updateElement(element.id, { y: Number(e.target.value) })
          }
          className="h-7 text-xs"
        />
      </PropertyField>
    </div>
  );
}

function RadioButtonProperties({ elementId }: { elementId: string }) {
  const element = useEditorStore((s) =>
    s.elements.find((el) => el.id === elementId),
  );
  const updateElement = useEditorStore((s) => s.updateElement);

  if (!element || !isRadioButton(element)) return null;

  return (
    <div className="flex flex-col gap-3">
      <PropertyField label="Group Name">
        <Input
          value={element.groupName}
          onChange={(e) =>
            updateElement(element.id, { groupName: e.target.value })
          }
          className="h-7 text-xs"
        />
      </PropertyField>

      <PropertyField label="Value">
        <Input
          value={element.value}
          onChange={(e) =>
            updateElement(element.id, { value: e.target.value })
          }
          className="h-7 text-xs"
        />
      </PropertyField>

      <PropertyField label="Label">
        <Input
          value={element.label}
          onChange={(e) =>
            updateElement(element.id, { label: e.target.value })
          }
          className="h-7 text-xs"
        />
      </PropertyField>

      <Separator />

      <PropertyField label="Width">
        <Input
          type="number"
          value={Math.round(element.width)}
          onChange={(e) =>
            updateElement(element.id, { fontSize: Number(e.target.value) })
          }
          className="h-7 text-xs"
        />
      </PropertyField>

      <PropertyField label="Height">
        <Input
          type="number"
          value={Math.round(element.height)}
          onChange={(e) =>
            updateElement(element.id, {
              height: Number(e.target.value),
            })
          }
          className="h-7 text-xs"
        />
      </PropertyField>

      <PropertyField label="X">
        <Input
          type="number"
          value={Math.round(element.x)}
          onChange={(e) =>
            updateElement(element.id, { x: Number(e.target.value) })
          }
          className="h-7 text-xs"
        />
      </PropertyField>

      <PropertyField label="Y">
        <Input
          type="number"
          value={Math.round(element.y)}
          onChange={(e) =>
            updateElement(element.id, { y: Number(e.target.value) })
          }
          className="h-7 text-xs"
        />
      </PropertyField>
    </div>
  );
}

function MultiTextFieldProperties({ elementIds }: { elementIds: string[] }) {
  const elements = useEditorStore((s) =>
    s.elements.filter((el) => elementIds.includes(el.id) && isTextField(el)),
  );
  const updateElement = useEditorStore((s) => s.updateElement);

  if (elements.length === 0) return null;

  const allSameFontSize = elements.every(
    (el) => (el as TextField).fontSize === (elements[0] as TextField).fontSize,
  );
  const allSameMultiline = elements.every(
    (el) => (el as TextField).multiline === (elements[0] as TextField).multiline,
  );
  const allSameRequired = elements.every(
    (el) => (el as TextField).required === (elements[0] as TextField).required,
  );

  return (
    <div className="flex flex-col gap-3">
      <PropertyField label="Font Size">
        <Input
          type="number"
          value={allSameFontSize ? (elements[0] as TextField).fontSize : ""}
          placeholder={allSameFontSize ? undefined : "Mixed"}
          onChange={(e) => {
            const val = Math.max(1, Number(e.target.value));
            for (const el of elements) {
              updateElement(el.id, { fontSize: val });
            }
          }}
          className="h-7 text-xs"
          min={1}
        />
      </PropertyField>

      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Multiline</Label>
        <Switch
          checked={allSameMultiline ? (elements[0] as TextField).multiline : false}
          onCheckedChange={(checked) => {
            for (const el of elements) {
              updateElement(el.id, { multiline: checked });
            }
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Required</Label>
        <Switch
          checked={allSameRequired ? (elements[0] as TextField).required : false}
          onCheckedChange={(checked) => {
            for (const el of elements) {
              updateElement(el.id, { required: checked });
            }
          }}
        />
      </div>
    </div>
  );
}

function MultiRadioProperties({ elementIds }: { elementIds: string[] }) {
  const elements = useEditorStore((s) =>
    s.elements.filter((el) => elementIds.includes(el.id) && isRadioButton(el)),
  );
  const updateElement = useEditorStore((s) => s.updateElement);

  if (elements.length === 0) return null;

  const allSameGroup = elements.every(
    (el) => (el as RadioButton).groupName === (elements[0] as RadioButton).groupName,
  );

  return (
    <div className="flex flex-col gap-3">
      <PropertyField label="Group Name">
        <Input
          value={allSameGroup ? (elements[0] as RadioButton).groupName : ""}
          placeholder={allSameGroup ? undefined : "Mixed"}
          onChange={(e) => {
            const val = e.target.value;
            for (const el of elements) {
              updateElement(el.id, { groupName: val });
            }
          }}
          className="h-7 text-xs"
        />
      </PropertyField>
    </div>
  );
}

export function PropertiesPanel() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const elements = useEditorStore((s) => s.elements);
  const selectedElements = elements.filter((el) => selectedIds.has(el.id));

  if (selectedIds.size === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-xs text-muted-foreground">No selection</p>
      </div>
    );
  }

  if (selectedIds.size > 1) {
    const types = new Set(selectedElements.map((el) => el.type));
    const allSameType = types.size === 1;
    const singleType = allSameType ? [...types][0] : null;

    return (
      <ScrollArea className="h-full">
        <div className="p-4">
          <div className="mb-3">
            <span className="text-xs font-medium text-foreground">
              {selectedIds.size} selected
            </span>
            <span className="ml-2 text-[10px] text-muted-foreground">
              {singleType
                ? { text: "Text Fields", checkbox: "Checkboxes", radio: "Radio Buttons" }[singleType]
                : "Mixed types"}
            </span>
          </div>
          <Separator className="mb-3" />

          {singleType === "text" && (
            <MultiTextFieldProperties elementIds={selectedElements.map((e) => e.id)} />
          )}
          {singleType === "radio" && (
            <MultiRadioProperties elementIds={selectedElements.map((e) => e.id)} />
          )}
        </div>
      </ScrollArea>
    );
  }

  const elementId = [...selectedIds][0];
  const element = elements.find((el) => el.id === elementId);

  if (!element) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-xs text-muted-foreground">No selection</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">
            {{ text: "Text Field", checkbox: "Checkbox", radio: "Radio Button" }[element.type] ?? element.type}
          </span>
          <span className="text-[10px] text-muted-foreground">Page {element.pageNumber}</span>
        </div>
        <Separator className="mb-3" />
        {isTextField(element) && <TextFieldProperties elementId={element.id} />}
        {isCheckbox(element) && <CheckboxProperties elementId={element.id} />}
        {isRadioButton(element) && <RadioButtonProperties elementId={element.id} />}
      </div>
    </ScrollArea>
  );
}
