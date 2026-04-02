import "@testing-library/jest-dom/vitest";

(globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

(globalThis as unknown as Record<string, unknown>).IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
  root = null;
  rootMargin = "";
  thresholds = [] as number[];
  takeRecords() { return [] as IntersectionObserverEntry[]; }
};
