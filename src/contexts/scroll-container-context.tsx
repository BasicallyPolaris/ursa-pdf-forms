import { createContext, useContext } from "react";
import type { ReactNode, RefObject } from "react";

const ScrollContainerContext = createContext<RefObject<HTMLElement | null>>({
  current: null,
} as RefObject<HTMLElement | null>);

export function ScrollContainerProvider({
  scrollContainerRef,
  children,
}: {
  scrollContainerRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  return (
    <ScrollContainerContext.Provider value={scrollContainerRef}>
      {children}
    </ScrollContainerContext.Provider>
  );
}

export function useScrollContainerRef(): RefObject<HTMLElement | null> {
  return useContext(ScrollContainerContext);
}
