import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  rgbToHex,
  fontFamilyToCss,
  fontWeightToCss,
  fontStyleToCss,
  resolveFontFamily,
} from "@/lib/font-utils";

describe("hexToRgb", () => {
  it("parses valid 6-digit hex", () => {
    const result = hexToRgb("#ff0000");
    expect(result.r).toBeCloseTo(1);
    expect(result.g).toBeCloseTo(0);
    expect(result.b).toBeCloseTo(0);
  });

  it("parses hex without # prefix", () => {
    const result = hexToRgb("00ff00");
    expect(result.r).toBeCloseTo(0);
    expect(result.g).toBeCloseTo(1);
    expect(result.b).toBeCloseTo(0);
  });

  it("parses black", () => {
    const result = hexToRgb("#000000");
    expect(result).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("parses white", () => {
    const result = hexToRgb("#ffffff");
    expect(result.r).toBeCloseTo(1);
    expect(result.g).toBeCloseTo(1);
    expect(result.b).toBeCloseTo(1);
  });

  it("parses mixed case hex", () => {
    const result = hexToRgb("#AbCdEf");
    expect(result.r).toBeCloseTo(0xab / 255);
    expect(result.g).toBeCloseTo(0xcd / 255);
    expect(result.b).toBeCloseTo(0xef / 255);
  });

  it("returns black for empty string", () => {
    expect(hexToRgb("")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("returns black for short hex (3 digits)", () => {
    expect(hexToRgb("#fff")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("returns black for long hex (8 digits)", () => {
    expect(hexToRgb("#ffffff00")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("returns black for non-hex characters", () => {
    expect(hexToRgb("#gggggg")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("returns black for non-string input (number)", () => {
    expect(hexToRgb(123 as unknown as string)).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("returns black for null", () => {
    expect(hexToRgb(null as unknown as string)).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("returns black for undefined", () => {
    expect(hexToRgb(undefined as unknown as string)).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe("rgbToHex", () => {
  it("converts valid rgb to hex", () => {
    expect(rgbToHex(1, 0, 0)).toBe("#ff0000");
    expect(rgbToHex(0, 1, 0)).toBe("#00ff00");
    expect(rgbToHex(0, 0, 1)).toBe("#0000ff");
  });

  it("converts black", () => {
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
  });

  it("converts white", () => {
    expect(rgbToHex(1, 1, 1)).toBe("#ffffff");
  });

  it("clamps negative values to 0", () => {
    expect(rgbToHex(-1, -0.5, -10)).toBe("#000000");
  });

  it("clamps values above 1 to 255", () => {
    expect(rgbToHex(2, 3, 100)).toBe("#ffffff");
  });

  it("handles NaN by clamping to 0", () => {
    const result = rgbToHex(NaN, 0, 0);
    expect(result).toBe("#000000");
  });
});

describe("fontFamilyToCss", () => {
  it("maps Helvetica to CSS font stack", () => {
    expect(fontFamilyToCss("Helvetica")).toBe("Helvetica, Arial, sans-serif");
  });

  it("maps Courier to monospace font stack", () => {
    expect(fontFamilyToCss("Courier")).toBe('"Courier New", Courier, monospace');
  });

  it("maps Times-Roman to serif font stack", () => {
    expect(fontFamilyToCss("Times-Roman")).toBe('"Times New Roman", Times, serif');
  });

  it("passes through unknown font families", () => {
    expect(fontFamilyToCss("Comic Sans")).toBe("Comic Sans");
  });
});

describe("fontWeightToCss", () => {
  it("returns bold for bold", () => {
    expect(fontWeightToCss("bold")).toBe("bold");
  });

  it("returns bold for bold-italic", () => {
    expect(fontWeightToCss("bold-italic")).toBe("bold");
  });

  it("returns normal for regular", () => {
    expect(fontWeightToCss("regular")).toBe("normal");
  });

  it("returns normal for italic", () => {
    expect(fontWeightToCss("italic")).toBe("normal");
  });
});

describe("fontStyleToCss", () => {
  it("returns italic for italic", () => {
    expect(fontStyleToCss("italic")).toBe("italic");
  });

  it("returns italic for bold-italic", () => {
    expect(fontStyleToCss("bold-italic")).toBe("italic");
  });

  it("returns normal for regular", () => {
    expect(fontStyleToCss("regular")).toBe("normal");
  });

  it("returns normal for bold", () => {
    expect(fontStyleToCss("bold")).toBe("normal");
  });
});

describe("resolveFontFamily", () => {
  it("resolves Helvetica bold variant", () => {
    expect(resolveFontFamily("Helvetica", "bold")).toBe("Helvetica-Bold");
  });

  it("resolves Courier italic variant", () => {
    expect(resolveFontFamily("Courier", "italic")).toBe("Courier-Oblique");
  });

  it("strips variant suffix and resolves", () => {
    expect(resolveFontFamily("Helvetica-Bold", "italic")).toBe(
      "Helvetica-Oblique",
    );
  });

  it("returns original family for unknown base", () => {
    expect(resolveFontFamily("CustomFont", "bold")).toBe("CustomFont");
  });

  it("returns original family for unknown weight", () => {
    expect(resolveFontFamily("Helvetica", "extra-bold" as "bold")).toBe(
      "Helvetica",
    );
  });
});
