import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { getFieldsInTabOrder } from "@/lib/field-tab-order";
import { getElementName, type FormElement } from "@/lib/form-element-model";
import { useEditorStore } from "@/stores/editor-store";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const buttonClass =
  "rounded px-2 py-1 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 aria-disabled:opacity-40";

export function FieldOrderDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onKeyDown={(event) => event.stopPropagation()}
        className="p-4"
      >
        {open && <FieldOrderEditor onApply={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function FieldOrderEditor({ onApply }: { onApply: () => void }) {
  const { t } = useTranslation();
  const [document] = useState(() => useEditorStore.getState().pdfBytes);
  const elements = useEditorStore((state) => state.elements);
  const pages = useMemo(() => {
    const fieldsByPage = new Map<number, FormElement[]>();
    for (const field of getFieldsInTabOrder(elements)) {
      const fields = fieldsByPage.get(field.pageNumber) ?? [];
      fields.push(field);
      fieldsByPage.set(field.pageNumber, fields);
    }
    return [...fieldsByPage.entries()]
      .filter(([, fields]) => fields.length > 1)
      .sort(([a], [b]) => a - b)
      .map(([number, fields]) => ({ number, fields }));
  }, [elements]);
  const [pageNumber, setPageNumber] = useState(pages[0]?.number);
  const [draft, setDraft] = useState<Record<number, FormElement[]>>({});
  const page = pages.find(({ number }) => number === pageNumber) ?? pages[0];
  const fields = page ? (draft[page.number] ?? page.fields) : [];

  function move(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (!page || destination < 0 || destination >= fields.length) return;
    const reordered = [...fields];
    [reordered[index], reordered[destination]] = [
      reordered[destination],
      reordered[index],
    ];
    setDraft({ ...draft, [page.number]: reordered });
  }

  const updates = pages.flatMap(({ number, fields }) => {
    const ordered = draft[number];
    if (
      !ordered ||
      fields.every((field, index) => field.id === ordered[index]?.id)
    ) {
      return [];
    }
    return ordered.map((field, tabOrder) => ({
      id: field.id,
      changes: { tabOrder },
    }));
  });

  function apply() {
    const state = useEditorStore.getState();
    if (document === state.pdfBytes && updates.length > 0) {
      state.batchUpdateElements(updates);
    }
    onApply();
  }

  return (
    <>
      <DialogTitle>{t("fieldOrder.title")}</DialogTitle>
      <DialogDescription className="mt-1">
        {t("fieldOrder.description")}
      </DialogDescription>
      <label className="mt-4 flex items-center gap-2 text-xs">
        {t("properties.pageLabel")}
        <select
          value={page?.number ?? ""}
          onChange={(event) => setPageNumber(Number(event.target.value))}
          className="rounded border border-border bg-card px-2 py-1 font-mono focus-visible:ring-2 focus-visible:ring-ring"
        >
          {pages.map(({ number }) => (
            <option key={number}>{number}</option>
          ))}
        </select>
      </label>
      <ol className="mt-3 max-h-[45vh] list-decimal overflow-y-auto rounded border border-border pl-9 pr-2 text-xs">
        {fields.map((field, index) => {
          const fieldName = getElementName(field);
          const radioOption =
            field.type === "radio" && (field.label || field.value);
          const name =
            fieldName && radioOption && fieldName !== radioOption
              ? `${fieldName} · ${radioOption}`
              : fieldName || t("fieldOrder.unnamed");
          return (
            <li
              key={field.id}
              className="border-b border-border py-1 last:border-b-0 marker:font-mono"
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate" title={name}>
                  {name}
                </span>
                <span className="shrink-0 font-mono text-muted-foreground">
                  {Math.round(field.x)}, {Math.round(field.y)}
                </span>
                <button
                  type="button"
                  className={buttonClass}
                  aria-label={t("fieldOrder.moveUp", { name })}
                  aria-disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  className={buttonClass}
                  aria-label={t("fieldOrder.moveDown", { name })}
                  aria-disabled={index === fields.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={14} aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 flex justify-end gap-2">
        <DialogClose className="px-2 text-xs">{t("dialog.cancel")}</DialogClose>
        <button
          type="button"
          className={`${buttonClass} border border-border bg-accent`}
          disabled={updates.length === 0}
          onClick={apply}
        >
          {t("fieldOrder.apply")}
        </button>
      </div>
    </>
  );
}
