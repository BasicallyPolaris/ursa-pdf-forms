import {
  createCheckbox,
  createRadioButton,
  createTextField,
  createDropdownField,
  createButtonField,
  createOptionListField,
  createSignatureField,
  getUniqueName,
} from "@/lib/form-element-model";
import { formatShortcut } from "@/lib/shortcuts";
import { useEditorStore } from "@/stores/editor-store";
import {
  AlignLeft,
  ChevronDown,
  CircleDot,
  ClipboardPaste,
  Copy,
  CopyPlus,
  List,
  PenLine,
  Scissors,
  SquareCheck,
  SquareMousePointer,
  TextCursorInput,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

export type MenuContext =
  | { type: "element"; pdfX: number; pdfY: number; pageNumber: number }
  | { type: "canvas"; pdfX: number; pdfY: number; pageNumber: number }
  | { type: "guide"; guideId: string };

interface MenuItem {
  label: string;
  shortcut?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

interface MenuSeparator {
  separator: true;
}

type MenuEntry = MenuItem | MenuSeparator;

interface CanvasContextMenuProps {
  context: MenuContext;
  clientX: number;
  clientY: number;
  onClose: () => void;
}

const ITEM_HEIGHT = 28;
const SEP_HEIGHT = 9;

export function CanvasContextMenu({
  context,
  clientX,
  clientY,
  onClose,
}: CanvasContextMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [, setFocusedIndex] = useState(0);

  const clipboard = useEditorStore((s) => s.clipboard);

  const entries: MenuEntry[] = (() => {
    const store = useEditorStore.getState();

    if (context.type === "element") {
      return [
        {
          label: t("contextMenu.cut"),
          shortcut: formatShortcut("cut"),
          icon: Scissors,
          action: () => store.cutSelection(),
        },
        {
          label: t("contextMenu.copy"),
          shortcut: formatShortcut("copy"),
          icon: Copy,
          action: () => store.copySelection(),
        },
        {
          label: t("contextMenu.pasteHere"),
          shortcut: formatShortcut("paste"),
          icon: ClipboardPaste,
          action: () =>
            store.pasteClipboard(
              context.pageNumber,
              context.pdfX,
              context.pdfY,
            ),
          disabled: clipboard.length === 0,
        },
        {
          label: t("contextMenu.duplicate"),
          shortcut: formatShortcut("duplicate"),
          icon: CopyPlus,
          action: () => store.duplicateSelection(context.pageNumber),
        },
        { separator: true },
        {
          label: t("contextMenu.delete"),
          shortcut: "Del",
          icon: Trash2,
          action: () => store.removeElements([...store.selectedIds]),
          destructive: true,
        },
        { separator: true },
        {
          label: t("contextMenu.selectAll"),
          shortcut: formatShortcut("selectAll"),
          action: () => {
            const pageElements = store.elements.filter(
              (el) => el.pageNumber === context.pageNumber,
            );
            store.selectElements(new Set(pageElements.map((el) => el.id)));
          },
        },
      ];
    }

    if (context.type === "canvas") {
      const elements = store.elements;
      const result: MenuEntry[] = [];

      if (clipboard.length > 0) {
        result.push({
          label: t("contextMenu.pasteHere"),
          shortcut: formatShortcut("paste"),
          icon: ClipboardPaste,
          action: () =>
            store.pasteClipboard(
              context.pageNumber,
              context.pdfX,
              context.pdfY,
            ),
        });
        result.push({ separator: true });
      }

      result.push(
        {
          label: t("contextMenu.addTextField"),
          icon: TextCursorInput,
          action: () => {
            const newEl = createTextField({
              x: context.pdfX,
              y: context.pdfY,
              pageNumber: context.pageNumber,
              name: getUniqueName(`text_${elements.length + 1}`, elements),
            });
            store.addElement(newEl);
            store.selectElements(new Set([newEl.id]));
          },
        },
        {
          label: t("contextMenu.addTextarea"),
          icon: AlignLeft,
          action: () => {
            const newEl = createTextField({
              x: context.pdfX,
              y: context.pdfY,
              pageNumber: context.pageNumber,
              name: getUniqueName(`text_${elements.length + 1}`, elements),
              multiline: true,
            });
            store.addElement(newEl);
            store.selectElements(new Set([newEl.id]));
          },
        },
        {
          label: t("contextMenu.addCheckbox"),
          icon: SquareCheck,
          action: () => {
            const newEl = createCheckbox({
              x: context.pdfX,
              y: context.pdfY,
              pageNumber: context.pageNumber,
              name: getUniqueName(`checkbox_${elements.length + 1}`, elements),
            });
            store.addElement(newEl);
            store.selectElements(new Set([newEl.id]));
          },
        },
        {
          label: t("contextMenu.addRadio"),
          icon: CircleDot,
          action: () => {
            const newEl = createRadioButton({
              x: context.pdfX,
              y: context.pdfY,
              pageNumber: context.pageNumber,
              groupName: "group_1",
              value: `option_${elements.length + 1}`,
            });
            store.addElement(newEl);
            store.selectElements(new Set([newEl.id]));
          },
        },
        {
          label: t("contextMenu.addDropdown"),
          icon: ChevronDown,
          action: () => {
            const newEl = createDropdownField({
              x: context.pdfX,
              y: context.pdfY,
              pageNumber: context.pageNumber,
              name: getUniqueName(`dropdown_${elements.length + 1}`, elements),
            });
            store.addElement(newEl);
            store.selectElements(new Set([newEl.id]));
          },
        },
        {
          label: t("contextMenu.addOptionList"),
          icon: List,
          action: () => {
            const newEl = createOptionListField({
              x: context.pdfX,
              y: context.pdfY,
              pageNumber: context.pageNumber,
              name: getUniqueName(`optionlist_${elements.length + 1}`, elements),
            });
            store.addElement(newEl);
            store.selectElements(new Set([newEl.id]));
          },
        },
        {
          label: t("contextMenu.addButton"),
          icon: SquareMousePointer,
          action: () => {
            const newEl = createButtonField({
              x: context.pdfX,
              y: context.pdfY,
              pageNumber: context.pageNumber,
              name: getUniqueName(`button_${elements.length + 1}`, elements),
            });
            store.addElement(newEl);
            store.selectElements(new Set([newEl.id]));
          },
        },
        {
          label: t("contextMenu.addSignature"),
          icon: PenLine,
          action: () => {
            const newEl = createSignatureField({
              x: context.pdfX,
              y: context.pdfY,
              pageNumber: context.pageNumber,
              name: getUniqueName(`signature_${elements.length + 1}`, elements),
            });
            store.addElement(newEl);
            store.selectElements(new Set([newEl.id]));
          },
        },
      );

      result.push({ separator: true });
      result.push({
        label: t("contextMenu.selectAll"),
        shortcut: formatShortcut("selectAll"),
        action: () => {
          const pageElements = store.elements.filter(
            (el) => el.pageNumber === context.pageNumber,
          );
          store.selectElements(new Set(pageElements.map((el) => el.id)));
        },
      });

      return result;
    }

    if (context.type === "guide") {
      return [
        {
          label: t("contextMenu.deleteGuide"),
          icon: Trash2,
          action: () => store.removeGuide(context.guideId),
          destructive: true,
        },
      ];
    }

    return [];
  })();

  const actionableEntries = entries.filter(
    (e): e is MenuItem => !("separator" in e),
  );

  useEffect(() => {
    setFocusedIndex(0);
    requestAnimationFrame(() => {
      const firstItem =
        menuRef.current?.querySelector<HTMLElement>("[data-menu-item]");
      firstItem?.focus();
    });
  }, []);

  useEffect(() => {
    if (actionableEntries.length === 0) {
      onCloseRef.current();
      return;
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => {
          const next = (i + 1) % actionableEntries.length;
          const el =
            menuRef.current?.querySelectorAll<HTMLElement>("[data-menu-item]")[
              next
            ];
          el?.focus();
          return next;
        });
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => {
          const next =
            (i - 1 + actionableEntries.length) % actionableEntries.length;
          const el =
            menuRef.current?.querySelectorAll<HTMLElement>("[data-menu-item]")[
              next
            ];
          el?.focus();
          return next;
        });
        return;
      }
    };

    const timer = requestAnimationFrame(() => {
      document.addEventListener("mousedown", handleMouseDown);
      document.addEventListener("keydown", handleKeyDown, true);
    });

    return () => {
      cancelAnimationFrame(timer);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [actionableEntries.length]);

  if (entries.length === 0) return null;

  const itemCount = entries.filter((e) => !("separator" in e)).length;
  const sepCount = entries.filter((e) => "separator" in e).length;
  const estimatedHeight = itemCount * ITEM_HEIGHT + sepCount * SEP_HEIGHT + 8;
  const estimatedWidth = 200;

  let left = clientX;
  let top = clientY;

  if (left + estimatedWidth > window.innerWidth) {
    left = window.innerWidth - estimatedWidth - 8;
  }
  if (top + estimatedHeight > window.innerHeight) {
    top = window.innerHeight - estimatedHeight - 8;
  }
  if (left < 4) left = 4;
  if (top < 4) top = 4;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-orientation="vertical"
      className="dark fixed z-9999 min-w-40 max-h-(--available-height,80vh) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none"
      style={{ left, top }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {entries.map((entry, i) => {
        if ("separator" in entry) {
          return <div key={`sep-${i}`} className="-mx-1 my-1 h-px bg-border" />;
        }

        const Icon = entry.icon;
        return (
          <div
            key={`item-${i}`}
            role="menuitem"
            tabIndex={-1}
            data-menu-item
            data-variant={entry.destructive ? "destructive" : undefined}
            aria-disabled={entry.disabled || undefined}
            className={
              "group flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-xs outline-hidden select-none " +
              "hover:bg-accent hover:text-accent-foreground " +
              "focus:bg-accent focus:text-accent-foreground " +
              "data-[variant=destructive]:text-destructive data-[variant=destructive]:hover:bg-destructive/10 data-[variant=destructive]:hover:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive " +
              (entry.disabled ? "pointer-events-none opacity-50" : "")
            }
            onClick={() => {
              if (!entry.disabled) {
                entry.action();
                onCloseRef.current();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (!entry.disabled) {
                  entry.action();
                  onCloseRef.current();
                }
              }
            }}
          >
            {Icon && <Icon className="size-3.5 shrink-0" />}
            <span>{entry.label}</span>
            {entry.shortcut && (
              <span className="ml-auto pl-4 text-[10px] tracking-widest text-muted-foreground group-hover:text-accent-foreground group-focus:text-accent-foreground">
                {entry.shortcut}
              </span>
            )}
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
