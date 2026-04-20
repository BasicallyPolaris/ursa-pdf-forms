import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const pairs = [
  ["node_modules/pdfjs-dist/cmaps", "public/cmaps"],
  ["node_modules/pdfjs-dist/standard_fonts", "public/standard_fonts"],
  ["node_modules/pdfjs-dist/wasm", "public/wasm"],
  ["node_modules/pdfjs-dist/iccs", "public/iccs"],
];

for (const [src, dest] of pairs) {
  const absSrc = join(process.cwd(), src);
  const absDest = join(process.cwd(), dest);
  if (existsSync(absDest)) continue;
  if (!existsSync(absSrc)) {
    console.warn(`[copy-pdf-assets] Source not found: ${src}`);
    continue;
  }
  cpSync(absSrc, absDest, { recursive: true });
  console.log(`[copy-pdf-assets] Copied ${src} → ${dest}`);
}
