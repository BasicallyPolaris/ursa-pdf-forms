export const SCROLL_CONTAINER_ATTR = "data-pdf-scroll-container";

export function getScrollContainer(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${SCROLL_CONTAINER_ATTR}]`);
}

export function isEditableElement(e: KeyboardEvent): boolean {
  return (
    e.target instanceof HTMLElement &&
    ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)
  );
}
