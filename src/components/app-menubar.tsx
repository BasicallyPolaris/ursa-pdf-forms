import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  menuCopy,
  menuCut,
  menuDuplicate,
  menuExportFormFields,
  menuExportPdf,
  menuImportFormFields,
  menuOpenPdf,
  menuOpenSettings,
  menuOpenShortcuts,
  menuPaste,
  menuRedo,
  menuResetOnboarding,
  menuSelectAll,
  menuStartTour,
  menuUndo,
} from "@/lib/menu-actions";
import { formatShortcut } from "@/lib/shortcuts";
import { zoomFitWidth, zoomIn, zoomOut, zoomTo100 } from "@/lib/zoom-actions";
import { useEditorStore } from "@/stores/editor-store";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

interface MenubarMenuProps {
  label: string;
  children: ReactNode;
}

function MenubarMenu({
  label,
  children,
  tourId,
}: MenubarMenuProps & { tourId?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger data-tour={tourId}>{label}</DropdownMenuTrigger>
      <DropdownMenuContent>{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuAction({
  label,
  shortcutId,
  onClick,
  disabled,
}: {
  label: string;
  shortcutId?: Parameters<typeof formatShortcut>[0];
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenuItem onClick={onClick} disabled={disabled}>
      {label}
      {shortcutId ? (
        <DropdownMenuShortcut>{formatShortcut(shortcutId)}</DropdownMenuShortcut>
      ) : null}
    </DropdownMenuItem>
  );
}

export function AppMenubar() {
  const { t } = useTranslation();
  const hasPdf = useEditorStore((s) => !!s.pdfBytes);
  const hasSelection = useEditorStore((s) => s.selectedIds.size > 0);
  const hasClipboard = useEditorStore((s) => s.clipboard.length > 0);
  const hasPast = useStore(
    useEditorStore.temporal,
    (s) => s.pastStates.length > 0,
  );
  const hasFuture = useStore(
    useEditorStore.temporal,
    (s) => s.futureStates.length > 0,
  );

  return (
    <nav
      className="relative z-10 flex h-full shrink-0 items-center gap-0.5 px-1"
      aria-label={t("menu.ariaLabel")}
    >
      <MenubarMenu label={t("menu.file")} tourId="file-menu">
        <MenuAction
          label={t("header.open")}
          shortcutId="open"
          onClick={menuOpenPdf}
        />
        <DropdownMenuSeparator />
        <MenuAction
          label={t("header.export")}
          shortcutId="export"
          onClick={menuExportPdf}
          disabled={!hasPdf}
        />
        <DropdownMenuSeparator />
        <MenuAction
          label={t("header.importFields")}
          onClick={menuImportFormFields}
          disabled={!hasPdf}
        />
        <MenuAction
          label={t("header.exportFields")}
          onClick={menuExportFormFields}
          disabled={!hasPdf}
        />
      </MenubarMenu>

      <MenubarMenu label={t("menu.edit")}>
        <MenuAction
          label={t("contextMenu.cut")}
          shortcutId="cut"
          onClick={menuCut}
          disabled={!hasPdf || !hasSelection}
        />
        <MenuAction
          label={t("contextMenu.copy")}
          shortcutId="copy"
          onClick={menuCopy}
          disabled={!hasPdf || !hasSelection}
        />
        <MenuAction
          label={t("contextMenu.pasteHere")}
          shortcutId="paste"
          onClick={menuPaste}
          disabled={!hasPdf || !hasClipboard}
        />
        <MenuAction
          label={t("contextMenu.duplicate")}
          shortcutId="duplicate"
          onClick={menuDuplicate}
          disabled={!hasPdf || !hasSelection}
        />
        <DropdownMenuSeparator />
        <MenuAction
          label={t("contextMenu.selectAll")}
          shortcutId="selectAll"
          onClick={menuSelectAll}
          disabled={!hasPdf}
        />
        <DropdownMenuSeparator />
        <MenuAction
          label={t("header.undo")}
          shortcutId="undo"
          onClick={menuUndo}
          disabled={!hasPdf || !hasPast}
        />
        <MenuAction
          label={t("header.redo")}
          shortcutId="redo"
          onClick={menuRedo}
          disabled={!hasPdf || !hasFuture}
        />
      </MenubarMenu>

      <MenubarMenu label={t("menu.view")}>
        <MenuAction
          label={t("header.zoomIn")}
          shortcutId="zoomIn"
          onClick={zoomIn}
          disabled={!hasPdf}
        />
        <MenuAction
          label={t("header.zoomOut")}
          shortcutId="zoomOut"
          onClick={zoomOut}
          disabled={!hasPdf}
        />
        <MenuAction
          label={t("shortcuts.zoomFit")}
          shortcutId="zoomFit"
          onClick={zoomFitWidth}
          disabled={!hasPdf}
        />
        <MenuAction
          label={t("shortcuts.zoom100")}
          shortcutId="zoom100"
          onClick={zoomTo100}
          disabled={!hasPdf}
        />
      </MenubarMenu>

      <MenubarMenu label={t("menu.help")}>
        <MenuAction label={t("settings.title")} onClick={menuOpenSettings} />
        <MenuAction
          label={t("shortcuts.title")}
          onClick={menuOpenShortcuts}
        />
        <DropdownMenuSeparator />
        <MenuAction label={t("settings.showTour")} onClick={menuStartTour} />
        <MenuAction
          label={t("settings.resetOnboarding")}
          onClick={menuResetOnboarding}
        />
      </MenubarMenu>
    </nav>
  );
}
