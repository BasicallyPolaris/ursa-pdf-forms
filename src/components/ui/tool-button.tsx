import { cn } from "@/lib/utils";

function ToolButton({
  variant = "default",
  active,
  disabled,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "icon";
  active?: boolean;
}) {
  return (
    <button
      data-slot="tool-button"
      disabled={disabled}
      className={cn(
        "select-none flex items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-card disabled:pointer-events-none disabled:opacity-30 active:brightness-90",
        variant === "primary" &&
          "h-8 bg-primary px-3 text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/50",
        variant === "icon" && [
          "h-8 w-8",
          active
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
        ],
        variant === "default" && [
          "h-8 px-2",
          active
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
        ],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function ToolbarSeparator() {
  return <div className="mx-1 h-6 w-px bg-border" />;
}

export { ToolbarSeparator, ToolButton };
