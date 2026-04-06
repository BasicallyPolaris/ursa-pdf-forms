import { create } from "zustand";

const CUSTOM_FONT_PREFIX = "custom-font-";

export interface FontEntry {
  id: string;
  family: string;
  bytes: Uint8Array;
}

interface FontStore {
  fonts: Map<string, FontEntry>;
  loadFontFromFile: (name: string, bytes: Uint8Array) => string;
  getFontById: (id: string) => FontEntry | undefined;
  getAllFonts: () => FontEntry[];
  removeFont: (id: string) => void;
}

export const useFontStore = create<FontStore>()((set, get) => ({
  fonts: new Map<string, FontEntry>(),

  loadFontFromFile: (name: string, bytes: Uint8Array) => {
    const id = `${CUSTOM_FONT_PREFIX}${Date.now().toString(36)}_${name.replace(/[^a-zA-Z0-9]/g, "")}`;
    const entry: FontEntry = { id, family: name, bytes };
    set((state) => {
      const fonts = new Map(state.fonts);
      fonts.set(id, entry);
      return { fonts };
    });

    const blob = new Blob([bytes], { type: "font/opentype" });
    const url = URL.createObjectURL(blob);
    const fontFace = new FontFace(id, `url(${url})`);
    fontFace.load().then(() => {
      document.fonts.add(fontFace);
    });

    return id;
  },

  getFontById: (id: string) => {
    return get().fonts.get(id);
  },

  getAllFonts: () => {
    return [...get().fonts.values()];
  },

  removeFont: (id: string) => {
    set((state) => {
      const fonts = new Map(state.fonts);
      fonts.delete(id);
      return { fonts };
    });
  },
}));
