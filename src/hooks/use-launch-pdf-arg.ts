import { useEffect } from "react";
import { getMatches } from "@tauri-apps/plugin-cli";
import { fileIO } from "@/lib/file-io";

function launchPdfPathFromCli(matches: {
  args: Record<string, { value: string | boolean | string[] | null }>;
}): string | null {
  const raw = matches.args.pdfPath?.value;
  if (typeof raw !== "string") return null;
  const lower = raw.toLowerCase();
  if (!lower.endsWith(".pdf")) return null;
  return raw;
}

export function useLaunchPdfArg() {
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const matches = await getMatches();
        const path = launchPdfPathFromCli(matches);
        if (!path || cancelled) return;

        const action = await fileIO.confirmUnsavedChanges();
        if (cancelled || action === "cancel") return;

        const error = await fileIO.loadPdfFromPath(path);
        if (error) console.error("[launch pdf]", error);
      } catch {
        return;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
