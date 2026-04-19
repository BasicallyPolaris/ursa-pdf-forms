import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { lockCursor, unlockCursor } from "@/lib/cursor";
import {
  getElementStyleConfig,
  getElementStyleConfigByType,
  getFieldTypeLabel,
} from "@/lib/element-style-map";
import {
  heightFromFontSize,
  heightFromOptions,
  isButtonField,
  isCheckbox,
  isDropdownField,
  isOptionListField,
  isRadioButton,
  isTextField,
  MAX_FIELD_NAME_LENGTH,
  MAX_OPTIONS_PER_FIELD,
  type ButtonField,
  type Checkbox,
  type DropdownField,
  type FormElement,
  type RadioButton,
  type TextField,
} from "@/lib/form-element-model";
import { resolveElementPosition } from "@/lib/page-coordinates";
import { useEditorStore, type GuideLine } from "@/stores/editor-store";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  BetweenHorizontalStart,
  BetweenVerticalStart,
   ChevronLeft,
   ChevronRight,
  Expand,
  GripVertical,
  Heart,
  MousePointer2,
  MoveHorizontal,
  MoveVertical,
  Shrink,
  SquareCenterlineDashedHorizontal,
  SquareCenterlineDashedVertical,
  SquareSquare,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

const BASE_FONT_FAMILIES = [
  { value: "Helvetica", label: "Helvetica" },
  { value: "Courier", label: "Courier" },
  { value: "Times-Roman", label: "Times" },
  { value: "Symbol", label: "Symbol" },
  { value: "ZapfDingbats", label: "Zapf Dingbats" },
];

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

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocal(e.target.value);
    onCommitRef.current(e.target.value);
  }, []);

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
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5" role="group" aria-labelledby={id}>
      <Label id={id} className="text-[11px] text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

const collapsedSections = new Set<string>();

function CollapsibleSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(() => !collapsedSections.has(label));

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-label={`${label} section`}
        onClick={() => {
          setOpen((prev) => {
            if (prev) collapsedSections.add(label);
            else collapsedSections.delete(label);
            return !prev;
          });
        }}
        className="flex w-full items-center justify-between rounded-sm py-0.5 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
      >
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <ChevronRight
          className={`h-3 w-3 shrink-0 text-muted-foreground/50 ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>
      {open && <div className="flex flex-col gap-3 pt-2">{children}</div>}
    </div>
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
        aria-label={t("properties.editPageNumber")}
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
        aria-label={t("properties.editPageNumber")}
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

type TypographyField = {
  fontFamily: string;
  fontWeight: "regular" | "bold" | "italic" | "bold-italic";
  fontSize: number;
  textColor: string;
  backgroundColor: string | null;
  borderColor: string | null;
  borderWidth: number;
};

type ElementWithTypography = FormElement & TypographyField;

function elementHasTypography(el: FormElement): el is ElementWithTypography {
  return (
    el.type === "text" ||
    el.type === "dropdown" ||
    el.type === "button" ||
    el.type === "optionlist"
  );
}

function FontFamilySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <PropertyField label={t("properties.fontFamily")}>
      <select
        className="h-7 w-full rounded-md border border-input bg-accent px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={t("properties.fontFamily")}
      >
        {BASE_FONT_FAMILIES.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
    </PropertyField>
  );
}

function BoldItalicButtons({
  fontWeight,
  onChange,
}: {
  fontWeight: string;
  onChange: (w: "regular" | "bold" | "italic" | "bold-italic") => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-0.5">
      <button
        type="button"
        aria-label={t("properties.bold")}
        aria-pressed={fontWeight === "bold" || fontWeight === "bold-italic"}
        className={`flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
          fontWeight === "bold" || fontWeight === "bold-italic"
            ? "bg-accent text-accent-foreground ring-1 ring-ring/50"
            : "text-muted-foreground hover:bg-accent"
        }`}
        onClick={() => {
          const next =
            fontWeight === "bold"
              ? "regular"
              : fontWeight === "bold-italic"
                ? "italic"
                : fontWeight === "italic"
                  ? "bold-italic"
                  : "bold";
          onChange(next);
        }}
      >
        B
      </button>
      <button
        type="button"
        aria-label={t("properties.italic")}
        aria-pressed={fontWeight === "italic" || fontWeight === "bold-italic"}
        className={`flex h-6 w-6 items-center justify-center rounded text-[10px] italic transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
          fontWeight === "italic" || fontWeight === "bold-italic"
            ? "bg-accent text-accent-foreground ring-1 ring-ring/50"
            : "text-muted-foreground hover:bg-accent"
        }`}
        onClick={() => {
          const next =
            fontWeight === "italic"
              ? "regular"
              : fontWeight === "bold-italic"
                ? "bold"
                : fontWeight === "bold"
                  ? "bold-italic"
                  : "italic";
          onChange(next);
        }}
      >
        I
      </button>
    </div>
  );
}

function TextColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <PropertyField label={t("properties.textColor")}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={t("properties.textColor")}
          className="h-7 w-7 cursor-pointer rounded border border-input bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="text-[10px] font-mono text-muted-foreground">
          {value}
        </span>
      </div>
    </PropertyField>
  );
}

function AppearanceSection({
  element,
  onUpdate,
}: {
  element: TypographyField;
  onUpdate: (updates: Partial<TypographyField>) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <PropertyField label={t("properties.backgroundColor")}>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label={t("properties.backgroundColor")}
            className="h-7 w-7 shrink-0 cursor-pointer rounded border border-input bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            value={element.backgroundColor ?? "#ffffff"}
            onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
          />
          {element.backgroundColor && (
            <button
              type="button"
              aria-label={t("properties.clearBackgroundColor")}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-input text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              onClick={() => onUpdate({ backgroundColor: null })}
            >
              ✕
            </button>
          )}
          <span className="text-[10px] font-mono text-muted-foreground">
            {element.backgroundColor ?? t("properties.none")}
          </span>
        </div>
      </PropertyField>
      <PropertyField label={t("properties.borderColor")}>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label={t("properties.borderColor")}
            className="h-7 w-7 shrink-0 cursor-pointer rounded border border-input bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            value={element.borderColor ?? "#000000"}
            onChange={(e) =>
              onUpdate({
                borderColor: e.target.value,
                borderWidth: element.borderWidth || 1,
              })
            }
          />
          {element.borderColor && (
            <button
              type="button"
              aria-label={t("properties.clearBorderColor")}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-input text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              onClick={() => onUpdate({ borderColor: null, borderWidth: 0 })}
            >
              ✕
            </button>
          )}
          <span className="text-[10px] font-mono text-muted-foreground">
            {element.borderColor ?? t("properties.none")}
          </span>
        </div>
      </PropertyField>
      {element.borderColor && (
        <PropertyField label={t("properties.borderWidth")}>
          <div className="flex items-center gap-2">
            <input
              type="range"
              aria-label={t("properties.borderWidth")}
              min={0}
              max={5}
              step={0.5}
              value={element.borderWidth}
              onChange={(e) =>
                onUpdate({ borderWidth: Number(e.target.value) })
              }
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-accent outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            <span className="w-6 text-right text-[10px] font-mono tabular-nums text-muted-foreground">
              {element.borderWidth}
            </span>
          </div>
        </PropertyField>
      )}
    </>
  );
}

function TypographySection({
  element,
  onUpdate,
}: {
  element: ElementWithTypography;
  onUpdate: (updates: Partial<ElementWithTypography>) => void;
}) {
  const { t } = useTranslation();
  const fontSizeField = useDeferredValue(element.fontSize, (v) => {
    const fs = Number(v);
    const updates: Partial<ElementWithTypography> = { fontSize: fs };
    if (isTextField(element) && !element.multiline) {
      (updates as Partial<TextField>).height = heightFromFontSize(fs);
    }
    onUpdate(updates);
  });
  return (
    <>
      <FontFamilySelect
        value={element.fontFamily}
        onChange={(v) => onUpdate({ fontFamily: v })}
      />
      <div className="flex items-end gap-2">
        <PropertyField label={t("properties.fontSize")}>
          <NumericInput {...fontSizeField} />
        </PropertyField>
        <BoldItalicButtons
          fontWeight={element.fontWeight}
          onChange={(w) => onUpdate({ fontWeight: w })}
        />
      </div>
      <TextColorPicker
        value={element.textColor}
        onChange={(v) => onUpdate({ textColor: v })}
      />
    </>
  );
}

function TextFieldProperties({ elementId }: { elementId: string }) {
  const { t } = useTranslation();
  const requiredId = useId();
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
  const maxLengthField = useDeferredValue(element.maxLength ?? "", (v) =>
    updateElement(element.id, {
      maxLength: v ? Number(v) : undefined,
    }),
  );

  return (
    <div className="flex flex-col gap-3">
      <CollapsibleSection label={t("properties.general")}>
        <PropertyField label={t("properties.name")}>
          <Input {...nameField} maxLength={MAX_FIELD_NAME_LENGTH} className="h-7 text-xs" />
        </PropertyField>

        <PropertyField label={t("properties.defaultValue")}>
          <Input {...defaultValueField} className="h-7 text-xs" />
        </PropertyField>

        <div className="flex items-center justify-between">
          <Label id={requiredId} className="text-[11px] text-muted-foreground">
            {t("properties.required")}
          </Label>
          <Switch
            aria-labelledby={requiredId}
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
      </CollapsibleSection>

      <Separator />
      <CollapsibleSection label={t("properties.typography")}>
        <TypographySection
          element={element}
          onUpdate={(updates) => updateElement(element.id, updates)}
        />
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
      </CollapsibleSection>

      <Separator />
      <CollapsibleSection label={t("properties.appearance")}>
        <AppearanceSection
          element={element}
          onUpdate={(updates) => updateElement(element.id, updates)}
        />
      </CollapsibleSection>
    </div>
  );
}

function CheckboxProperties({ elementId }: { elementId: string }) {
  const { t } = useTranslation();
  const defaultCheckedId = useId();
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
      <CollapsibleSection label={t("properties.general")}>
        <PropertyField label={t("properties.name")}>
          <Input {...nameField} maxLength={MAX_FIELD_NAME_LENGTH} className="h-7 text-xs" />
        </PropertyField>

        <div className="flex items-center justify-between">
          <Label id={defaultCheckedId} className="text-[11px] text-muted-foreground">
            {t("properties.defaultChecked")}
          </Label>
          <Switch
            aria-labelledby={defaultCheckedId}
            checked={element.defaultChecked}
            onCheckedChange={(checked) =>
              updateElement(element.id, { defaultChecked: checked })
            }
          />
        </div>
      </CollapsibleSection>
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
      <CollapsibleSection label={t("properties.general")}>
        <PropertyField label={t("properties.groupName")}>
          <Input {...groupNameField} maxLength={MAX_FIELD_NAME_LENGTH} className="h-7 text-xs" />
        </PropertyField>

        <PropertyField label={t("properties.value")}>
          <Input {...valueField} maxLength={MAX_FIELD_NAME_LENGTH} className="h-7 text-xs" />
        </PropertyField>

        <PropertyField label={t("properties.label")}>
          <Input {...labelField} className="h-7 text-xs" />
        </PropertyField>
      </CollapsibleSection>
    </div>
  );
}

function DraggableOptionList({
  options,
  defaultValue,
  elementId,
  onUpdateOption,
  onRemoveOption,
  onReorderOptions,
  onSetDefault,
}: {
  options: string[];
  defaultValue: string;
  elementId: string;
  onUpdateOption: (index: number, value: string) => void;
  onRemoveOption: (index: number) => void;
  onReorderOptions: (fromIndex: number, toIndex: number) => void;
  onSetDefault: (value: string) => void;
}) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const dragIndexRef = useRef<number | null>(null);
  const insertIndexRef = useRef<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [indicatorY, setIndicatorY] = useState<number | null>(null);

  const getRowRects = useCallback(() => {
    if (!containerRef.current) return [];
    const rows =
      containerRef.current.querySelectorAll<HTMLElement>("[data-opt-row]");
    return Array.from(rows).map((row) => row.getBoundingClientRect());
  }, []);

  const computeInsert = useCallback(
    (pointerY: number): { index: number; y: number } | null => {
      const rects = getRowRects();
      if (rects.length === 0) return null;
      for (let i = 0; i < rects.length; i++) {
        const mid = rects[i].top + rects[i].height / 2;
        if (pointerY < mid) {
          return { index: i, y: rects[i].top - 1 };
        }
      }
      const last = rects[rects.length - 1];
      return { index: rects.length, y: last.bottom + 1 };
    },
    [getRowRects],
  );

  const handlePointerDown = useCallback(
    (index: number, e: React.PointerEvent) => {
      e.preventDefault();
      dragIndexRef.current = index;
      insertIndexRef.current = index;
      setDragIndex(index);
      setIndicatorY(null);

      const startY = e.clientY;
      let moved = false;

      const onMove = (ev: PointerEvent) => {
        const dy = Math.abs(ev.clientY - startY);
        if (!moved && dy < 4) return;
        if (!moved) {
          moved = true;
          lockCursor("grab");
        }
        const result = computeInsert(ev.clientY);
        if (result) {
          insertIndexRef.current = result.index;
          setIndicatorY(result.y);
        }
      };

      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        unlockCursor();
        const from = dragIndexRef.current;
        const to = insertIndexRef.current;
        dragIndexRef.current = null;
        insertIndexRef.current = null;
        setDragIndex(null);
        setIndicatorY(null);
        if (from !== null && to !== null && from !== to) {
          onReorderOptions(from, to);
        }
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [computeInsert, onReorderOptions],
  );

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5 overflow-hidden">
      {indicatorY !== null && containerRef.current && (
        <div
          className="pointer-events-none absolute left-0 right-0 h-0.5 -translate-y-1/2 rounded-full bg-primary"
          style={{
            top: indicatorY - containerRef.current.getBoundingClientRect().top,
          }}
        />
      )}
      {options.map((opt, i) => {
        const isDragging = dragIndex === i;
        return (
          <div
            key={i}
            data-opt-row
            className={`flex items-center gap-1 rounded-sm transition-opacity ${
              isDragging ? "opacity-25" : ""
            }`}
          >
            <button
              type="button"
              aria-label={t("properties.dragOption", { index: i + 1 })}
              className="flex h-6 w-4 shrink-0 cursor-grab items-center justify-center text-muted-foreground/40 hover:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-card rounded-sm"
              onPointerDown={(e) => handlePointerDown(i, e)}
            >
              <GripVertical className="h-3 w-3" />
            </button>
            <input
              type="radio"
              name={`default-${elementId}`}
              aria-label={t("properties.setDefaultOption", { index: i + 1 })}
              checked={defaultValue === opt}
              onChange={() => onSetDefault(opt)}
              className="h-3.5 w-3.5 shrink-0 accent-primary rounded-full ring-offset-1 ring-offset-card outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            <Input
              value={opt}
              onChange={(e) => onUpdateOption(i, e.target.value)}
              className="h-6 min-w-0 flex-1 text-xs"
            />
            <button
              type="button"
              aria-label={t("properties.removeOption", { index: i + 1 })}
              onClick={() => onRemoveOption(i)}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-card"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

function DropdownProperties({ elementId }: { elementId: string }) {
  const { t } = useTranslation();
  const requiredId = useId();
  const editableId = useId();
  const element = useEditorStore((s) =>
    s.elements.find((el) => el.id === elementId),
  );
  const updateElement = useEditorStore((s) => s.updateElement);

  if (!element || !isDropdownField(element)) return null;

  const nameField = useDeferredValue(element.name, (v) =>
    updateElement(element.id, { name: v }),
  );

  const addOption = () => {
    if (element.options.length >= MAX_OPTIONS_PER_FIELD) return;
    const next = element.options.length + 1;
    updateElement(element.id, {
      options: [...element.options, t("properties.newOption", { index: next })],
    });
  };

  const removeOption = (index: number) => {
    updateElement(element.id, {
      options: element.options.filter((_, i) => i !== index),
    });
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...element.options];
    newOptions[index] = value;
    updateElement(element.id, { options: newOptions });
  };

  const reorderOptions = (fromIndex: number, toIndex: number) => {
    const newOptions = [...element.options];
    const [moved] = newOptions.splice(fromIndex, 1);
    newOptions.splice(toIndex, 0, moved);
    updateElement(element.id, { options: newOptions });
  };

  return (
    <div className="flex flex-col gap-3">
      <CollapsibleSection label={t("properties.general")}>
        <PropertyField label={t("properties.name")}>
          <Input {...nameField} maxLength={MAX_FIELD_NAME_LENGTH} className="h-7 text-xs" />
        </PropertyField>

        <div className="flex items-center justify-between">
          <Label id={requiredId} className="text-[11px] text-muted-foreground">
            {t("properties.required")}
          </Label>
          <Switch
            aria-labelledby={requiredId}
            checked={element.required}
            onCheckedChange={(checked) =>
              updateElement(element.id, { required: checked })
            }
          />
        </div>
      </CollapsibleSection>

      <Separator />
      <CollapsibleSection label={t("properties.typography")}>
        <TypographySection
          element={element}
          onUpdate={(updates) => updateElement(element.id, updates)}
        />
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">
            {t("properties.height")}
          </Label>
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
            {t("properties.pt", { value: Math.round(element.height) })}
          </span>
        </div>
      </CollapsibleSection>

      <Separator />
      <CollapsibleSection label={t("properties.options")}>
        <DraggableOptionList
          options={element.options}
          defaultValue={element.defaultValue}
          elementId={element.id}
          onUpdateOption={updateOption}
          onRemoveOption={removeOption}
          onReorderOptions={reorderOptions}
          onSetDefault={(v) => updateElement(element.id, { defaultValue: v })}
        />
        <button
          type="button"
          aria-label={t("properties.addOption")}
          onClick={addOption}
          disabled={element.options.length >= MAX_OPTIONS_PER_FIELD}
          className="flex h-6 items-center justify-center rounded border border-dashed border-input text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-card disabled:opacity-40 disabled:cursor-not-allowed"
        >
          +
        </button>

        <div className="flex items-center justify-between">
          <Label id={editableId} className="text-[11px] text-muted-foreground">
            {t("properties.editable")}
          </Label>
          <Switch
            aria-labelledby={editableId}
            checked={element.editable}
            onCheckedChange={(checked) =>
              updateElement(element.id, { editable: checked })
            }
          />
        </div>
      </CollapsibleSection>

      <Separator />
      <CollapsibleSection label={t("properties.appearance")}>
        <AppearanceSection
          element={element}
          onUpdate={(updates) => updateElement(element.id, updates)}
        />
      </CollapsibleSection>
    </div>
  );
}

function ButtonProperties({ elementId }: { elementId: string }) {
  const { t } = useTranslation();
  const element = useEditorStore((s) =>
    s.elements.find((el) => el.id === elementId),
  );
  const updateElement = useEditorStore((s) => s.updateElement);

  if (!element || !isButtonField(element)) return null;

  const nameField = useDeferredValue(element.name, (v) =>
    updateElement(element.id, { name: v }),
  );
  const labelField = useDeferredValue(element.label, (v) =>
    updateElement(element.id, { label: v }),
  );

  return (
    <div className="flex flex-col gap-3">
      <CollapsibleSection label={t("properties.general")}>
        <PropertyField label={t("properties.name")}>
          <Input {...nameField} maxLength={MAX_FIELD_NAME_LENGTH} className="h-7 text-xs" />
        </PropertyField>

        <PropertyField label={t("properties.label")}>
          <Input {...labelField} className="h-7 text-xs" />
        </PropertyField>
      </CollapsibleSection>

      <Separator />
      <CollapsibleSection label={t("properties.typography")}>
        <TypographySection
          element={element}
          onUpdate={(updates) => updateElement(element.id, updates)}
        />
      </CollapsibleSection>

      <Separator />
      <CollapsibleSection label={t("properties.appearance")}>
        <AppearanceSection
          element={element}
          onUpdate={(updates) => updateElement(element.id, updates)}
        />
      </CollapsibleSection>
    </div>
  );
}

function OptionListProperties({ elementId }: { elementId: string }) {
  const { t } = useTranslation();
  const requiredId = useId();
  const element = useEditorStore((s) =>
    s.elements.find((el) => el.id === elementId),
  );
  const updateElement = useEditorStore((s) => s.updateElement);

  if (!element || !isOptionListField(element)) return null;

  const nameField = useDeferredValue(element.name, (v) =>
    updateElement(element.id, { name: v }),
  );

  const addOption = () => {
    if (element.options.length >= MAX_OPTIONS_PER_FIELD) return;
    const next = element.options.length + 1;
    const newOptions = [...element.options, t("properties.newOption", { index: next })];
    updateElement(element.id, {
      options: newOptions,
      height: heightFromOptions(element.fontSize, newOptions.length),
    });
  };

  const removeOption = (index: number) => {
    const newOptions = element.options.filter((_, i) => i !== index);
    updateElement(element.id, {
      options: newOptions,
      height: heightFromOptions(element.fontSize, newOptions.length),
    });
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...element.options];
    newOptions[index] = value;
    updateElement(element.id, { options: newOptions });
  };

  const reorderOptions = (fromIndex: number, toIndex: number) => {
    const newOptions = [...element.options];
    const [moved] = newOptions.splice(fromIndex, 1);
    newOptions.splice(toIndex, 0, moved);
    updateElement(element.id, { options: newOptions });
  };

  return (
    <div className="flex flex-col gap-3">
      <CollapsibleSection label={t("properties.general")}>
        <PropertyField label={t("properties.name")}>
          <Input {...nameField} maxLength={MAX_FIELD_NAME_LENGTH} className="h-7 text-xs" />
        </PropertyField>

        <div className="flex items-center justify-between">
          <Label id={requiredId} className="text-[11px] text-muted-foreground">
            {t("properties.required")}
          </Label>
          <Switch
            aria-labelledby={requiredId}
            checked={element.required}
            onCheckedChange={(checked) =>
              updateElement(element.id, { required: checked })
            }
          />
        </div>
      </CollapsibleSection>

      <Separator />
      <CollapsibleSection label={t("properties.typography")}>
        <TypographySection
          element={element}
          onUpdate={(updates) => updateElement(element.id, updates)}
        />
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">
            {t("properties.height")}
          </Label>
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
            {t("properties.pt", { value: Math.round(element.height) })}
          </span>
        </div>
      </CollapsibleSection>

      <Separator />
      <CollapsibleSection label={t("properties.options")}>
        <DraggableOptionList
          options={element.options}
          defaultValue={element.defaultValue}
          elementId={element.id}
          onUpdateOption={updateOption}
          onRemoveOption={removeOption}
          onReorderOptions={reorderOptions}
          onSetDefault={(v) => updateElement(element.id, { defaultValue: v })}
        />
        <button
          type="button"
          aria-label={t("properties.addOption")}
          onClick={addOption}
          disabled={element.options.length >= MAX_OPTIONS_PER_FIELD}
          className="flex h-6 items-center justify-center rounded border border-dashed border-input text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-card disabled:opacity-40 disabled:cursor-not-allowed"
        >
          +
        </button>
      </CollapsibleSection>

      <Separator />
      <CollapsibleSection label={t("properties.appearance")}>
        <AppearanceSection
          element={element}
          onUpdate={(updates) => updateElement(element.id, updates)}
        />
      </CollapsibleSection>
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
  const isAutoHeight =
    (isTextField(element) && !element.multiline) ||
    isDropdownField(element) ||
    isOptionListField(element);

  const xField = useDeferredValue(displayX, (v) => {
    const resolved = resolveElementPosition(
      pages,
      element.pageNumber,
      Number(v),
      element.y,
    );
    updateElement(element.id, {
      x: resolved.x,
      pageNumber: resolved.pageNumber,
    });
  });
  const yField = useDeferredValue(displayY, (v) => {
    const resolved = resolveElementPosition(
      pages,
      element.pageNumber,
      element.x,
      Number(v),
    );
    updateElement(element.id, {
      y: resolved.y,
      pageNumber: resolved.pageNumber,
    });
  });
  const wField = useDeferredValue(displayW, (v) =>
    updateElement(element.id, { width: Number(v) }),
  );
  const hField = useDeferredValue(displayH, (v) =>
    updateElement(element.id, { height: Number(v) }),
  );

  return (
    <>
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
    </>
  );
}

function MultiTypographySection({
  elements,
}: {
  elements: ElementWithTypography[];
}) {
  const { t } = useTranslation();
  const batchUpdateElements = useEditorStore((s) => s.batchUpdateElements);

  const allSameFontFamily = elements.every(
    (el) => el.fontFamily === elements[0].fontFamily,
  );
  const allSameFontSize = elements.every(
    (el) => el.fontSize === elements[0].fontSize,
  );
  const allSameTextColor = elements.every(
    (el) => el.textColor === elements[0].textColor,
  );

  const allSameFontWeight = elements.every(
    (el) => el.fontWeight === elements[0].fontWeight,
  );

  const fontSizeField = useDeferredValue(
    allSameFontSize ? elements[0].fontSize : "",
    (v) => {
      const val = Number(v);
      batchUpdateElements(
        elements.map((el) => {
          const changes: Partial<FormElement> & { fontSize: number } = {
            fontSize: val,
          };
          if (isTextField(el) && !el.multiline) {
            (changes as Partial<TextField>).height = heightFromFontSize(val);
          }
          return { id: el.id, changes };
        }),
      );
    },
  );

  const mixed = t("properties.mixed");
  const hasSingleLine = elements.some((el) => isTextField(el) && !el.multiline);

  return (
    <>
      <FontFamilySelect
        value={allSameFontFamily ? elements[0].fontFamily : ""}
        onChange={(v) =>
          batchUpdateElements(
            elements.map((el) => ({ id: el.id, changes: { fontFamily: v } })),
          )
        }
      />
      <div className="flex items-end gap-2">
        <PropertyField label={t("properties.fontSize")}>
          <NumericInput
            {...fontSizeField}
            placeholder={allSameFontSize ? undefined : mixed}
          />
        </PropertyField>
        <BoldItalicButtons
          fontWeight={allSameFontWeight ? elements[0].fontWeight : "regular"}
          onChange={(w) =>
            batchUpdateElements(
              elements.map((el) => ({ id: el.id, changes: { fontWeight: w } })),
            )
          }
        />
      </div>
      <TextColorPicker
        value={allSameTextColor ? elements[0].textColor : "#000000"}
        onChange={(v) =>
          batchUpdateElements(
            elements.map((el) => ({ id: el.id, changes: { textColor: v } })),
          )
        }
      />
      {hasSingleLine && (
        <p className="text-[10px] text-muted-foreground">
          {t("properties.singleLineAutoHeight")}
        </p>
      )}
    </>
  );
}

function MultiAppearanceSection({
  elements,
}: {
  elements: ElementWithTypography[];
}) {
  const batchUpdateElements = useEditorStore((s) => s.batchUpdateElements);

  const allSameBg = elements.every(
    (el) => el.backgroundColor === elements[0].backgroundColor,
  );
  const allSameBorder = elements.every(
    (el) => el.borderColor === elements[0].borderColor,
  );

  const representative: TypographyField = {
    fontFamily: "",
    fontWeight: "regular",
    fontSize: 12,
    textColor: "#000000",
    backgroundColor: allSameBg ? elements[0].backgroundColor : null,
    borderColor: allSameBorder ? elements[0].borderColor : null,
    borderWidth: elements[0].borderWidth,
  };

  return (
    <AppearanceSection
      element={representative}
      onUpdate={(updates) =>
        batchUpdateElements(
          elements.map((el) => ({ id: el.id, changes: updates })),
        )
      }
    />
  );
}

function MultiNameField({
  elements,
}: {
  elements: { name: string; id: string }[];
}) {
  const { t } = useTranslation();
  const batchUpdateElements = useEditorStore((s) => s.batchUpdateElements);
  const allSame = elements.every((el) => el.name === elements[0].name);
  const nameField = useDeferredValue(allSame ? elements[0].name : "", (v) =>
    batchUpdateElements(
      elements.map((el) => ({ id: el.id, changes: { name: v } })),
    ),
  );
  return (
    <PropertyField label={t("properties.name")}>
      <Input
        {...nameField}
        maxLength={MAX_FIELD_NAME_LENGTH}
        placeholder={allSame ? undefined : t("properties.mixed")}
        className="h-7 text-xs"
      />
    </PropertyField>
  );
}

function MultiRequiredSwitch({
  elements,
}: {
  elements: { required: boolean; id: string }[];
}) {
  const { t } = useTranslation();
  const requiredId = useId();
  const batchUpdateElements = useEditorStore((s) => s.batchUpdateElements);
  const allSame = elements.every((el) => el.required === elements[0].required);

  return (
    <div className="flex items-center justify-between">
      <Label id={requiredId} className="text-[11px] text-muted-foreground">
        {t("properties.required")}
      </Label>
      <Switch
        aria-labelledby={requiredId}
        checked={allSame ? elements[0].required : false}
        onCheckedChange={(checked) =>
          batchUpdateElements(
            elements.map((el) => ({
              id: el.id,
              changes: { required: checked },
            })),
          )
        }
      />
    </div>
  );
}

function MultiTextFieldProperties({ elements }: { elements: TextField[] }) {
  const { t } = useTranslation();
  const batchUpdateElements = useEditorStore((s) => s.batchUpdateElements);

  if (elements.length === 0) return null;

  const allSameDefaultValue = elements.every(
    (el) => el.defaultValue === elements[0].defaultValue,
  );
  const allSameMaxLength = elements.every(
    (el) => el.maxLength === elements[0].maxLength,
  );

  const defaultValueField = useDeferredValue(
    allSameDefaultValue ? elements[0].defaultValue : "",
    (v) =>
      batchUpdateElements(
        elements.map((el) => ({ id: el.id, changes: { defaultValue: v } })),
      ),
  );

  const maxLengthField = useDeferredValue(
    allSameMaxLength ? (elements[0].maxLength ?? "") : "",
    (v) =>
      batchUpdateElements(
        elements.map((el) => ({
          id: el.id,
          changes: { maxLength: v ? Number(v) : undefined },
        })),
      ),
  );

  const mixed = t("properties.mixed");

  return (
    <>
      <PropertyField label={t("properties.defaultValue")}>
        <Input
          {...defaultValueField}
          placeholder={allSameDefaultValue ? undefined : mixed}
          className="h-7 text-xs"
        />
      </PropertyField>
      <PropertyField label={t("properties.maxLength")}>
        <NumericInput
          {...maxLengthField}
          placeholder={allSameMaxLength ? t("properties.noLimit") : mixed}
        />
      </PropertyField>
    </>
  );
}

function MultiCheckboxProperties({ elements }: { elements: Checkbox[] }) {
  const { t } = useTranslation();
  const defaultCheckedId = useId();
  const batchUpdateElements = useEditorStore((s) => s.batchUpdateElements);

  if (elements.length === 0) return null;

  const allSameChecked = elements.every(
    (el) => el.defaultChecked === elements[0].defaultChecked,
  );
  return (
    <>
      <div className="flex items-center justify-between">
        <Label id={defaultCheckedId} className="text-[11px] text-muted-foreground">
          {t("properties.defaultChecked")}
        </Label>
        <Switch
          aria-labelledby={defaultCheckedId}
          checked={allSameChecked ? elements[0].defaultChecked : false}
          onCheckedChange={(checked) =>
            batchUpdateElements(
              elements.map((el) => ({
                id: el.id,
                changes: { defaultChecked: checked },
              })),
            )
          }
        />
      </div>
    </>
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

  const mixed = t("properties.mixed");

  return (
    <>
      <PropertyField label={t("properties.groupName")}>
        <Input
          {...groupNameField}
          placeholder={allSameGroup ? undefined : mixed}
          className="h-7 text-xs"
        />
      </PropertyField>
    </>
  );
}

function MultiDropdownProperties({ elements }: { elements: DropdownField[] }) {
  const { t } = useTranslation();
  const editableId = useId();
  const batchUpdateElements = useEditorStore((s) => s.batchUpdateElements);

  if (elements.length === 0) return null;

  const allSameEditable = elements.every(
    (el) => el.editable === elements[0].editable,
  );

  return (
    <div className="flex items-center justify-between">
      <Label id={editableId} className="text-[11px] text-muted-foreground">
        {t("properties.editable")}
      </Label>
      <Switch
        aria-labelledby={editableId}
        checked={allSameEditable ? elements[0].editable : false}
        onCheckedChange={(checked) =>
          batchUpdateElements(
            elements.map((el) => ({
              id: el.id,
              changes: { editable: checked },
            })),
          )
        }
      />
    </div>
  );
}

function MultiButtonProperties({ elements }: { elements: ButtonField[] }) {
  const { t } = useTranslation();
  const batchUpdateElements = useEditorStore((s) => s.batchUpdateElements);

  if (elements.length === 0) return null;

  const allSameLabel = elements.every((el) => el.label === elements[0].label);

  const labelField = useDeferredValue(
    allSameLabel ? elements[0].label : "",
    (v) =>
      batchUpdateElements(
        elements.map((el) => ({ id: el.id, changes: { label: v } })),
      ),
  );

  return (
    <PropertyField label={t("properties.label")}>
      <Input
        {...labelField}
        placeholder={allSameLabel ? undefined : t("properties.mixed")}
        className="h-7 text-xs"
      />
    </PropertyField>
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
    (el) =>
      !(isTextField(el) && !el.multiline) &&
      !isDropdownField(el) &&
      !isOptionListField(el),
  );
  const allSameH =
    resizableElements.length > 0 &&
    resizableElements.every((el) => el.height === resizableElements[0].height);

  const heightDisplayValue = allSameH
    ? Math.round(resizableElements[0].height)
    : "";
  const hasAutoHeight = elements.some(
    (el) =>
      (isTextField(el) && !el.multiline) ||
      isDropdownField(el) ||
      isOptionListField(el),
  );

  const xField = useDeferredValue(
    allSameX ? Math.round(elements[0].x) : "",
    (v) => {
      const newX = Number(v);
      batchUpdateElements(
        elements.map((el) => {
          const resolved = resolveElementPosition(
            pages,
            el.pageNumber,
            newX,
            el.y,
          );
          return {
            id: el.id,
            changes: { x: resolved.x, pageNumber: resolved.pageNumber },
          };
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
          const resolved = resolveElementPosition(
            pages,
            el.pageNumber,
            el.x,
            newY,
          );
          return {
            id: el.id,
            changes: { y: resolved.y, pageNumber: resolved.pageNumber },
          };
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
  const hField = useDeferredValue(heightDisplayValue, (v) =>
    batchUpdateElements(
      elements
        .filter(
          (el) =>
            !(isTextField(el) && !el.multiline) &&
            !isDropdownField(el) &&
            !isOptionListField(el),
        )
        .map((el) => ({ id: el.id, changes: { height: Number(v) } })),
    ),
  );

  return (
    <>
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
    </>
  );
}

function AlignmentSection() {
  const { t } = useTranslation();
  const selectedIds = useEditorStore((s) => s.selectedIds);

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-3">
        <CollapsibleSection label={t("properties.center")}>
          <CenterOnPageButtons />
        </CollapsibleSection>
        {selectedIds.size >= 2 && (
          <CollapsibleSection label={t("properties.alignment")}>
            <AlignButtons />
          </CollapsibleSection>
        )}
        {selectedIds.size >= 2 && (
          <CollapsibleSection label={t("properties.adjustSizing")}>
            <SizingButtons />
          </CollapsibleSection>
        )}
        {selectedIds.size >= 3 && (
          <CollapsibleSection label={t("properties.distribute")}>
            <DistributeButtons />
          </CollapsibleSection>
        )}
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
        aria-label={title}
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
  );
}

function AlignButtons() {
  const { t } = useTranslation();
  const alignElements = useEditorStore((s) => s.alignElements);

  return (
    <>
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
    </>
  );
}

function SizingButtons() {
  const { t } = useTranslation();
  const matchElementSize = useEditorStore((s) => s.matchElementSize);

  return (
    <>
      <div className="flex items-center gap-1">
        <span className="flex w-8 items-center justify-center text-[9px] font-medium text-muted-foreground">
          {t("properties.widthShort")}
        </span>
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
        <span className="flex w-8 items-center justify-center text-[9px] font-medium text-muted-foreground">
          {t("properties.heightShort")}
        </span>
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
    </>
  );
}

function DistributeButtons() {
  const { t } = useTranslation();
  const distributeElements = useEditorStore((s) => s.distributeElements);

  return (
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
  );
}

export function PropertiesPanel() {
  const { t } = useTranslation();
  const collapsed = useEditorStore((s) => s.propertiesPanelCollapsed);
  const togglePropertiesPanel = useEditorStore((s) => s.togglePropertiesPanel);

  return (
    <ErrorBoundary>
      <div className="flex h-full flex-col">
        {collapsed ? (
          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              onClick={togglePropertiesPanel}
              aria-label={t("properties.expandPanel")}
              aria-expanded={false}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-end px-1.5 pt-1.5">
              <button
                type="button"
                onClick={togglePropertiesPanel}
                aria-label={t("properties.collapsePanel")}
                aria-expanded={true}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <PropertiesPanelContent />
            </div>
            <div className="shrink-0 border-t border-border px-3 py-2.5">
              <button
                type="button"
                onClick={() => openUrl("https://ko-fi.com/basicallypolaris")}
                className="flex w-full items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-[11px] text-muted-foreground/60 transition-colors hover:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Heart className="h-3 w-3" />
                {t("properties.kofi")}
              </button>
            </div>
          </>
        )}
      </div>
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
  const pages = useEditorStore((s) => s.pages);

  const isHorizontal = guide?.orientation === "horizontal";
  const isLiveDragging =
    guide &&
    selectedGuideId === guideId &&
    previewGuide !== null &&
    previewGuide.orientation === guide.orientation;
  const livePosition = isLiveDragging
    ? previewGuide!.position
    : (guide?.position ?? 0);
  const maxPos = isHorizontal
    ? (pages[0]?.height ?? Infinity)
    : (pages[0]?.width ?? Infinity);

  const posField = useDeferredValue(Math.round(livePosition), (v) => {
    if (guide)
      updateGuidePosition(guide.id, Math.max(0, Math.min(Number(v), maxPos)));
  });

  if (!guide) return null;

  const Icon = isHorizontal ? MoveHorizontal : MoveVertical;
  const orientationLabel = isHorizontal
    ? t("properties.horizontal")
    : t("properties.vertical");
  const posLabel = isHorizontal ? "Y" : "X";

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

  const selectedElements = useMemo(
    () => elements.filter((el) => selectedIds.has(el.id)),
    [elements, selectedIds],
  );

  const multiSelectMemo = useMemo(() => {
    if (selectedIds.size <= 1) return null;
    const types = new Set(selectedElements.map((el) => el.type));
    const allSameType = types.size === 1;
    const singleType = allSameType ? [...types][0] : null;
    const config = singleType ? getElementStyleConfigByType(singleType) : null;

    const namedEls = selectedElements.filter(
      (el): el is FormElement & { name: string } => "name" in el,
    );
    const requiredEls = selectedElements.filter(
      (el): el is FormElement & { required: boolean } => "required" in el,
    );
    const textEls =
      singleType === "text" ? selectedElements.filter(isTextField) : [];
    const checkboxEls =
      singleType === "checkbox" ? selectedElements.filter(isCheckbox) : [];
    const radioEls =
      singleType === "radio" ? selectedElements.filter(isRadioButton) : [];
    const dropdownEls =
      singleType === "dropdown" ? selectedElements.filter(isDropdownField) : [];
    const buttonEls =
      singleType === "button" ? selectedElements.filter(isButtonField) : [];
    const typoEls = selectedElements.filter(elementHasTypography);

    return {
      types,
      singleType,
      config,
      namedEls,
      requiredEls,
      textEls,
      checkboxEls,
      radioEls,
      dropdownEls,
      buttonEls,
      typoEls,
    };
  }, [selectedElements, selectedIds]);

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

  if (selectedIds.size > 1 && multiSelectMemo) {
    const {
      singleType,
      config,
      namedEls,
      requiredEls,
      textEls,
      checkboxEls,
      radioEls,
      dropdownEls,
      buttonEls,
      typoEls,
    } = multiSelectMemo;

    return (
      <div className="h-full overflow-y-auto">
        <div className="flex flex-col gap-3 p-3">
          <div className="flex items-center gap-2">
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
                      dropdown: t("properties.dropdowns"),
                      button: t("properties.buttons"),
                      optionlist: t("properties.optionLists"),
                    }[singleType]
                  : t("properties.mixedTypes")}
              </span>
            </div>
          </div>
          <Separator />

          {namedEls.length > 0 || requiredEls.length > 0 ? (
            <CollapsibleSection label={t("properties.general")}>
              {namedEls.length > 0 && <MultiNameField elements={namedEls} />}
              {requiredEls.length > 0 && (
                <MultiRequiredSwitch elements={requiredEls} />
              )}
              {textEls.length > 0 && (
                <MultiTextFieldProperties elements={textEls} />
              )}
              {checkboxEls.length > 0 && (
                <MultiCheckboxProperties elements={checkboxEls} />
              )}
              {radioEls.length > 0 && (
                <MultiRadioProperties elements={radioEls} />
              )}
              {dropdownEls.length > 0 && (
                <MultiDropdownProperties elements={dropdownEls} />
              )}
              {buttonEls.length > 0 && (
                <MultiButtonProperties elements={buttonEls} />
              )}
            </CollapsibleSection>
          ) : null}

          {typoEls.length > 0 ? (
            <>
              <Separator />
              <CollapsibleSection label={t("properties.typography")}>
                <MultiTypographySection elements={typoEls} />
              </CollapsibleSection>
              <Separator />
              <CollapsibleSection label={t("properties.appearance")}>
                <MultiAppearanceSection elements={typoEls} />
              </CollapsibleSection>
            </>
          ) : null}

          <Separator />

          <CollapsibleSection label={t("properties.position")}>
            <MultiPositionProperties elements={selectedElements} />
          </CollapsibleSection>

          <Separator />

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
      <div className="flex flex-col gap-3 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${config.colorClass}`}
            >
              <Icon className="h-3 w-3" />
            </span>
            <span className="text-xs font-medium text-foreground truncate">
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
        <Separator />

        {isTextField(element) && <TextFieldProperties elementId={element.id} />}
        {isCheckbox(element) && <CheckboxProperties elementId={element.id} />}
        {isRadioButton(element) && (
          <RadioButtonProperties elementId={element.id} />
        )}
        {isDropdownField(element) && (
          <DropdownProperties elementId={element.id} />
        )}
        {isButtonField(element) && <ButtonProperties elementId={element.id} />}
        {isOptionListField(element) && (
          <OptionListProperties elementId={element.id} />
        )}
        <Separator />

        <CollapsibleSection label={t("properties.position")}>
          <SinglePositionProperties elementId={element.id} />
        </CollapsibleSection>
        <Separator />

        <CollapsibleSection label={t("properties.center")}>
          <CenterOnPageButtons />
        </CollapsibleSection>
      </div>
    </div>
  );
}
