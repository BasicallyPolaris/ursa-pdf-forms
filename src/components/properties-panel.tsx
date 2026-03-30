import { Component } from "react";
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
import {
  Type,
  Square,
  CircleDot,
  AlignLeft,
  Trash2,
  MoveHorizontal,
  MoveVertical,
} from "lucide-react";

class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state: { hasError: boolean; error: Error | null } = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4">
          <p className="text-xs text-destructive">Panel error</p>
          <p className="mt-1 text-[10px] text-muted-foreground break-all">
            {this.state.error?.message}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

function PropertyField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
      {label}
    </span>
  );
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Type; colorClass: string; borderClass: string }> = {
  text: { label: "Text Field", icon: Type, colorClass: "text-field-text", borderClass: "border-field-text/30" },
  checkbox: { label: "Checkbox", icon: Square, colorClass: "text-field-checkbox", borderClass: "border-field-checkbox/30" },
  radio: { label: "Radio Button", icon: CircleDot, colorClass: "text-field-radio", borderClass: "border-field-radio/30" },
};

function MultilineConfig() {
  return { label: "Multiline", icon: AlignLeft, colorClass: "text-field-multiline", borderClass: "border-field-multiline/30" };
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

      <Separator />

      <SectionHeader label="Typography" />

      <PropertyField label="Font Size">
        <Input
          type="number"
          value={element.fontSize}
          onChange={(e) =>
            updateElement(element.id, { fontSize: Number(e.target.value) })
          }
          className="h-7 text-xs font-mono tabular-nums"
        />
      </PropertyField>

      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">Multiline</Label>
        <Switch
          checked={element.multiline}
          onCheckedChange={(checked) =>
            updateElement(element.id, { multiline: checked })
          }
        />
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">Required</Label>
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
          className="h-7 text-xs font-mono tabular-nums"
        />
      </PropertyField>

      <Separator />

      <SectionHeader label="Position" />

      <div className="grid grid-cols-2 gap-2">
        <PropertyField label="X">
          <Input
            type="number"
            value={Math.round(element.x)}
            onChange={(e) =>
              updateElement(element.id, { x: Number(e.target.value) })
            }
            className="h-7 text-xs font-mono tabular-nums"
          />
        </PropertyField>
        <PropertyField label="Y">
          <Input
            type="number"
            value={Math.round(element.y)}
            onChange={(e) =>
              updateElement(element.id, { y: Number(e.target.value) })
            }
            className="h-7 text-xs font-mono tabular-nums"
          />
        </PropertyField>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <PropertyField label="Width">
          <Input
            type="number"
            value={Math.round(element.width)}
            onChange={(e) =>
              updateElement(element.id, { width: Number(e.target.value) })
            }
            className="h-7 text-xs font-mono tabular-nums"
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
            className="h-7 text-xs font-mono tabular-nums"
          />
        </PropertyField>
      </div>
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
        <Label className="text-[11px] text-muted-foreground">Default Checked</Label>
        <Switch
          checked={element.defaultChecked}
          onCheckedChange={(checked) =>
            updateElement(element.id, { defaultChecked: checked })
          }
        />
      </div>

      <Separator />

      <SectionHeader label="Position" />

      <div className="grid grid-cols-2 gap-2">
        <PropertyField label="X">
          <Input
            type="number"
            value={Math.round(element.x)}
            onChange={(e) =>
              updateElement(element.id, { x: Number(e.target.value) })
            }
            className="h-7 text-xs font-mono tabular-nums"
          />
        </PropertyField>
        <PropertyField label="Y">
          <Input
            type="number"
            value={Math.round(element.y)}
            onChange={(e) =>
              updateElement(element.id, { y: Number(e.target.value) })
            }
            className="h-7 text-xs font-mono tabular-nums"
          />
        </PropertyField>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <PropertyField label="Width">
          <Input
            type="number"
            value={Math.round(element.width)}
            onChange={(e) =>
              updateElement(element.id, { fontSize: Number(e.target.value) })
            }
            className="h-7 text-xs font-mono tabular-nums"
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
            className="h-7 text-xs font-mono tabular-nums"
          />
        </PropertyField>
      </div>
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

      <SectionHeader label="Position" />

      <div className="grid grid-cols-2 gap-2">
        <PropertyField label="X">
          <Input
            type="number"
            value={Math.round(element.x)}
            onChange={(e) =>
              updateElement(element.id, { x: Number(e.target.value) })
            }
            className="h-7 text-xs font-mono tabular-nums"
          />
        </PropertyField>
        <PropertyField label="Y">
          <Input
            type="number"
            value={Math.round(element.y)}
            onChange={(e) =>
              updateElement(element.id, { y: Number(e.target.value) })
            }
            className="h-7 text-xs font-mono tabular-nums"
          />
        </PropertyField>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <PropertyField label="Width">
          <Input
            type="number"
            value={Math.round(element.width)}
            onChange={(e) =>
              updateElement(element.id, { fontSize: Number(e.target.value) })
            }
            className="h-7 text-xs font-mono tabular-nums"
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
            className="h-7 text-xs font-mono tabular-nums"
          />
        </PropertyField>
      </div>
    </div>
  );
}

function MultiTextFieldProperties({ elements }: { elements: TextField[] }) {
  const updateElement = useEditorStore((s) => s.updateElement);

  if (elements.length === 0) return null;

  const allSameFontSize = elements.every(
    (el) => el.fontSize === elements[0].fontSize,
  );
  const allSameMultiline = elements.every(
    (el) => el.multiline === elements[0].multiline,
  );
  const allSameRequired = elements.every(
    (el) => el.required === elements[0].required,
  );

  return (
    <div className="flex flex-col gap-3">
      <PropertyField label="Font Size">
        <Input
          type="number"
          value={allSameFontSize ? elements[0].fontSize : ""}
          placeholder={allSameFontSize ? undefined : "Mixed"}
          onChange={(e) => {
            const val = Number(e.target.value);
            for (const el of elements) {
              updateElement(el.id, { fontSize: val });
            }
          }}
          className="h-7 text-xs font-mono tabular-nums"
        />
      </PropertyField>

      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">Multiline</Label>
        <Switch
          checked={allSameMultiline ? elements[0].multiline : false}
          onCheckedChange={(checked) => {
            for (const el of elements) {
              updateElement(el.id, { multiline: checked });
            }
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">Required</Label>
        <Switch
          checked={allSameRequired ? elements[0].required : false}
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

function MultiRadioProperties({ elements }: { elements: RadioButton[] }) {
  const updateElement = useEditorStore((s) => s.updateElement);

  if (elements.length === 0) return null;

  const allSameGroup = elements.every(
    (el) => el.groupName === elements[0].groupName,
  );

  return (
    <div className="flex flex-col gap-3">
      <PropertyField label="Group Name">
        <Input
          value={allSameGroup ? elements[0].groupName : ""}
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

function AlignmentButtons() {
  const alignElements = useEditorStore((s) => s.alignElements);
  const distributeElements = useEditorStore((s) => s.distributeElements);
  const centerSelectionOnPage = useEditorStore((s) => s.centerSelectionOnPage);
  const selectedIds = useEditorStore((s) => s.selectedIds);

  if (selectedIds.size < 2) return null;

  const btnClass =
    "flex h-7 w-7 items-center justify-center rounded text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground";

  return (
    <div className="mb-3 flex flex-col gap-2">
      <SectionHeader label="Alignment" />
      <div className="flex gap-1">
        <button className={btnClass} onClick={() => alignElements("left")} title="Align left">⫷</button>
        <button className={btnClass} onClick={() => alignElements("centerH")} title="Align center H">⫿</button>
        <button className={btnClass} onClick={() => alignElements("right")} title="Align right">⫸</button>
        <button className={btnClass} onClick={() => alignElements("top")} title="Align top">⊤</button>
        <button className={btnClass} onClick={() => alignElements("centerV")} title="Align center V">⊕</button>
        <button className={btnClass} onClick={() => alignElements("bottom")} title="Align bottom">⊥</button>
      </div>
      {selectedIds.size >= 3 && (
        <>
          <SectionHeader label="Distribute" />
          <div className="flex gap-1">
            <button className={btnClass + " w-auto px-2"} onClick={() => distributeElements("horizontal")} title="Distribute horizontally">H ≡</button>
            <button className={btnClass + " w-auto px-2"} onClick={() => distributeElements("vertical")} title="Distribute vertically">V ≡</button>
          </div>
        </>
      )}
      <button
        className="w-full rounded bg-accent px-2 py-1 text-xs text-accent-foreground hover:bg-accent/80"
        onClick={() => centerSelectionOnPage()}
        title="Center on page"
      >
        Center on page
      </button>
      <Separator />
    </div>
  );
}

export function PropertiesPanel() {
  return (
    <ErrorBoundary>
      <PropertiesPanelContent />
    </ErrorBoundary>
  );
}

function GuideProperties({ guideId }: { guideId: string }) {
  const guide = useEditorStore((s) => s.guides.find((g) => g.id === guideId));
  const updateGuidePosition = useEditorStore((s) => s.updateGuidePosition);
  const removeGuide = useEditorStore((s) => s.removeGuide);

  if (!guide) return null;

  const isHorizontal = guide.orientation === "horizontal";
  const Icon = isHorizontal ? MoveHorizontal : MoveVertical;
  const label = isHorizontal ? "Horizontal" : "Vertical";
  const posLabel = isHorizontal ? "Y" : "X";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded text-guide-ruler">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-medium text-foreground">
            {label} guide
          </span>
        </div>
      </div>
      <Separator />
      <PropertyField label={`${posLabel} position`}>
        <Input
          type="number"
          value={Math.round(guide.position)}
          onChange={(e) =>
            updateGuidePosition(guide.id, Number(e.target.value))
          }
          className="h-7 text-xs font-mono tabular-nums"
        />
      </PropertyField>
      <button
        onClick={() => removeGuide(guide.id)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
      >
        <Trash2 className="h-3 w-3" />
        Delete guide
      </button>
    </div>
  );
}

function PropertiesPanelContent() {
  const selectedGuideId = useEditorStore((s) => s.selectedGuideId);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const elements = useEditorStore((s) => s.elements);

  if (selectedGuideId) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="p-3">
          <GuideProperties guideId={selectedGuideId} />
        </div>
      </div>
    );
  }

  const selectedElements = elements.filter((el) => selectedIds.has(el.id));

  if (selectedIds.size === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-xs text-muted-foreground/50">No selection</p>
      </div>
    );
  }

  if (selectedIds.size > 1) {
    const types = new Set(selectedElements.map((el) => el.type));
    const allSameType = types.size === 1;
    const singleType = allSameType ? [...types][0] : null;
    const config = singleType ? TYPE_CONFIG[singleType] : null;

    return (
      <div className="h-full overflow-y-auto">
        <div className="p-3">
          <div className="mb-3 flex items-center gap-2">
            {config && (
              <span className={`flex h-5 w-5 items-center justify-center rounded ${config.colorClass}`}>
                <config.icon className="h-3 w-3" />
              </span>
            )}
            <div>
              <span className="text-xs font-medium text-foreground">
                {selectedIds.size} selected
              </span>
              <span className="ml-2 text-[10px] text-muted-foreground">
                {singleType
                  ? { text: "Text Fields", checkbox: "Checkboxes", radio: "Radio Buttons" }[singleType]
                  : "Mixed types"}
              </span>
            </div>
          </div>
          <Separator className="mb-3" />

          <AlignmentButtons />

          {singleType === "text" && (
            <MultiTextFieldProperties elements={selectedElements.filter(isTextField)} />
          )}
          {singleType === "radio" && (
            <MultiRadioProperties elements={selectedElements.filter(isRadioButton)} />
          )}
        </div>
      </div>
    );
  }

  const elementId = [...selectedIds][0];
  const element = elements.find((el) => el.id === elementId);

  if (!element) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-xs text-muted-foreground/50">No selection</p>
      </div>
    );
  }

  const isMultilineText = isTextField(element) && element.multiline;
  const config = isMultilineText ? MultilineConfig() : TYPE_CONFIG[element.type];
  const Icon = config.icon;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`flex h-5 w-5 items-center justify-center rounded ${config.colorClass}`}>
              <Icon className="h-3 w-3" />
            </span>
            <span className="text-xs font-medium text-foreground">
              {isMultilineText ? "Multiline" : config.label}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">Page {element.pageNumber}</span>
        </div>
        <Separator className="mb-3" />
        {isTextField(element) && <TextFieldProperties elementId={element.id} />}
        {isCheckbox(element) && <CheckboxProperties elementId={element.id} />}
        {isRadioButton(element) && <RadioButtonProperties elementId={element.id} />}
      </div>
    </div>
  );
}
