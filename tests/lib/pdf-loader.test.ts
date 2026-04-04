import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDocumentMock } = vi.hoisted(() => ({
  getDocumentMock: vi.fn(),
}));

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: getDocumentMock,
}));

function createMockPage(width: number, height: number) {
  return {
    getViewport: ({ scale }: { scale: number }) => ({
      width: width * scale,
      height: height * scale,
    }),
    render: vi.fn(() => ({
      promise: Promise.resolve(),
      cancel: vi.fn(),
    })),
  };
}

describe("pdf loading", () => {
  beforeEach(async () => {
    vi.resetModules();
    getDocumentMock.mockReset();

    const { useEditorStore } = await import("@/stores/editor-store");
    useEditorStore.getState().clearPdf();
  });

  it("returns a shared document handle without eagerly loading page metadata", async () => {
    const getPage = vi.fn().mockResolvedValue(createMockPage(612, 792));
    const proxy = {
      numPages: 2,
      fingerprint: "doc-lazy",
      getPage,
      destroy: vi.fn(),
    };

    getDocumentMock.mockReturnValue({
      promise: Promise.resolve(proxy),
      destroy: vi.fn(),
    });

    const { loadPdfDocument } = await import("@/lib/pdf-loader");
    const doc = await loadPdfDocument(new Uint8Array([1, 2, 3]));

    expect(doc.proxy).toBe(proxy);
    expect(doc.pageCount).toBe(2);
    expect(getPage).not.toHaveBeenCalled();

    const pageInfo = await doc.getPageInfo(1);
    expect(pageInfo).toEqual({
      pageNumber: 1,
      width: 612,
      height: 792,
    });
    expect(getPage).toHaveBeenCalledTimes(1);

    const cachedPageInfo = await doc.getPageInfo(1);
    expect(cachedPageInfo).toEqual(pageInfo);
    expect(getPage).toHaveBeenCalledTimes(1);
  });

  it("loads PDF bytes and page metadata into the store", async () => {
    const getPage = vi.fn().mockResolvedValue(createMockPage(612, 792));
    const proxy = {
      numPages: 2,
      fingerprint: "doc-background-pages",
      getPage,
      destroy: vi.fn(),
    };

    getDocumentMock.mockReturnValue({
      promise: Promise.resolve(proxy),
      destroy: vi.fn(),
    });

    const { loadPdfIntoStore } = await import("@/lib/file-operations");
    const { useEditorStore } = await import("@/stores/editor-store");
    const bytes = new Uint8Array([9, 8, 7]);

    await loadPdfIntoStore(bytes, "test.pdf");

    expect(useEditorStore.getState().pdfBytes).toBe(bytes);
    expect(useEditorStore.getState().pages).toEqual([
      { pageNumber: 1, width: 612, height: 792 },
      { pageNumber: 2, width: 612, height: 792 },
    ]);
  });
});
