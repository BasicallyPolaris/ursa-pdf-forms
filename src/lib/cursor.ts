export type CursorType = "grab" | "ns" | "ew" | "nwse" | "nesw";

export function lockCursor(type: CursorType) {
  document.body.classList.add(`locked-cursor-${type}`);
  document.body.style.userSelect = "none";
}

export function unlockCursor() {
  document.body.classList.remove(
    "locked-cursor-grab",
    "locked-cursor-ns",
    "locked-cursor-ew",
    "locked-cursor-nwse",
    "locked-cursor-nesw",
  );
  document.body.style.userSelect = "";
}
