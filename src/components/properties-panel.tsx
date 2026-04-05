import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import {
  getElementStyleConfig,
  getElementStyleConfigByType,
  getFieldTypeLabel,
} from "@/lib/element-style-map";
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
  type FormElement,
  type RadioButton,
  type TextField,
} from "@/lib/form-element-model";
import { resolveElementPosition } from "@/lib/page-coordinates";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  BetweenHorizontalStart,
  BetweenVerticalStart,
  Expand,
  MoveHorizontal,
  MoveVertical,
  MousePointer2,
  Shrink,
  SquareCenterlineDashedHorizontal,
  SquareCenterlineDashedVertical,
  SquareSquare,
  Trash2,
} from "lucide-react";
import { useEditorStore, type GuideLine } from "@/stores/editor-store";
import { ErrorBoundary } from "@/components/ui/error-boundary";

function useDeferredValue(
  storeValue: string | number,
  onCommit: (raw: string) => void,
) {
  const [local, setLocal] = useState(String(storeValue ?? ""));
  const activeRef = useRef(false);
  const preEditRef = useRef<{
    elements: FormElement[];
    guides: GuideLine[];
  } | null>(null);
  const originalValueRef = useRef(String(storeValue ?? ""));
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  useEffect(() => {
    if (!activeRef.current) {
      setLocal(String(storeValue ?? ""));
    }
  }, [storeValue]);

  const onFocus = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    originalValueRef.current = String(storeValue ?? "");
    preEditRef.current = {
      elements: useEditorStore.getState().elements,
      guides: useEditorStore.getState().guides,
    };
    useEditorStore.temporal.getState().pause();
  }, [storeValue]);

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocal(e.target.value);
      onCommitRef.current(e.target.value);
    },
    [],
  );

  const finishEdit = useCallback((revert: boolean) => {
    if (!activeRef.current) return;
    activeRef.current = false;
    const preEdit = preEditRef.current;
    preEditRef.current = null;

    if (revert && preEdit) {
      useEditorStore.setState({
        elements: preEdit.elements,
        guides: preEdit.guides,
      });
      setLocal(originalValueRef.current);
    }

    useEditorStore.temporal.getState().resume();

    if (!revert && preEdit) {
      const current = {
        elements: useEditorStore.getState().elements,
        guides: useEditorStore.getState().guides,
      };
      if (
        preEdit.elements !== current.elements ||
        preEdit.guides !== current.guides
      ) {
        const ts = useEditorStore.temporal.getState();
        const past = [...ts.pastStates, preEdit];
        if (past.length > 50) past.splice(0, past.length - 50);
        useEditorStore.temporal.setState({
          pastStates: past,
          futureStates: [],
        });
      }
    }
  }, []);

  const onBlur = useCallback(() => {
    finishEdit(false);
  }, [finishEdit]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finishEdit(false);
        (e.target as HTMLInputElement).select();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        finishEdit(true);
        (e.target as HTMLInputElement).blur();
      }
    },
    [finishEdit],
  );

  return { value: local, onFocus, onChange, onBlur, onKeyDown };
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
    <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {label}
    </span>
  );
}

function PageSelector({
  pageNumber,
  totalPages,
  onChange,
}: {
  pageNumber: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(pageNumber));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setText(String(pageNumber));
  }, [pageNumber, editing]);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.select();
  }, [editing]);

  const commit = () => {
    const num = parseInt(text, 10);
    if (Number.isFinite(num) && num >= 1 && num <= totalPages) {
      onChange(num);
    }
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        onClick={() => {
          setText(String(pageNumber));
          setEditing(true);
        }}
      >
        <span>{t("properties.pageLabel")}</span>
        <span className="font-mono tabular-nums">{pageNumber}</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-muted-foreground">
        {t("properties.pageLabel")}
      </span>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        className="h-5 w-8 rounded bg-accent px-1 text-center text-[10px] font-mono tabular-nums text-foreground outline-none ring-1 ring-ring/50"
        value={text}
        onChange={(e) => {
          if (e.target.value === "" || /^\d+$/.test(e.target.value)) {
            setText(e.target.value);
          }
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setEditing(false);
            setText(String(pageNumber));
          }
        }}
      />
    </div>
  );
}

function TextFieldProperties({ elementId }: { elementId: string }) {
  const { t } = useTranslation();
  const element = useEditorStore((s) =>
    s.elements.find((el) => el.id === elementId),
  );
  const updateElement = useEditorStore((s) => s.updateElement);

  if (!element || !isTextField(element)) return null;

  const nameField = useDeferredValue(element.name, (v) =>
    updateElement(element.id, { name: v }),
  );
  const defaultValueField = useDeferredValue(element.defaultValue, (v) =>
    updateElement(element.id, { defaultValue: v }),
  );
  const fontSizeField = useDeferredValue(element.fontSize, (v) => {
    const fs = Number(v);
    const updates: Partial<TextField> = { fontSize: fs };
    if (!element.multiline) {
      updates.height = heightFromFontSize(fs);
    }
    updateElement(element.id, updates);
  });
  const maxLengthField = useDeferredValue(element.maxLength ?? "", (v) =>
    updateElement(element.id, {
      maxLength: v ? Number(v) : undefined,
    }),
  );

  return (
    <div className="flex flex-col gap-3">
      <PropertyField label={t("properties.name")}>
        <Input {...nameField} className="h-7 text-xs" />
      </PropertyField>

      <PropertyField label={t("properties.defaultValue")}>
        <Input {...defaultValueField} className="h-7 text-xs" />
      </PropertyField>

      <Separator />

      <SectionHeader label={t("properties.typography")} />

      <PropertyField label={t("properties.fontSize")}>
        <NumericInput {...fontSizeField} />
      </PropertyField>

      {!element.multiline && (
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">
            {t("properties.height")}
          </Label>
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
            {t("properties.pt", { value: Math.round(element.height) })}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">
          {t("properties.required")}
        </Label>
        <Switch
          checked={element.required}
          onCheckedChange={(checked) =>
            updateElement(element.id, { required: checked })
          }
        />
      </div>

      <PropertyField label={t("properties.maxLength")}>
        <NumericInput
          {...maxLengthField}
          placeholder={t("properties.noLimit")}
        />
      </PropertyField>
    </div>
  );
}

function CheckboxProperties({ elementId }: { elementId: string }) {
  const { t } = useTranslation();
  const element = useEditorStore((s) =>
    s.elements.find((el) => el.id === elementId),
  );
  const updateElement = useEditorStore((s) => s.updateElement);

  if (!element || !isCheckbox(element)) return null;

  const nameField = useDeferredValue(element.name, (v) =>
    updateElement(element.id, { name: v }),
  );

  return (
    <div className="flex flex-col gap-3">
      <PropertyField label={t("properties.name")}>
        <Input {...nameField} className="h-7 text-xs" />
      </PropertyField>

      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">
          {t("properties.defaultChecked")}
        </Label>
        <Switch
          checked={element.defaultChecked}
          onCheckedChange={(checked) =>
            updateElement(element.id, { defaultChecked: checked })
          }
        />
      </div>
    </div>
  );
}

function RadioButtonProperties({ elementId }: { elementId: string }) {
  const { t } = useTranslation();
  const element = useEditorStore((s) =>
    s.elements.find((el) => el.id === elementId),
  );
  const updateElement = useEditorStore((s) => s.updateElement);

  if (!element || !isRadioButton(element)) return null;

  const groupNameField = useDeferredValue(element.groupName, (v) =>
    updateElement(element.id, { groupName: v }),
  );
  const valueField = useDeferredValue(element.value, (v) =>
    updateElement(element.id, { value: v }),
  );
  const labelField = useDeferredValue(element.label, (v) =>
    updateElement(element.id, { label: v }),
  );

  return (
    <div className="flex flex-col gap-3">
      <PropertyField label={t("properties.groupName")}>
        <Input {...groupNameField} className="h-7 text-xs" />
      </PropertyField>

      <PropertyField label={t("properties.value")}>
        <Input {...valueField} className="h-7 text-xs" />
      </PropertyField>

      <PropertyField label={t("properties.label")}>
        <Input {...labelField} className="h-7 text-xs" />
      </PropertyField>
    </div>
  );
}

function SinglePositionProperties({ elementId }: { elementId: string }) {
  const { t } = useTranslation();
  const element = useEditorStore((s) =>
    s.elements.find((el) => el.id === elementId),
  );
  const livePos = useEditorStore((s) => s.dragLivePositions.get(elementId));
  const updateElement = useEditorStore((s) => s.updateElement);
  const pages = useEditorStore((s) => s.pages);

  if (!element) return null;

  const displayX = livePos ? Math.round(livePos.x) : Math.round(element.x);
  const displayY = livePos ? Math.round(livePos.y) : Math.round(element.y);
  const displayW = livePos
    ? Math.round(livePos.width)
    : Math.round(element.width);
  const displayH = livePos
    ? Math.round(livePos.height)
    : Math.round(element.height);
  const isAutoHeight = isTextField(element) && !element.multiline;

  const xField = useDeferredValue(displayX, (v) => {
    const resolved = resolveElementPosition(pages, element.pageNumber, Number(v), element.y);
    updateElement(element.id, { x: resolved.x, pageNumber: resolved.pageNumber });
  });
  const yField = useDeferredValue(displayY, (v) => {
    const resolved = resolveElementPosition(pages, element.pageNumber, element.x, Number(v));
    updateElement(element.id, { y: resolved.y, pageNumber: resolved.pageNumber });
  });
  const wField = useDeferredValue(displayW, (v) =>
    updateElement(element.id, { width: Number(v) }),
  );
  const hField = useDeferredValue(displayH, (v) =>
    updateElement(element.id, { height: Number(v) }),
  );

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader label={t("properties.position")} />
      <div className="grid grid-cols-2 gap-2">
        <PropertyField label={t("properties.x")}>
          <NumericInput {...xField} />
        </PropertyField>
        <PropertyField label={t("properties.y")}>
          <NumericInput {...yField} />
        </PropertyField>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <PropertyField label={t("properties.width")}>
          <NumericInput {...wField} />
        </PropertyField>
        <PropertyField label={t("properties.height")}>
          <NumericInput {...hField} disabled={isAutoHeight} />
        </PropertyField>
      </div>
    </div>
  );
}

function MultiTextFieldProperties({ elements }: { elements: TextField[] }) {
  const { t } = useTranslation();
  const batchUpdateElements = useEditorStore((s) => s.batchUpdateElements);

  if (elements.length === 0) return null;

  const allSameFontSize = elements.every(
    (el) => el.fontSize === elements[0].fontSize,
  );
  const allSameRequired = elements.every(
    (el) => el.required === elements[0].required,
  );

  const hasSingleLine = elements.some((el) => !el.multiline);

  const fontSizeField = useDeferredValue(
    allSameFontSize ? elements[0].fontSize : "",
    (v) => {
      const val = Number(v);
      batchUpdateElements(
        elements.map((el) => ({
          id: el.id,
          changes: {
            fontSize: val,
            ...(!el.multiline ? { height: heightFromFontSize(val) } : {}),
          },
        })),
      );
    },
  );

  return (
    <div className="flex flex-col gap-3">
      <PropertyField label={t("properties.fontSize")}>
        <NumericInput
          {...fontSizeField}
          placeholder={allSameFontSize ? undefined : t("properties.mixed")}
        />
      </PropertyField>

      {hasSingleLine && (
        <p className="text-[10px] text-muted-foreground">
          {t("properties.singleLineAutoHeight")}
        </p>
      )}

      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">
          {t("properties.required")}
        </Label>
        <Switch
          checked={allSameRequired ? elements[0].required : false}
          onCheckedChange={(checked) => {
            batchUpdateElements(
              elements.map((el) => ({ id: el.id, changes: { required: checked } })),
            );
          }}
        />
      </div>
    </div>
  );
}

function MultiRadioProperties({ elements }: { elements: RadioButton[] }) {
  const { t } = useTranslation();
  const batchUpdateElements = useEditorStore((s) => s.batchUpdateElements);

  if (elements.length === 0) return null;

  const allSameGroup = elements.every(
    (el) => el.groupName === elements[0].groupName,
  );

  const groupNameField = useDeferredValue(
    allSameGroup ? elements[0].groupName : "",
    (v) => {
      batchUpdateElements(
        elements.map((el) => ({ id: el.id, changes: { groupName: v } })),
      );
    },
  );

  return (
    <div className="flex flex-col gap-3">
      <PropertyField label={t("properties.groupName")}>
        <Input
          {...groupNameField}
          placeholder={allSameGroup ? undefined : t("properties.mixed")}
          className="h-7 text-xs"
        />
      </PropertyField>
    </div>
  );
}

function MultiPositionProperties({ elements }: { elements: FormElement[] }) {
  const { t } = useTranslation();
  const batchUpdateElements = useEditorStore((s) => s.batchUpdateElements);
  const pages = useEditorStore((s) => s.pages);

  if (elements.length === 0) return null;

  const allSameX = elements.every((el) => el.x === elements[0].x);
  const allSameY = elements.every((el) => el.y === elements[0].y);
  const allSameW = elements.every((el) => el.width === elements[0].width);
  const resizableElements = elements.filter(
    (el) => !(isTextField(el) && !el.multiline),
  );
  const allSameH =
    resizableElements.length > 0 &&
    resizableElements.every((el) => el.height === resizableElements[0].height);

  const heightDisplayValue = allSameH
    ? Math.round(resizableElements[0].height)
    : "";
  const hasAutoHeight = elements.some((el) => isTextField(el) && !el.multiline);

  const xField = useDeferredValue(
    allSameX ? Math.round(elements[0].x) : "",
    (v) => {
      const newX = Number(v);
      batchUpdateElements(
        elements.map((el) => {
          const resolved = resolveElementPosition(pages, el.pageNumber, newX, el.y);
          return { id: el.id, changes: { x: resolved.x, pageNumber: resolved.pageNumber } };
        }),
      );
    },
  );
  const yField = useDeferredValue(
    allSameY ? Math.round(elements[0].y) : "",
    (v) => {
      const newY = Number(v);
      batchUpdateElements(
        elements.map((el) => {
          const resolved = resolveElementPosition(pages, el.pageNumber, el.x, newY);
          return { id: el.id, changes: { y: resolved.y, pageNumber: resolved.pageNumber } };
        }),
      );
    },
  );
  const wField = useDeferredValue(
    allSameW ? Math.round(elements[0].width) : "",
    (v) =>
      batchUpdateElements(
        elements.map((el) => ({ id: el.id, changes: { width: Number(v) } })),
      ),
  );
  const hField = useDeferredValue(
    heightDisplayValue,
    (v) =>
      batchUpdateElements(
        elements
          .filter((el) => !(isTextField(el) && !el.multiline))
          .map((el) => ({ id: el.id, changes: { height: Number(v) } })),
      ),
  );

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader label={t("properties.position")} />
      <div className="grid grid-cols-2 gap-2">
        <PropertyField label={t("properties.x")}>
          <NumericInput
            {...xField}
            placeholder={allSameX ? undefined : t("properties.mixed")}
          />
        </PropertyField>
        <PropertyField label={t("properties.y")}>
          <NumericInput
            {...yField}
            placeholder={allSameY ? undefined : t("properties.mixed")}
          />
        </PropertyField>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <PropertyField label={t("properties.width")}>
          <NumericInput
            {...wField}
            placeholder={allSameW ? undefined : t("properties.mixed")}
          />
        </PropertyField>
        <PropertyField label={t("properties.height")}>
          <NumericInput
            {...hField}
            placeholder={allSameH ? undefined : t("properties.mixed")}
          />
        </PropertyField>
      </div>
      {hasAutoHeight && (
        <p className="text-[10px] text-muted-foreground">
          {t("properties.singleLineAutoHeight")}
        </p>
      )}
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
        className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-card"
        onClick={onClick}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}

function CenterOnPageButtons() {
  const { t } = useTranslation();
  const centerSelectionOnPage = useEditorStore((s) => s.centerSelectionOnPage);
  const centerSelectionOnPageH = useEditorStore(
    (s) => s.centerSelectionOnPageH,
  );
  const centerSelectionOnPageV = useEditorStore(
    (s) => s.centerSelectionOnPageV,
  );

  return (
    <div className="flex flex-col gap-1.5">
      <SectionHeader label={t("properties.center")} />
      <div className="flex gap-1">
        <ToolButton
          onClick={() => centerSelectionOnPageH()}
          title={t("properties.centerHorizontally")}
        >
          <SquareCenterlineDashedHorizontal className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton
          onClick={() => centerSelectionOnPageV()}
          title={t("properties.centerVertically")}
        >
          <SquareCenterlineDashedVertical className="h-3.5 w-3.5" />
        </ToolButton>
        <span className="w-px bg-border" />
        <ToolButton
          onClick={() => centerSelectionOnPage()}
          title={t("properties.centerOnPage")}
        >
          <SquareSquare className="h-3.5 w-3.5" />
        </ToolButton>
      </div>
    </div>
  );
}

function AlignButtons() {
  const { t } = useTranslation();
  const alignElements = useEditorStore((s) => s.alignElements);

  return (
    <div className="flex flex-col gap-1.5">
      <SectionHeader label={t("properties.alignment")} />
      <div className="flex gap-1">
        <ToolButton
          onClick={() => alignElements("left")}
          title={t("properties.alignLeft")}
        >
          <AlignStartVertical className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton
          onClick={() => alignElements("centerH")}
          title={t("properties.alignCenterH")}
        >
          <AlignCenterVertical className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton
          onClick={() => alignElements("right")}
          title={t("properties.alignRight")}
        >
          <AlignEndVertical className="h-3.5 w-3.5" />
        </ToolButton>
      </div>
      <div className="flex gap-1">
        <ToolButton
          onClick={() => alignElements("top")}
          title={t("properties.alignTop")}
        >
          <AlignStartHorizontal className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton
          onClick={() => alignElements("centerV")}
          title={t("properties.alignCenterV")}
        >
          <AlignCenterHorizontal className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton
          onClick={() => alignElements("bottom")}
          title={t("properties.alignBottom")}
        >
          <AlignEndHorizontal className="h-3.5 w-3.5" />
        </ToolButton>
      </div>
    </div>
  );
}

function SizingButtons() {
  const { t } = useTranslation();
  const matchElementSize = useEditorStore((s) => s.matchElementSize);

  return (
    <div className="flex flex-col gap-1.5">
      <SectionHeader label={t("properties.adjustSizing")} />
      <div className="flex items-center gap-1">
        <span className="flex w-8 items-center justify-center text-[9px] font-medium text-muted-foreground">W</span>
        <ToolButton
          onClick={() => matchElementSize("widthWidest")}
          title={t("properties.matchWidthWidest")}
        >
          <Expand className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton
          onClick={() => matchElementSize("widthNarrowest")}
          title={t("properties.matchWidthNarrowest")}
        >
          <Shrink className="h-3.5 w-3.5" />
        </ToolButton>
      </div>
      <div className="flex items-center gap-1">
        <span className="flex w-8 items-center justify-center text-[9px] font-medium text-muted-foreground">H</span>
        <ToolButton
          onClick={() => matchElementSize("heightTallest")}
          title={t("properties.matchHeightTallest")}
        >
          <Expand className="h-3.5 w-3.5 rotate-90" />
        </ToolButton>
        <ToolButton
          onClick={() => matchElementSize("heightShortest")}
          title={t("properties.matchHeightShortest")}
        >
          <Shrink className="h-3.5 w-3.5 rotate-90" />
        </ToolButton>
      </div>
    </div>
  );
}

function DistributeButtons() {
  const { t } = useTranslation();
  const distributeElements = useEditorStore((s) => s.distributeElements);

  return (
    <div className="flex flex-col gap-1.5">
      <SectionHeader label={t("properties.distribute")} />
      <div className="flex gap-1">
        <ToolButton
          onClick={() => distributeElements("horizontal")}
          title={t("properties.distributeHorizontally")}
        >
          <BetweenVerticalStart className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton
          onClick={() => distributeElements("vertical")}
          title={t("properties.distributeVertically")}
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
  const { t } = useTranslation();
  const guide = useEditorStore((s) => s.guides.find((g) => g.id === guideId));
  const previewGuide = useEditorStore((s) => s.previewGuide);
  const selectedGuideId = useEditorStore((s) => s.selectedGuideId);
  const updateGuidePosition = useEditorStore((s) => s.updateGuidePosition);
  const removeGuide = useEditorStore((s) => s.removeGuide);

  if (!guide) return null;

  const isLiveDragging =
    selectedGuideId === guideId &&
    previewGuide !== null &&
    previewGuide.orientation === guide.orientation;
  const livePosition = isLiveDragging ? previewGuide.position : guide.position;

  const isHorizontal = guide.orientation === "horizontal";
  const Icon = isHorizontal ? MoveHorizontal : MoveVertical;
  const orientationLabel = isHorizontal
    ? t("properties.horizontal")
    : t("properties.vertical");
  const posLabel = isHorizontal ? "Y" : "X";

  const pages = useEditorStore((s) => s.pages);
  const maxPos = isHorizontal
    ? (pages[0]?.height ?? Infinity)
    : (pages[0]?.width ?? Infinity);

  const posField = useDeferredValue(Math.round(livePosition), (v) =>
    updateGuidePosition(
      guide.id,
      Math.max(0, Math.min(Number(v), maxPos)),
    ),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded text-guide-ruler">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-medium text-foreground">
            {t("properties.guide", { orientation: orientationLabel })}
          </span>
        </div>
      </div>
      <Separator />
      <PropertyField label={t("properties.positionLabel", { axis: posLabel })}>
        <NumericInput {...posField} />
      </PropertyField>
      <button
        onClick={() => removeGuide(guide.id)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-card"
      >
        <Trash2 className="h-3 w-3" />
        {t("properties.deleteGuide")}
      </button>
    </div>
  );
}

function PropertiesPanelContent() {
  const { t } = useTranslation();
  const selectedGuideId = useEditorStore((s) => s.selectedGuideId);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const elements = useEditorStore((s) => s.elements);
  const pages = useEditorStore((s) => s.pages);
  const updateElement = useEditorStore((s) => s.updateElement);

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
      <div className="flex h-full flex-col items-center justify-center gap-2.5 px-6">
        <MousePointer2 className="h-5 w-5 text-muted-foreground/20" />
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground/60">
          {t("properties.noSelection")}
        </p>
      </div>
    );
  }

  if (selectedIds.size > 1) {
    const types = new Set(selectedElements.map((el) => el.type));
    const allSameType = types.size === 1;
    const singleType = allSameType ? [...types][0] : null;
    const config = singleType ? getElementStyleConfigByType(singleType) : null;
    const hasTypeProps = singleType === "text" || singleType === "radio";

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
            <div className="min-w-0">
              <span className="block truncate text-xs font-medium text-foreground">
                {t("properties.selected", { count: selectedIds.size })}
              </span>
              <span className="block truncate text-[10px] text-muted-foreground">
                {singleType
                  ? {
                      text: t("properties.textFields"),
                      checkbox: t("properties.checkboxes"),
                      radio: t("properties.radioButtons"),
                    }[singleType]
                  : t("properties.mixedTypes")}
              </span>
            </div>
          </div>
          <Separator className="mb-3" />

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
          {hasTypeProps && <Separator className="my-3" />}

          <MultiPositionProperties elements={selectedElements} />

          <Separator className="my-3" />

          <AlignmentSection />
        </div>
      </div>
    );
  }

  const elementId = [...selectedIds][0];
  const element = elements.find((el) => el.id === elementId);

  if (!element) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2.5 px-6">
        <MousePointer2 className="h-5 w-5 text-muted-foreground/20" />
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground/60">
          {t("properties.noSelection")}
        </p>
      </div>
    );
  }

  const config = getElementStyleConfig(element);
  const Icon = config.icon;
  const isMultilineText = isTextField(element) && element.multiline;

  return (
    <div className="h-full overflow-y-auto select-none">
      <div className="p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded ${config.colorClass}`}
            >
              <Icon className="h-3 w-3" />
            </span>
            <span className="text-xs font-medium text-foreground">
              {isMultilineText
                ? t("fieldTypes.multiline")
                : getFieldTypeLabel(config)}
            </span>
          </div>
          <PageSelector
            pageNumber={element.pageNumber}
            totalPages={pages.length}
            onChange={(page) => updateElement(element.id, { pageNumber: page })}
          />
        </div>
        <Separator className="mb-3" />

        {isTextField(element) && <TextFieldProperties elementId={element.id} />}
        {isCheckbox(element) && <CheckboxProperties elementId={element.id} />}
        {isRadioButton(element) && (
          <RadioButtonProperties elementId={element.id} />
        )}
        <Separator className="my-3" />

        <SinglePositionProperties elementId={element.id} />
        <Separator className="my-3" />

        <CenterOnPageButtons />
      </div>
    </div>
  );
}
