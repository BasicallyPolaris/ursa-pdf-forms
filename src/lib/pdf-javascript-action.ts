import {
  decodePDFRawStream,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFString,
  type PDFContext,
} from "pdf-lib";

export function createJavaScriptAction(
  context: PDFContext,
  script: string,
): PDFDict {
  return context.obj({ S: "JavaScript", JS: PDFHexString.fromText(script) });
}

export function readJavaScriptAction(action: unknown): string | undefined {
  if (!(action instanceof PDFDict)) return;
  if (action.lookup(PDFName.of("S")) !== PDFName.of("JavaScript")) return;

  const script = action.lookup(PDFName.of("JS"));
  try {
    if (script instanceof PDFString || script instanceof PDFHexString) {
      return script.decodeText();
    }
    if (script instanceof PDFRawStream) {
      const bytes = decodePDFRawStream(script).decode();
      const hex = Array.from(bytes, (value) =>
        value.toString(16).padStart(2, "0"),
      ).join("");
      return PDFHexString.of(hex).decodeText();
    }
  } catch {
    return;
  }
}
