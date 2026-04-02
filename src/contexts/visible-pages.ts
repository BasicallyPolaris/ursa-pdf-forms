import { createContext, useContext } from "react";

const VisiblePagesContext = createContext<Set<number>>(new Set());

export { VisiblePagesContext };

export function useVisiblePages(): Set<number> {
  return useContext(VisiblePagesContext);
}
