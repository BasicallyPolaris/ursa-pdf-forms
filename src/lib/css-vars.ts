const cache = new Map<string, string>();

export function resolveCssVar(varName: string): string {
  let value = cache.get(varName);
  if (value === undefined) {
    const el = document.querySelector(".dark") ?? document.documentElement;
    value = getComputedStyle(el).getPropertyValue(varName).trim();
    cache.set(varName, value);
  }
  return value;
}

export function invalidateCssVarCache(): void {
  cache.clear();
}
