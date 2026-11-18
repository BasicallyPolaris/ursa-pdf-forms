export const DEFAULT_NUMBER_DECIMALS = 2;
export const MAX_NUMBER_DECIMALS = 10;

export function isNumberDecimals(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_NUMBER_DECIMALS
  );
}

export function isNumericFieldValue(value: string): boolean {
  const text = value.trim();
  return (
    text === "" ||
    (/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) && Number.isFinite(Number(text)))
  );
}

export function numericFieldAction(
  event: "Keystroke" | "Format",
  decimals: number,
): string {
  return `AFNumber_${event}(${decimals}, 1, 0, 0, "", true);`;
}

export function readNumberDecimals(
  keystroke: string | undefined,
  format: string | undefined,
): number | undefined {
  const pattern =
    /^\s*AFNumber_(Format|Keystroke)\(\s*(\d+)\s*,\s*1\s*,\s*0\s*,\s*0\s*,\s*(?:""|'')\s*,\s*true\s*\)\s*;?\s*$/;
  const formatMatch = format?.match(pattern);
  const keyMatch = keystroke?.match(pattern);
  const decimals = Number(formatMatch?.[2]);
  if (
    formatMatch?.[1] === "Format" &&
    keyMatch?.[1] === "Keystroke" &&
    Number(keyMatch[2]) === decimals &&
    isNumberDecimals(decimals)
  ) {
    return decimals;
  }
}
