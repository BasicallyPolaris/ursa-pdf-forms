type CursorType = "grab" | "ns" | "ew" | "nwse";

export function lockCursor(type: CursorType) {
  document.body.classList.add(`cursor-${type}`);
  document.body.style.userSelect = "none";
}

export function unlockCursor() {
  document.body.classList.remove(
    "cursor-grab",
    "cursor-ns",
    "cursor-ew",
    "cursor-nwse",
  );
  document.body.style.userSelect = "";
}
