import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  heightFromFontSize,
  isCheckbox,
  isRadioButton,
  isTextField,
  type RadioButton,
  type TextField,
} from "@/lib/form-element-model";
import { useEditorStore } from "@/stores/editor-store";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignLeft,
  AlignStartHorizontal,
  AlignStartVertical,
  BetweenHorizontalStart,
  BetweenVerticalStart,
  CircleDot,
  Crosshair,
  Expand,
  MoveHorizontal,
  MoveVertical,
  Shrink,
  Square,
  Trash2,
  Type,
} from "lucide-react";
import { Component } from "react";

class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state: { hasError: boolean; error: Error | null } = {
    hasError: false,
    error: null,
  };

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

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: typeof Type; colorClass: string; borderClass: string }
> = {
  text: {
    label: "Text Field",
    icon: Type,
    colorClass: "text-field-text",
    borderClass: "border-field-text/30",
  },
  checkbox: {
    label: "Checkbox",
    icon: Square,
    colorClass: "text-field-checkbox",
    borderClass: "border-field-checkbox/30",
  },
  radio: {
    label: "Radio Button",
    icon: CircleDot,
    colorClass: "text-field-radio",
    borderClass: "border-field-radio/30",
  },
};

function MultilineConfig() {
  return {
    label: "Multiline",
    icon: AlignLeft,
    colorClass: "text-field-multiline",
    borderClass: "border-field-multiline/30",
  };
}

function TextFieldProperties({ elementId }: { elementId: string }) {
  const element = useEditorStore((s) =>
    s.elements.find((el) => el.id === elementId),
  );
  const livePos = useEditorStore((s) => s.dragLivePositions.get(elementId));
  const updateElement = useEditorStore((s) => s.updateElement);

  if (!element || !isTextField(element)) return null;

  const displayX = livePos ? Math.round(livePos.x) : Math.round(element.x);
  const displayY = livePos ? Math.round(livePos.y) : Math.round(element.y);
  const displayW = livePos
    ? Math.round(livePos.width)
    : Math.round(element.width);
  const displayH = livePos
    ? Math.round(livePos.height)
    : Math.round(element.height);

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
          onChange={(e) => {
            const fs = Number(e.target.value);
            const updates: Partial<TextField> = { fontSize: fs };
            if (!element.multiline) {
              updates.height = heightFromFontSize(fs);
            }
            updateElement(element.id, updates);
          }}
          className="h-7 text-xs font-mono tabular-nums"
        />
      </PropertyField>

      {!element.multiline && (
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Height</Label>
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
            {Math.round(element.height)}pt
          </span>
        </div>
      )}

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
            value={displayX}
            onChange={(e) =>
              updateElement(element.id, { x: Number(e.target.value) })
            }
            className="h-7 text-xs font-mono tabular-nums"
          />
        </PropertyField>
        <PropertyField label="Y">
          <Input
            type="number"
            value={displayY}
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
            value={displayW}
            onChange={(e) =>
              updateElement(element.id, { width: Number(e.target.value) })
            }
            className="h-7 text-xs font-mono tabular-nums"
          />
        </PropertyField>
        <PropertyField label="Height">
          <Input
            type="number"
            value={displayH}
            onChange={(e) =>
              updateElement(element.id, {
                height: Number(e.target.value),
              })
            }
            disabled={!element.multiline}
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
  const livePos = useEditorStore((s) => s.dragLivePositions.get(elementId));
  const updateElement = useEditorStore((s) => s.updateElement);

  if (!element || !isCheckbox(element)) return null;

  const displayX = livePos ? Math.round(livePos.x) : Math.round(element.x);
  const displayY = livePos ? Math.round(livePos.y) : Math.round(element.y);

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
        <Label className="text-[11px] text-muted-foreground">
          Default Checked
        </Label>
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
            value={displayX}
            onChange={(e) =>
              updateElement(element.id, { x: Number(e.target.value) })
            }
            className="h-7 text-xs font-mono tabular-nums"
          />
        </PropertyField>
        <PropertyField label="Y">
          <Input
            type="number"
            value={displayY}
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
  const livePos = useEditorStore((s) => s.dragLivePositions.get(elementId));
  const updateElement = useEditorStore((s) => s.updateElement);

  if (!element || !isRadioButton(element)) return null;

  const displayX = livePos ? Math.round(livePos.x) : Math.round(element.x);
  const displayY = livePos ? Math.round(livePos.y) : Math.round(element.y);

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
          onChange={(e) => updateElement(element.id, { value: e.target.value })}
          className="h-7 text-xs"
        />
      </PropertyField>

      <PropertyField label="Label">
        <Input
          value={element.label}
          onChange={(e) => updateElement(element.id, { label: e.target.value })}
          className="h-7 text-xs"
        />
      </PropertyField>

      <Separator />

      <SectionHeader label="Position" />

      <div className="grid grid-cols-2 gap-2">
        <PropertyField label="X">
          <Input
            type="number"
            value={displayX}
            onChange={(e) =>
              updateElement(element.id, { x: Number(e.target.value) })
            }
            className="h-7 text-xs font-mono tabular-nums"
          />
        </PropertyField>
        <PropertyField label="Y">
          <Input
            type="number"
            value={displayY}
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
  const allSameRequired = elements.every(
    (el) => el.required === elements[0].required,
  );

  const hasSingleLine = elements.some((el) => !el.multiline);

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
              const updates: Partial<TextField> = { fontSize: val };
              if (!el.multiline) {
                updates.height = heightFromFontSize(val);
              }
              updateElement(el.id, updates);
            }
          }}
          className="h-7 text-xs font-mono tabular-nums"
        />
      </PropertyField>

      {hasSingleLine && (
        <p className="text-[10px] text-muted-foreground/60">
          Single-line field heights auto-adjust with font size
        </p>
      )}

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

function AlignmentSection() {
  const selectedIds = useEditorStore((s) => s.selectedIds);

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-2">
        <CenterOnPageButtons />
        {selectedIds.size >= 2 && <AlignButtons />}
        {selectedIds.size >= 2 && <SizingButtons />}
        {selectedIds.size >= 3 && <DistributeButtons />}
      </div>
    </TooltipProvider>
  );
}

function ToolButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        onClick={onClick}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}

function CenterOnPageButtons() {
  const centerSelectionOnPage = useEditorStore((s) => s.centerSelectionOnPage);
  const centerSelectionOnPageH = useEditorStore((s) => s.centerSelectionOnPageH);
  const centerSelectionOnPageV = useEditorStore((s) => s.centerSelectionOnPageV);

  return (
    <div className="flex flex-col gap-1.5">
      <SectionHeader label="Center" />
      <div className="flex gap-1">
        <ToolButton onClick={() => centerSelectionOnPageH()} title="Center horizontally">
          <AlignCenterVertical className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton onClick={() => centerSelectionOnPageV()} title="Center vertically">
          <AlignCenterHorizontal className="h-3.5 w-3.5" />
        </ToolButton>
        <span className="w-px bg-border" />
        <ToolButton onClick={() => centerSelectionOnPage()} title="Center on page">
          <Crosshair className="h-3.5 w-3.5" />
        </ToolButton>
      </div>
    </div>
  );
}

function AlignButtons() {
  const alignElements = useEditorStore((s) => s.alignElements);

  return (
    <div className="flex flex-col gap-1.5">
      <SectionHeader label="Alignment" />
      <div className="flex gap-1">
        <ToolButton onClick={() => alignElements("left")} title="Align left">
          <AlignStartVertical className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton
          onClick={() => alignElements("centerH")}
          title="Align center horizontal"
        >
          <AlignCenterVertical className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton onClick={() => alignElements("right")} title="Align right">
          <AlignEndVertical className="h-3.5 w-3.5" />
        </ToolButton>
      </div>
      <div className="flex gap-1">
        <ToolButton onClick={() => alignElements("top")} title="Align top">
          <AlignStartHorizontal className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton
          onClick={() => alignElements("centerV")}
          title="Align center vertical"
        >
          <AlignCenterHorizontal className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton
          onClick={() => alignElements("bottom")}
          title="Align bottom"
        >
          <AlignEndHorizontal className="h-3.5 w-3.5" />
        </ToolButton>
      </div>
    </div>
  );
}

function SizingButtons() {
  const matchElementSize = useEditorStore((s) => s.matchElementSize);

  return (
    <div className="flex flex-col gap-1.5">
      <SectionHeader label="Adjust Sizing" />
      <div className="flex gap-1">
        <ToolButton
          onClick={() => matchElementSize("widthWidest")}
          title="Match width to widest"
        >
          <Expand className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton
          onClick={() => matchElementSize("widthNarrowest")}
          title="Match width to narrowest"
        >
          <Shrink className="h-3.5 w-3.5" />
        </ToolButton>
        <span className="w-px bg-border" />
        <ToolButton
          onClick={() => matchElementSize("heightTallest")}
          title="Match height to tallest"
        >
          <Expand className="h-3.5 w-3.5 rotate-90" />
        </ToolButton>
        <ToolButton
          onClick={() => matchElementSize("heightShortest")}
          title="Match height to shortest"
        >
          <Shrink className="h-3.5 w-3.5 rotate-90" />
        </ToolButton>
      </div>
    </div>
  );
}

function DistributeButtons() {
  const distributeElements = useEditorStore((s) => s.distributeElements);

  return (
    <div className="flex flex-col gap-1.5">
      <SectionHeader label="Distribute" />
      <div className="flex gap-1">
        <ToolButton
          onClick={() => distributeElements("horizontal")}
          title="Distribute horizontally"
        >
          <BetweenVerticalStart className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton
          onClick={() => distributeElements("vertical")}
          title="Distribute vertically"
        >
          <BetweenHorizontalStart className="h-3.5 w-3.5" />
        </ToolButton>
      </div>
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
              <span
                className={`flex h-5 w-5 items-center justify-center rounded ${config.colorClass}`}
              >
                <config.icon className="h-3 w-3" />
              </span>
            )}
            <div>
              <span className="text-xs font-medium text-foreground">
                {selectedIds.size} selected
              </span>
              <span className="ml-2 text-[10px] text-muted-foreground">
                {singleType
                  ? {
                      text: "Text Fields",
                      checkbox: "Checkboxes",
                      radio: "Radio Buttons",
                    }[singleType]
                  : "Mixed types"}
              </span>
            </div>
          </div>
          <Separator className="mb-3" />

          <AlignmentSection />

          <Separator className="my-3" />

          {singleType === "text" && (
            <MultiTextFieldProperties
              elements={selectedElements.filter(isTextField)}
            />
          )}
          {singleType === "radio" && (
            <MultiRadioProperties
              elements={selectedElements.filter(isRadioButton)}
            />
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
  const config = isMultilineText
    ? MultilineConfig()
    : TYPE_CONFIG[element.type];
  const Icon = config.icon;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded ${config.colorClass}`}
            >
              <Icon className="h-3 w-3" />
            </span>
            <span className="text-xs font-medium text-foreground">
              {isMultilineText ? "Multiline" : config.label}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Page {element.pageNumber}
          </span>
        </div>
        <Separator className="mb-3" />
        <CenterOnPageButtons />
        <Separator className="my-3" />
        {isTextField(element) && <TextFieldProperties elementId={element.id} />}
        {isCheckbox(element) && <CheckboxProperties elementId={element.id} />}
        {isRadioButton(element) && (
          <RadioButtonProperties elementId={element.id} />
        )}
      </div>
    </div>
  );
}
