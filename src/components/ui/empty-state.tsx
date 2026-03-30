import { cn } from "@/lib/utils";

function EmptyState({
  icon,
  title,
  description,
  className,
}: {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex h-full flex-col items-center justify-center gap-1.5 p-4",
        className,
      )}
    >
      {icon}
      {title && (
        <p className="text-xs text-muted-foreground/70">{title}</p>
      )}
      {description && (
        <p className="text-[10px] text-muted-foreground/50">{description}</p>
      )}
    </div>
  );
}

export { EmptyState };
