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
        <p className="max-w-50 text-center text-xs text-muted-foreground">
          {title}
        </p>
      )}
      {description && (
        <p className="max-w-50 text-center text-[10px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

export { EmptyState };
