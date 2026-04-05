import { cn } from "@/lib/utils";
import { Fragment } from "react";
import { formatShortcutParts, type ShortcutId } from "@/lib/shortcuts";

const isMacClient =
  typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

function Kbd({
  className,
  ...props
}: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "select-none rounded border border-border bg-muted/50 px-1 py-px font-mono text-[10px] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function ShortcutKbd({ shortcutId }: { shortcutId: ShortcutId }) {
  const parts = formatShortcutParts(shortcutId);
  if (parts.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5">
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && !isMacClient && (
            <span className="text-muted-foreground text-[10px]">+</span>
          )}
          <Kbd>{part}</Kbd>
        </Fragment>
      ))}
    </span>
  );
}

export { Kbd, ShortcutKbd };
