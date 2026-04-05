import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDocumentMock } = vi.hoisted(() => ({
  getDocumentMock: vi.fn(),
}));

const { extractAcroFormFieldsMock } = vi.hoisted(() => ({
  extractAcroFormFieldsMock: vi.fn(),
}));

const { exportFormElementsMock } = vi.hoisted(() => ({
  exportFormElementsMock: vi.fn(),
}));

const { stripAcroFormFromPdfMock } = vi.hoisted(() => ({
  stripAcroFormFromPdfMock: vi.fn(),
}));

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: getDocumentMock,
}));

vi.mock("@/lib/pdf-form-reader", () => ({
  extractAcroFormFields: extractAcroFormFieldsMock,
}));

vi.mock("@/lib/pdf-export-engine", () => ({
  exportFormElements: exportFormElementsMock,
  stripAcroFormFromPdf: stripAcroFormFromPdfMock,
}));

function createMockProxy(numPages = 1, width = 612, height = 792) {
  const getPage = vi.fn().mockResolvedValue({
    getViewport: ({ scale }: { scale: number }) => ({
      width: width * scale,
      height: height * scale,
    }),
  });
  return {
    numPages,
    fingerprint: `fp-${Math.random()}`,
    getPage,
    destroy: vi.fn(),
  };
}

function stubLabels() {
  return () => ({
    pdfFilterName: "PDF Files",
    defaultPdfName: "document.pdf",
    defaultExportName: "export.pdf",
    openFailed: "Open failed",
    loadFailed: "Load failed",
    exportFailed: "Export failed",
    unsavedTitle: "Unsaved Changes",
    unsavedMessage: "You have unsaved changes.",
    save: "Save",
    discard: "Discard",
    cancel: "Cancel",
  });
}

describe("file-io orchestrator", () => {
  beforeEach(async () => {
    vi.resetModules();
    getDocumentMock.mockReset();
    extractAcroFormFieldsMock.mockReset();
    exportFormElementsMock.mockReset();
    stripAcroFormFromPdfMock.mockReset();

    getDocumentMock.mockImplementation(() => ({
      promise: Promise.resolve(createMockProxy()),
      destroy: vi.fn(),
    }));
    extractAcroFormFieldsMock.mockResolvedValue([]);
    exportFormElementsMock.mockResolvedValue(new Uint8Array([1]));
    stripAcroFormFromPdfMock.mockResolvedValue(new Uint8Array([2]));
  });

  describe("openPdf", () => {
    it("cancels when unsaved dialog returns cancel", async () => {
      const { createFileIO } = await import("@/lib/file-io/orchestrator");
      const { createTestFileSystem, createTestDialogs, createTestStore, createTestWindow } = await import("@/lib/file-io/adapters/test");

      const dialogs = createTestDialogs({ confirmResult: "cancel" });
      const store = createTestStore();
      store.state.pdfBytes = new Uint8Array([1]);
      store.state.elements = [{ id: "1" } as any];

      const fileIO = createFileIO({ fs: createTestFileSystem(), dialogs, store, window: createTestWindow() }, stubLabels());
      const result = await fileIO.openPdf();

      expect(result).toBeNull();
      expect(dialogs.openCalls.length).toBe(0);
    });

    it("opens a PDF file and loads it into the store", async () => {
      const { createFileIO } = await import("@/lib/file-io/orchestrator");
      const { createTestFileSystem, createTestDialogs, createTestStore, createTestWindow } = await import("@/lib/file-io/adapters/test");

      const pdfBytes = new Uint8Array([1, 2, 3]);
      const files = new Map([["/path/to/test.pdf", pdfBytes]]);
      const dialogs = createTestDialogs({ openResult: "/path/to/test.pdf", confirmResult: "no" });
      const store = createTestStore();

      const fileIO = createFileIO({ fs: createTestFileSystem(files), dialogs, store, window: createTestWindow() }, stubLabels());
      const result = await fileIO.openPdf();

      expect(result).toBeNull();
      expect(store.mutations).toContain("setPdf");
      expect(store.state.fileName).toBe("test.pdf");
    });

    it("returns null when user cancels file picker", async () => {
      const { createFileIO } = await import("@/lib/file-io/orchestrator");
      const { createTestFileSystem, createTestDialogs, createTestStore, createTestWindow } = await import("@/lib/file-io/adapters/test");

      const dialogs = createTestDialogs({ openResult: null, confirmResult: "no" });
      const store = createTestStore();

      const fileIO = createFileIO({ fs: createTestFileSystem(), dialogs, store, window: createTestWindow() }, stubLabels());
      const result = await fileIO.openPdf();

      expect(result).toBeNull();
      expect(store.mutations).not.toContain("setPdf");
    });

    it("returns error message when file read fails", async () => {
      const { createFileIO } = await import("@/lib/file-io/orchestrator");
      const { createTestDialogs, createTestStore, createTestWindow } = await import("@/lib/file-io/adapters/test");

      const dialogs = createTestDialogs({ openResult: "/missing.pdf", confirmResult: "no" });
      const store = createTestStore();

      const fileIO = createFileIO({ fs: { readFile: async () => { throw new Error("not found"); }, writeFile: async () => {} }, dialogs, store, window: createTestWindow() }, stubLabels());
      const result = await fileIO.openPdf();

      expect(result).toBe("Open failed");
    });

    it("skips unsaved check when store is clean", async () => {
      const { createFileIO } = await import("@/lib/file-io/orchestrator");
      const { createTestFileSystem, createTestDialogs, createTestStore, createTestWindow } = await import("@/lib/file-io/adapters/test");

      const files = new Map([["/a.pdf", new Uint8Array([1])]]);
      const dialogs = createTestDialogs({ openResult: "/a.pdf" });
      const store = createTestStore();

      const fileIO = createFileIO({ fs: createTestFileSystem(files), dialogs, store, window: createTestWindow() }, stubLabels());
      await fileIO.openPdf();

      expect(dialogs.confirmCalls.length).toBe(0);
    });
  });

  describe("loadPdfFromPath", () => {
    it("loads a PDF from a given file path", async () => {
      const { createFileIO } = await import("@/lib/file-io/orchestrator");
      const { createTestFileSystem, createTestDialogs, createTestStore, createTestWindow } = await import("@/lib/file-io/adapters/test");

      const pdfBytes = new Uint8Array([5, 6]);
      const files = new Map([["/local/doc.pdf", pdfBytes]]);
      const store = createTestStore();

      const fileIO = createFileIO({ fs: createTestFileSystem(files), dialogs: createTestDialogs(), store, window: createTestWindow() }, stubLabels());
      const result = await fileIO.loadPdfFromPath("/local/doc.pdf");

      expect(result).toBeNull();
      expect(store.state.fileName).toBe("doc.pdf");
    });

    it("returns error on failure", async () => {
      const { createFileIO } = await import("@/lib/file-io/orchestrator");
      const { createTestDialogs, createTestStore, createTestWindow } = await import("@/lib/file-io/adapters/test");

      const store = createTestStore();
      const fileIO = createFileIO({ fs: { readFile: async () => { throw new Error("io"); }, writeFile: async () => {} }, dialogs: createTestDialogs(), store, window: createTestWindow() }, stubLabels());
      const result = await fileIO.loadPdfFromPath("/bad.pdf");

      expect(result).toBe("Load failed");
    });
  });

  describe("loadPdfFromBytes", () => {
    it("loads bytes into store and extracts AcroForm fields", async () => {
      const { createFileIO } = await import("@/lib/file-io/orchestrator");
      const { createTestFileSystem, createTestDialogs, createTestStore, createTestWindow } = await import("@/lib/file-io/adapters/test");

      const mockElement = { id: "acro_1", type: "checkbox" } as any;
      extractAcroFormFieldsMock.mockResolvedValue([mockElement]);

      const store = createTestStore();
      const fileIO = createFileIO({ fs: createTestFileSystem(), dialogs: createTestDialogs(), store, window: createTestWindow() }, stubLabels());

      const bytes = new Uint8Array([1, 2]);
      await fileIO.loadPdfFromBytes(bytes, "form.pdf");

      expect(store.state.fileName).toBe("form.pdf");
      expect(store.mutations).toContain("setPdf");
      expect(store.mutations).toContain("setPdfPages");
      expect(store.mutations).toContain("setInitialElements");
      expect(store.mutations).toContain("setRenderPdfBytes");
      expect(store.state.elements).toEqual([mockElement]);
    });

    it("handles PDF with no AcroForm gracefully", async () => {
      const { createFileIO } = await import("@/lib/file-io/orchestrator");
      const { createTestFileSystem, createTestDialogs, createTestStore, createTestWindow } = await import("@/lib/file-io/adapters/test");

      extractAcroFormFieldsMock.mockResolvedValue([]);

      const store = createTestStore();
      const fileIO = createFileIO({ fs: createTestFileSystem(), dialogs: createTestDialogs(), store, window: createTestWindow() }, stubLabels());

      await fileIO.loadPdfFromBytes(new Uint8Array([3, 4]), "blank.pdf");

      expect(store.mutations).not.toContain("setInitialElements");
      expect(store.mutations).not.toContain("setRenderPdfBytes");
    });
  });

  describe("exportPdf", () => {
    it("exports elements and writes file", async () => {
      const { createFileIO } = await import("@/lib/file-io/orchestrator");
      const { createTestFileSystem, createTestDialogs, createTestStore, createTestWindow } = await import("@/lib/file-io/adapters/test");

      const pdfBytes = new Uint8Array([1]);
      const exportedBytes = new Uint8Array([2, 3]);
      exportFormElementsMock.mockResolvedValue(exportedBytes);

      const fs = createTestFileSystem();
      const dialogs = createTestDialogs({ saveResult: "/out/exported.pdf" });
      const store = createTestStore({ pdfBytes });

      const fileIO = createFileIO({ fs, dialogs, store, window: createTestWindow() }, stubLabels());
      const result = await fileIO.exportPdf();

      expect(result).toBeNull();
      expect(fs.writtenFiles.get("/out/exported.pdf")).toEqual(exportedBytes);
      expect(store.mutations).toContain("markClean");
    });

    it("returns null when no PDF is loaded", async () => {
      const { createFileIO } = await import("@/lib/file-io/orchestrator");
      const { createTestFileSystem, createTestDialogs, createTestStore, createTestWindow } = await import("@/lib/file-io/adapters/test");

      const store = createTestStore();
      const fileIO = createFileIO({ fs: createTestFileSystem(), dialogs: createTestDialogs(), store, window: createTestWindow() }, stubLabels());
      const result = await fileIO.exportPdf();

      expect(result).toBeNull();
    });

    it("returns null when user cancels save dialog", async () => {
      const { createFileIO } = await import("@/lib/file-io/orchestrator");
      const { createTestFileSystem, createTestDialogs, createTestStore, createTestWindow } = await import("@/lib/file-io/adapters/test");

      const dialogs = createTestDialogs({ saveResult: null });
      const store = createTestStore({ pdfBytes: new Uint8Array([1]) });

      const fileIO = createFileIO({ fs: createTestFileSystem(), dialogs, store, window: createTestWindow() }, stubLabels());
      const result = await fileIO.exportPdf();

      expect(result).toBeNull();
      expect(store.mutations).not.toContain("markClean");
    });

    it("returns error message when export fails", async () => {
      const { createFileIO } = await import("@/lib/file-io/orchestrator");
      const { createTestFileSystem, createTestDialogs, createTestStore, createTestWindow } = await import("@/lib/file-io/adapters/test");

      exportFormElementsMock.mockRejectedValue(new Error("bad PDF"));

      const store = createTestStore({ pdfBytes: new Uint8Array([1]) });
      const fileIO = createFileIO({ fs: createTestFileSystem(), dialogs: createTestDialogs({ saveResult: "/out.pdf" }), store, window: createTestWindow() }, stubLabels());
      const result = await fileIO.exportPdf();

      expect(result).toBe("bad PDF");
    });
  });

  describe("confirmUnsavedChanges", () => {
    it("returns discard when store is clean", async () => {
      const { createFileIO } = await import("@/lib/file-io/orchestrator");
      const { createTestFileSystem, createTestDialogs, createTestStore, createTestWindow } = await import("@/lib/file-io/adapters/test");

      const store = createTestStore();
      const fileIO = createFileIO({ fs: createTestFileSystem(), dialogs: createTestDialogs(), store, window: createTestWindow() }, stubLabels());
      const result = await fileIO.confirmUnsavedChanges();

      expect(result).toBe("discard");
    });

    it("shows dialog when dirty and returns save on yes", async () => {
      const { createFileIO } = await import("@/lib/file-io/orchestrator");
      const { createTestFileSystem, createTestDialogs, createTestStore, createTestWindow } = await import("@/lib/file-io/adapters/test");

      exportFormElementsMock.mockResolvedValue(new Uint8Array([1]));
      const dialogs = createTestDialogs({ confirmResult: "yes", saveResult: "/saved.pdf" });
      const store = createTestStore({ pdfBytes: new Uint8Array([1]) });
      store.state.elements = [{ id: "x" } as any];

      const fileIO = createFileIO({ fs: createTestFileSystem(), dialogs, store, window: createTestWindow() }, stubLabels());
      const result = await fileIO.confirmUnsavedChanges();

      expect(result).toBe("save");
      expect(dialogs.confirmCalls.length).toBe(1);
    });

    it("returns cancel when save fails during confirm", async () => {
      const { createFileIO } = await import("@/lib/file-io/orchestrator");
      const { createTestFileSystem, createTestDialogs, createTestStore, createTestWindow } = await import("@/lib/file-io/adapters/test");

      exportFormElementsMock.mockRejectedValue(new Error("fail"));
      const dialogs = createTestDialogs({ confirmResult: "yes", saveResult: "/saved.pdf" });
      const store = createTestStore({ pdfBytes: new Uint8Array([1]) });
      store.state.elements = [{ id: "x" } as any];

      const fileIO = createFileIO({ fs: createTestFileSystem(), dialogs, store, window: createTestWindow() }, stubLabels());
      const result = await fileIO.confirmUnsavedChanges();

      expect(result).toBe("cancel");
    });

    it("returns cancel when user clicks cancel", async () => {
      const { createFileIO } = await import("@/lib/file-io/orchestrator");
      const { createTestFileSystem, createTestDialogs, createTestStore, createTestWindow } = await import("@/lib/file-io/adapters/test");

      const dialogs = createTestDialogs({ confirmResult: "cancel" });
      const store = createTestStore({ pdfBytes: new Uint8Array([1]) });
      store.state.elements = [{ id: "x" } as any];

      const fileIO = createFileIO({ fs: createTestFileSystem(), dialogs, store, window: createTestWindow() }, stubLabels());
      const result = await fileIO.confirmUnsavedChanges();

      expect(result).toBe("cancel");
    });

    it("returns discard when user clicks discard", async () => {
      const { createFileIO } = await import("@/lib/file-io/orchestrator");
      const { createTestFileSystem, createTestDialogs, createTestStore, createTestWindow } = await import("@/lib/file-io/adapters/test");

      const dialogs = createTestDialogs({ confirmResult: "no" });
      const store = createTestStore({ pdfBytes: new Uint8Array([1]) });
      store.state.elements = [{ id: "x" } as any];

      const fileIO = createFileIO({ fs: createTestFileSystem(), dialogs, store, window: createTestWindow() }, stubLabels());
      const result = await fileIO.confirmUnsavedChanges();

      expect(result).toBe("discard");
    });
  });

  describe("registerCloseGuard", () => {
    it("allows close when store is clean", async () => {
      const { createFileIO } = await import("@/lib/file-io/orchestrator");
      const { createTestFileSystem, createTestDialogs, createTestStore, createTestWindow } = await import("@/lib/file-io/adapters/test");

      const win = createTestWindow();
      const store = createTestStore();
      const fileIO = createFileIO({ fs: createTestFileSystem(), dialogs: createTestDialogs(), store, window: win }, stubLabels());

      const unregister = fileIO.registerCloseGuard();
      const allowed = await win.simulateCloseRequest();

      expect(allowed).toBe(true);
      unregister();
    });

    it("blocks close when user cancels unsaved dialog", async () => {
      const { createFileIO } = await import("@/lib/file-io/orchestrator");
      const { createTestFileSystem, createTestDialogs, createTestStore, createTestWindow } = await import("@/lib/file-io/adapters/test");

      const win = createTestWindow();
      const dialogs = createTestDialogs({ confirmResult: "cancel" });
      const store = createTestStore({ pdfBytes: new Uint8Array([1]) });
      store.state.elements = [{ id: "x" } as any];

      const fileIO = createFileIO({ fs: createTestFileSystem(), dialogs, store, window: win }, stubLabels());

      const unregister = fileIO.registerCloseGuard();
      const allowed = await win.simulateCloseRequest();

      expect(allowed).toBe(false);
      unregister();
    });

    it("allows close when user discards changes", async () => {
      const { createFileIO } = await import("@/lib/file-io/orchestrator");
      const { createTestFileSystem, createTestDialogs, createTestStore, createTestWindow } = await import("@/lib/file-io/adapters/test");

      const win = createTestWindow();
      const dialogs = createTestDialogs({ confirmResult: "no" });
      const store = createTestStore({ pdfBytes: new Uint8Array([1]) });
      store.state.elements = [{ id: "x" } as any];

      const fileIO = createFileIO({ fs: createTestFileSystem(), dialogs, store, window: win }, stubLabels());

      const unregister = fileIO.registerCloseGuard();
      const allowed = await win.simulateCloseRequest();

      expect(allowed).toBe(true);
      unregister();
    });

    it("unregister removes the close handler", async () => {
      const { createFileIO } = await import("@/lib/file-io/orchestrator");
      const { createTestFileSystem, createTestDialogs, createTestStore, createTestWindow } = await import("@/lib/file-io/adapters/test");

      const win = createTestWindow();
      const store = createTestStore();

      const fileIO = createFileIO({ fs: createTestFileSystem(), dialogs: createTestDialogs(), store, window: win }, stubLabels());

      const unregister = fileIO.registerCloseGuard();
      expect(win.closeHandlers.length).toBe(1);

      unregister();
      expect(win.closeHandlers.length).toBe(0);
    });
  });
});
