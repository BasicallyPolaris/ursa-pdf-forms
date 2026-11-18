import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToolButton } from "@/components/ui/tool-button";
import { getFieldsInTabOrder } from "@/lib/field-tab-order";
import { getElementName, type FormElement } from "@/lib/form-element-model";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { ChevronDown, GripVertical } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { useTranslation } from "react-i18next";

function findDropIndex(list: HTMLOListElement, y: number) {
  const index = Array.from(list.children).findIndex((row) => {
    const rect = row.getBoundingClientRect();
    return y < rect.top + rect.height / 2;
  });
  return index === -1 ? list.children.length : index;
}

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
        className="w-[calc(100%-2rem)] max-w-md"
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
  const pageInfos = useEditorStore((state) => state.pages);
  const pages = useMemo(() => {
    const fieldsByPage = new Map<number, FormElement[]>();
    for (const { pageNumber } of pageInfos) fieldsByPage.set(pageNumber, []);

    for (const field of getFieldsInTabOrder(elements)) {
      const fields = fieldsByPage.get(field.pageNumber);
      if (fields) fields.push(field);
      else if (pageInfos.length === 0)
        fieldsByPage.set(field.pageNumber, [field]);
    }
    return [...fieldsByPage.entries()]
      .sort(([a], [b]) => a - b)
      .map(([number, fields]) => ({ number, fields }));
  }, [elements, pageInfos]);
  const [pageNumber, setPageNumber] = useState(
    () =>
      pages.find(({ fields }) => fields.length > 1)?.number ?? pages[0]?.number,
  );
  const [draft, setDraft] = useState<Record<number, FormElement[]>>({});
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const listRef = useRef<HTMLOListElement>(null);
  const drag = useRef<{
    pointerId: number;
    from: number;
    startY: number;
    y: number;
  } | null>(null);
  const keyboardHelpId = useId();
  const page = pages.find(({ number }) => number === pageNumber) ?? pages[0];
  const fields = page ? (draft[page.number] ?? page.fields) : [];
  const dragging = dropIndex !== null;

  useEffect(() => {
    if (!dragging) return;

    let frame: number;
    const scroll = () => {
      const list = listRef.current;
      const activeDrag = drag.current;
      if (!list || !activeDrag) return;

      const { top, bottom } = list.getBoundingClientRect();
      const { y } = activeDrag;
      const previousScroll = list.scrollTop;
      if (y < top + 18) list.scrollTop -= 8;
      if (y > bottom - 18) list.scrollTop += 8;
      if (list.scrollTop !== previousScroll)
        setDropIndex(findDropIndex(list, y));
      frame = requestAnimationFrame(scroll);
    };
    frame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(frame);
  }, [dragging]);

  function move(from: number, to: number) {
    if (!page || to === from || to < 0 || to >= fields.length) return;
    const reordered = [...fields];
    const [field] = reordered.splice(from, 1);
    reordered.splice(to, 0, field);
    setDraft({ ...draft, [page.number]: reordered });
    setAnnouncement(
      t("fieldOrder.moved", { name: fieldName(field), position: to + 1 }),
    );
  }

  function startDrag(index: number, event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || drag.current || !listRef.current) return;
    listRef.current.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      from: index,
      startY: event.clientY,
      y: event.clientY,
    };
  }

  function trackDrag(event: PointerEvent<HTMLOListElement>) {
    const activeDrag = drag.current;
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
    if (!dragging && Math.abs(event.clientY - activeDrag.startY) < 4) return;

    activeDrag.y = event.clientY;
    setDropIndex(findDropIndex(event.currentTarget, event.clientY));
  }

  function stopDrag() {
    drag.current = null;
    setDropIndex(null);
  }

  function finishDrag(event: PointerEvent<HTMLOListElement>) {
    const activeDrag = drag.current;
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
    if (dragging) {
      const insertion = findDropIndex(event.currentTarget, event.clientY);
      move(
        activeDrag.from,
        insertion > activeDrag.from ? insertion - 1 : insertion,
      );
    }
    stopDrag();
  }

  function fieldName(field: FormElement) {
    const name = getElementName(field);
    const radioOption = field.type === "radio" && (field.label || field.value);
    return name && radioOption && name !== radioOption
      ? `${name} · ${radioOption}`
      : name || t("fieldOrder.unnamed");
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
      <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
        <div className="min-w-0">
          <DialogTitle className="text-[15px]">
            {t("fieldOrder.title")}
          </DialogTitle>
          <DialogDescription className="mt-1 leading-relaxed">
            {t("fieldOrder.description")}
          </DialogDescription>
        </div>
        {page && (
          <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            {t("properties.pageLabel")}
            <span className="relative">
              <select
                value={page.number}
                disabled={pages.length < 2}
                onChange={(event) => {
                  setPageNumber(Number(event.target.value));
                  if (listRef.current) listRef.current.scrollTop = 0;
                }}
                className="h-8 min-w-14 appearance-none rounded-md border border-border bg-card py-1 pr-7 pl-2.5 font-mono text-foreground outline-none enabled:hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:text-muted-foreground"
              >
                {pages.map(({ number }) => (
                  <option key={number}>{number}</option>
                ))}
              </select>
              <ChevronDown
                size={14}
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2"
              />
            </span>
          </label>
        )}
      </div>
      <p id={keyboardHelpId} className="sr-only">
        {t("fieldOrder.keyboardHelp")}
      </p>
      <span className="sr-only" role="status">
        {announcement}
      </span>
      {fields.length === 0 ? (
        <p className="mx-5 rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
          {t("fieldOrder.noFieldsOnPage")}
        </p>
      ) : (
        <ol
          ref={listRef}
          role="list"
          onPointerMove={trackDrag}
          onPointerUp={finishDrag}
          onPointerCancel={stopDrag}
          onLostPointerCapture={stopDrag}
          className="mx-5 flex max-h-[45vh] flex-col gap-2 overflow-y-auto py-2 select-none"
        >
          {fields.map((field, index) => {
            const name = fieldName(field);
            const from = drag.current?.from;
            const showDrop =
              dragging && dropIndex !== from && dropIndex !== (from ?? -1) + 1;
            return (
              <li
                key={field.id}
                className={cn(
                  "relative flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-2",
                  !dragging &&
                    "focus-within:border-muted-foreground/50 hover:bg-accent/40",
                  dragging &&
                    from === index &&
                    "bg-accent/50 text-muted-foreground",
                )}
              >
                <button
                  type="button"
                  disabled={fields.length < 2}
                  aria-label={t("fieldOrder.move", {
                    name,
                    position: index + 1,
                  })}
                  aria-describedby={keyboardHelpId}
                  className="flex size-7 shrink-0 touch-none cursor-grab items-center justify-center rounded text-muted-foreground outline-none enabled:hover:bg-accent enabled:hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
                  onPointerDown={(event) => startDrag(index, event)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                      event.preventDefault();
                      move(index, index + (event.key === "ArrowUp" ? -1 : 1));
                    }
                  }}
                >
                  <GripVertical size={16} aria-hidden />
                </button>
                <span
                  aria-hidden
                  className="w-5 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground"
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs" title={name}>
                  {name}
                </span>
                <span className="flex shrink-0 gap-2 pr-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                  <span>
                    X{" "}
                    <span className="text-foreground/80">
                      {Math.round(field.x)}
                    </span>
                  </span>
                  <span>
                    Y{" "}
                    <span className="text-foreground/80">
                      {Math.round(field.y)}
                    </span>
                  </span>
                </span>
                {showDrop &&
                  (dropIndex === index ||
                    (dropIndex === fields.length &&
                      index === fields.length - 1)) && (
                    <span
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute inset-x-2 h-0.5 rounded-full bg-ring",
                        dropIndex === index ? "-top-1.5" : "-bottom-1.5",
                      )}
                    />
                  )}
              </li>
            );
          })}
        </ol>
      )}
      <div className="mt-4 flex justify-end gap-2 border-t border-border px-5 py-3">
        <DialogClose className="h-8 w-auto px-3 text-xs">
          {t("dialog.cancel")}
        </DialogClose>
        <ToolButton
          variant="primary"
          type="button"
          disabled={updates.length === 0}
          onClick={apply}
        >
          {t("fieldOrder.apply")}
        </ToolButton>
      </div>
    </>
  );
}
