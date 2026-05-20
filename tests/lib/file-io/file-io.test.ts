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
    formFieldsFilterName: "Form fields JSON",
    defaultFormFieldsExportName: "form-fields.json",
    formFieldsExportFailed: "Form fields export failed",
    formFieldsImportFailed: "Form fields import failed",
    formFieldsInvalidJson: "Invalid JSON",
    formFieldsInvalidFormat: "Invalid format",
    formFieldsUnsupportedVersion: "Unsupported version",
    formFieldsNoValidFields: "No valid fields",
    formFieldsNoPdfOpen: "No PDF open",
    formFieldsImportConfirmTitle: "Replace fields?",
    formFieldsImportConfirmMessage: "Replace all fields?",
    formFieldsReplace: "Replace",
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

    it("exports form fields to json", async () => {
      const { createFileIO } = await import("@/lib/file-io/orchestrator");
      const {
        createTestFileSystem,
        createTestDialogs,
        createTestStore,
        createTestWindow,
      } = await import("@/lib/file-io/adapters/test");

      const fs = createTestFileSystem();
      const dialogs = createTestDialogs({
        saveResult: "/tmp/fields.json",
      });
      const store = createTestStore({
        pdfBytes: new Uint8Array([1]),
        elements: [
          {
            type: "text",
            id: "el_1",
            x: 10,
            y: 20,
            width: 100,
            height: 20,
            pageNumber: 1,
            name: "field1",
            defaultValue: "",
            fontSize: 12,
            multiline: false,
            required: false,
            maxLength: undefined,
            textColor: "#000000",
            fontFamily: "Helvetica",
            fontWeight: "regular",
            backgroundColor: null,
            borderColor: null,
            borderWidth: 1,
          },
        ],
      });
      store.state.pages = [{ pageNumber: 1, width: 612, height: 792 }];

      const fileIO = createFileIO(
        { fs, dialogs, store, window: createTestWindow() },
        stubLabels(),
      );

      const error = await fileIO.exportFormFields();
      expect(error).toBeNull();
      const written = fs.writtenFiles.get("/tmp/fields.json");
      expect(written).toBeDefined();
      const parsed = JSON.parse(new TextDecoder().decode(written!));
      expect(parsed.fields).toHaveLength(1);
      expect(parsed.pages).toEqual([{ width: 612, height: 792 }]);
    });

    it("imports form fields and replaces store elements", async () => {
      const { createFileIO } = await import("@/lib/file-io/orchestrator");
      const {
        createTestFileSystem,
        createTestDialogs,
        createTestStore,
        createTestWindow,
      } = await import("@/lib/file-io/adapters/test");

      const json = JSON.stringify({
        version: 1,
        pages: [{ width: 612, height: 792 }],
        fields: [
          {
            type: "checkbox",
            id: "old",
            x: 5,
            y: 6,
            width: 15,
            height: 15,
            pageNumber: 1,
            name: "agree",
            defaultChecked: true,
          },
        ],
      });
      const fs = createTestFileSystem(
        new Map([["/tmp/import.json", new TextEncoder().encode(json)]]),
      );
      const dialogs = createTestDialogs({
        openResult: "/tmp/import.json",
        confirmResult: "yes",
      });
      const store = createTestStore({ pdfBytes: new Uint8Array([1]) });
      store.state.pages = [{ pageNumber: 1, width: 612, height: 792 }];
      store.state.elements = [
        { type: "text", id: "existing" } as any,
      ];

      const fileIO = createFileIO(
        { fs, dialogs, store, window: createTestWindow() },
        stubLabels(),
      );

      const error = await fileIO.importFormFields();
      expect(error).toBeNull();
      expect(store.mutations).toContain("replaceFormElements");
      expect(store.state.elements).toHaveLength(1);
      expect(store.state.elements[0].type).toBe("checkbox");
      expect(store.state.elements[0].id).not.toBe("old");
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
