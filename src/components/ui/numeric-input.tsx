import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function NumericInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <Input
      type="number"
      data-slot="numeric-input"
      className={cn("h-7 text-xs font-mono tabular-nums", className)}
      {...props}
    />
  );
}

export { NumericInput };
