import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { useEditorStore } from "@/stores/editor-store";

export async function openPdfFile() {
  const selected = await open({
    filters: [{ name: "PDF", extensions: ["pdf"] }],
    multiple: false,
  });

  if (!selected) return;

  const filePath = typeof selected === "string" ? selected : selected;
  const bytes = await readFile(filePath as string);
  const fileName = (filePath as string).split(/[/\\]/).pop() ?? "document.pdf";

  useEditorStore.getState().setPdf(fileName, new Uint8Array(bytes), []);
}
