import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function NumericInput({
  className,
  value,
  onChange,
  min,
  max,
  ...props
}: React.ComponentProps<"input">) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onChange) return;
    const raw = e.target.value;
    if (raw === "" || raw === "-" || raw === ".") {
      onChange(e);
      return;
    }
    const num = Number(raw);
    if (!Number.isFinite(num)) return;
    if (min !== undefined && num < Number(min)) return;
    if (max !== undefined && num > Number(max)) return;
    onChange(e);
  };

  return (
    <Input
      type="number"
      data-slot="numeric-input"
      className={cn("h-7 text-xs font-mono tabular-nums", className)}
      value={value}
      onChange={handleChange}
      min={min}
      max={max}
      {...props}
    />
  );
}

export { NumericInput };
