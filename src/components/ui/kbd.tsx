import { cn } from "@/lib/utils";

function Kbd({
  className,
  ...props
}: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "rounded border border-border bg-muted/50 px-1 py-px font-mono text-[10px] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
