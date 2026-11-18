export const CALCULATION_OPERATIONS = [
  "SUM",
  "PRD",
  "AVG",
  "MIN",
  "MAX",
] as const;

export type CalculationOperation = (typeof CALCULATION_OPERATIONS)[number];

export function createCalculationScript(
  operation: CalculationOperation,
  fields: string[],
): string {
  const names = JSON.stringify(fields)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return `AFSimple_Calculate("${operation}", ${names});`;
}
