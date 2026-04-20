export const STANDARD_FONTS = [
  "Helvetica",
  "Helvetica-Bold",
  "Helvetica-Oblique",
  "Helvetica-BoldOblique",
  "Courier",
  "Courier-Bold",
  "Courier-Oblique",
  "Courier-BoldOblique",
  "Times-Roman",
  "Times-Bold",
  "Times-Italic",
  "Times-BoldItalic",
  "Symbol",
  "ZapfDingbats",
] as const;

export type StandardFont = (typeof STANDARD_FONTS)[number];

const STANDARD_TO_CSS: Record<string, string> = {
  Helvetica: "Helvetica, Arial, sans-serif",
  "Helvetica-Bold": "Helvetica, Arial, sans-serif",
  "Helvetica-Oblique": "Helvetica, Arial, sans-serif",
  "Helvetica-BoldOblique": "Helvetica, Arial, sans-serif",
  Courier: '"Courier New", Courier, monospace',
  "Courier-Bold": '"Courier New", Courier, monospace',
  "Courier-Oblique": '"Courier New", Courier, monospace',
  "Courier-BoldOblique": '"Courier New", Courier, monospace',
  "Times-Roman": '"Times New Roman", Times, serif',
  "Times-Bold": '"Times New Roman", Times, serif',
  "Times-Italic": '"Times New Roman", Times, serif',
  "Times-BoldItalic": '"Times New Roman", Times, serif',
  Symbol: "Symbol, serif",
  ZapfDingbats: '"Zapf Dingbats", serif',
};

export function fontFamilyToCss(fontFamily: string): string {
  return STANDARD_TO_CSS[fontFamily] ?? fontFamily;
}

export function fontWeightToCss(fontWeight: string): string {
  switch (fontWeight) {
    case "bold":
    case "bold-italic":
      return "bold";
    default:
      return "normal";
  }
}

export function fontStyleToCss(fontWeight: string): string {
  switch (fontWeight) {
    case "italic":
    case "bold-italic":
      return "italic";
    default:
      return "normal";
  }
}

const BASE_TO_VARIANT: Record<string, Record<string, string>> = {
  Helvetica: {
    regular: "Helvetica",
    bold: "Helvetica-Bold",
    italic: "Helvetica-Oblique",
    "bold-italic": "Helvetica-BoldOblique",
  },
  Courier: {
    regular: "Courier",
    bold: "Courier-Bold",
    italic: "Courier-Oblique",
    "bold-italic": "Courier-BoldOblique",
  },
  "Times-Roman": {
    regular: "Times-Roman",
    bold: "Times-Bold",
    italic: "Times-Italic",
    "bold-italic": "Times-BoldItalic",
  },
};

export function resolveFontFamily(
  fontFamily: string,
  fontWeight: string,
): string {
  const base = fontFamily.replace(/-(Bold|Oblique|BoldOblique|Italic)$/, "");
  const variants = BASE_TO_VARIANT[base];
  if (variants && fontWeight in variants) {
    return variants[fontWeight];
  }
  return fontFamily;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  if (typeof hex !== "string") return { r: 0, g: 0, b: 0 };
  const cleaned = hex.replace(/^#/, "");
  if (cleaned.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return { r: 0, g: 0, b: 0 };
  }
  const num = parseInt(cleaned, 16);
  if (!Number.isFinite(num)) return { r: 0, g: 0, b: 0 };
  return {
    r: ((num >> 16) & 0xff) / 255,
    g: ((num >> 8) & 0xff) / 255,
    b: (num & 0xff) / 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => {
    const safe = Number.isFinite(v) ? v : 0;
    const clamped = Math.max(0, Math.min(255, Math.round(safe * 255)));
    return clamped.toString(16).padStart(2, "0");
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
