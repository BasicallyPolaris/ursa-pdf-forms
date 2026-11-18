import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToolButton } from "@/components/ui/tool-button";
import {
  CALCULATION_OPERATIONS,
  createCalculationScript,
  type CalculationOperation,
} from "@/lib/form-calculation";
import { isTauriRuntime } from "@/lib/tauri-window";
import { cn } from "@/lib/utils";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

const JAVASCRIPT_DOCS =
  "https://developer.adobe.com/acrobat-pdfl-sdk/guides/jsapiref/";

type FormScriptControlsProps = {
  script?: string;
  onSave: (script: string | undefined, order?: number) => void;
} & (
  | { kind: "calculation"; sources: string[]; order?: number }
  | { kind: "button" }
);

export function FormScriptControls(props: FormScriptControlsProps) {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<"preset" | "editor" | null>(null);
  const isCalculation = props.kind === "calculation";
  const close = () => setDialog(null);

  function save(script: string | undefined, order?: number) {
    props.onSave(script, order);
    close();
  }

  return (
    <>
      <div className="flex flex-col gap-2 text-foreground">
        <span className="text-[11px] text-muted-foreground">
          {t(
            props.script
              ? "formScript.scriptSet"
              : isCalculation && props.sources.length === 0
                ? "formScript.noSources"
                : "formScript.noScript",
          )}
        </span>
        <div className="flex flex-wrap gap-1.5">
          <ToolButton
            type="button"
            className="border border-border text-foreground"
            onClick={() => setDialog("editor")}
          >
            {t("formScript.editScript")}
          </ToolButton>
          {isCalculation && (
            <ToolButton
              type="button"
              className="border border-border text-foreground"
              disabled={props.sources.length === 0}
              onClick={() => setDialog("preset")}
            >
              {t("formScript.usePreset")}
            </ToolButton>
          )}
        </div>
      </div>
      <Dialog open={dialog !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent
          className={cn(
            "max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] overflow-auto",
            dialog === "editor" && "max-w-2xl",
          )}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {dialog === "editor" && <ScriptEditor {...props} onSave={save} />}
          {dialog === "preset" && isCalculation && (
            <CalculationPreset
              sources={props.sources}
              hasScript={!!props.script}
              onUse={(script) => save(script, props.order)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ScriptEditor(props: FormScriptControlsProps) {
  const { t } = useTranslation();
  const id = useId();
  const isCalculation = props.kind === "calculation";
  const initialOrder = isCalculation ? props.order : undefined;
  const [draft, setDraft] = useState(props.script ?? "");
  const [order, setOrder] = useState(initialOrder?.toString() ?? "");
  const script = draft.trim() ? draft : undefined;
  const calculationOrder = script && order ? Number(order) : undefined;
  const changed = script !== props.script || calculationOrder !== initialOrder;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (changed) props.onSave(script, calculationOrder);
      }}
    >
      <div className="px-5 pt-5">
        <DialogTitle className="text-[15px]">
          {t(
            isCalculation
              ? "formScript.calculationEditor"
              : "formScript.buttonEditor",
          )}
        </DialogTitle>
        <DialogDescription className="mt-1 leading-relaxed">
          {t(
            isCalculation
              ? "formScript.calculationHelp"
              : "formScript.buttonHelp",
          )}
        </DialogDescription>
        <div className="mt-4 mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <label htmlFor={id} className="font-medium">
            {t("formScript.javascript")}
          </label>
          <a
            href={JAVASCRIPT_DOCS}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(event) => {
              if (!isTauriRuntime()) return;
              event.preventDefault();
              void openUrl(JAVASCRIPT_DOCS);
            }}
          >
            {t("formScript.documentation")}
            <ArrowUpRight size={13} aria-hidden />
          </a>
        </div>
        <textarea
          id={id}
          spellCheck={false}
          autoCapitalize="off"
          wrap="off"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={
            isCalculation ? "event.value = 0;" : 'app.alert("Hello!");'
          }
          className="block h-[min(38vh,20rem)] min-h-36 w-full resize-none overflow-auto rounded-lg border border-border bg-card p-3 font-mono text-xs leading-relaxed text-foreground caret-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        {isCalculation && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <label htmlFor={`${id}-order`}>
              {t("formScript.calculationOrder")}
            </label>
            <input
              id={`${id}-order`}
              type="number"
              min={1}
              max={Number.MAX_SAFE_INTEGER}
              step={1}
              value={order}
              onChange={(event) => setOrder(event.target.value)}
              placeholder={t("formScript.automatic")}
              disabled={!script}
              aria-describedby={`${id}-order-help`}
              className="h-8 w-28 rounded-md border border-border bg-card px-2 font-mono text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
            />
            <span id={`${id}-order-help`} className="text-muted-foreground">
              {t("formScript.orderHelp")}
            </span>
          </div>
        )}
      </div>
      <ScriptDialogFooter label={t("dialog.save")} disabled={!changed} />
    </form>
  );
}

function CalculationPreset({
  sources,
  hasScript,
  onUse,
}: {
  sources: string[];
  hasScript: boolean;
  onUse: (script: string) => void;
}) {
  const { t } = useTranslation();
  const [operation, setOperation] = useState<CalculationOperation>("SUM");
  const [selection, setSelection] = useState<string[]>([]);
  const selectedSources = sources.filter((name) => selection.includes(name));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (selectedSources.length) {
          onUse(createCalculationScript(operation, selectedSources));
        }
      }}
    >
      <div className="px-5 pt-5">
        <DialogTitle className="text-[15px]">
          {t("formScript.presetTitle")}
        </DialogTitle>
        <DialogDescription className="mt-1 leading-relaxed">
          {t(hasScript ? "formScript.replaceScript" : "formScript.presetHelp")}
        </DialogDescription>
        <label className="mt-4 flex items-center justify-between gap-3 text-xs">
          {t("formScript.operation")}
          <span className="relative">
            <select
              value={operation}
              onChange={(event) =>
                setOperation(event.target.value as CalculationOperation)
              }
              className="h-8 min-w-32 appearance-none rounded-md border border-border bg-card pr-8 pl-2.5 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {CALCULATION_OPERATIONS.map((operation) => (
                <option key={operation} value={operation}>
                  {t(`formScript.operations.${operation}`)}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
            />
          </span>
        </label>
        <fieldset className="mt-4 min-w-0">
          <legend className="text-xs font-medium">
            {t("formScript.sourceFields")}
          </legend>
          <div className="mt-2 grid max-h-48 gap-1.5 overflow-y-auto p-0.5 sm:grid-cols-2">
            {sources.map((name) => (
              <label
                key={name}
                className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-xs text-foreground hover:bg-accent/50 has-checked:border-muted-foreground/50"
              >
                <input
                  type="checkbox"
                  checked={selection.includes(name)}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setSelection((current) =>
                      checked
                        ? [...current, name]
                        : current.filter((field) => field !== name),
                    );
                  }}
                  className="shrink-0 accent-primary"
                />
                <span className="min-w-0 truncate" title={name}>
                  {name}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <ScriptDialogFooter
        label={t("formScript.useCalculation")}
        disabled={selectedSources.length === 0}
      />
    </form>
  );
}

function ScriptDialogFooter({
  label,
  disabled,
}: {
  label: string;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-5 flex justify-end gap-2 border-t border-border px-5 py-3">
      <DialogClose className="h-8 w-auto px-3 text-xs font-medium">
        {t("dialog.cancel")}
      </DialogClose>
      <ToolButton type="submit" variant="primary" disabled={disabled}>
        {label}
      </ToolButton>
    </div>
  );
}
