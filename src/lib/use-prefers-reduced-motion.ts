import { useSyncExternalStore } from "react";

function getQuery() {
  return typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
}

function getSnapshot(): boolean {
  return getQuery()?.matches ?? false;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(callback: () => void): () => void {
  const q = getQuery();
  q?.addEventListener("change", callback);
  return () => q?.removeEventListener("change", callback);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function prefersReducedMotion(): boolean {
  return getQuery()?.matches ?? false;
}
