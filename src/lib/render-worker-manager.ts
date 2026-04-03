import {
  loadPdfDocument,
  type PdfDocument,
  type CancellableRender,
} from "./pdf-loader";

export interface RenderHandle {
  promise: Promise<ImageBitmap>;
  cancel: () => void;
}

interface QueueEntry {
  pageNumber: number;
  scale: number;
  resolve: (bitmap: ImageBitmap) => void;
  reject: (err: Error) => void;
  cancelled: boolean;
  activeRender: CancellableRender | null;
}

const MAX_CONCURRENT = 3;

class RenderManager {
  private doc: PdfDocument | null = null;
  private loadGeneration = 0;
  private documentLoadPromise: Promise<void> = new Promise<void>(() => {});
  private active = 0;
  private queue: QueueEntry[] = [];

  async load(pdfBytes: Uint8Array): Promise<void> {
    this.cancelAll();
    this.loadGeneration++;

    this.documentLoadPromise = loadPdfDocument(pdfBytes).then((doc) => {
      this.doc = doc;
    });
    return this.documentLoadPromise;
  }

  renderPage(pageNumber: number, scale: number): RenderHandle {
    let cancelled = false;
    let entry: QueueEntry | null = null;
    const gen = this.loadGeneration;

    const promise = this.documentLoadPromise.then(() => {
      if (cancelled || gen !== this.loadGeneration)
        throw new Error("Render cancelled");

      return new Promise<ImageBitmap>((resolve, reject) => {
        if (cancelled) {
          reject(new Error("Render cancelled"));
          return;
        }
        entry = {
          pageNumber,
          scale,
          resolve,
          reject,
          cancelled: false,
          activeRender: null,
        };
        this.queue.push(entry);
        this.drain();
      });
    });

    const cancel = () => {
      cancelled = true;
      if (entry) {
        entry.cancelled = true;
        entry.activeRender?.cancel();
      }
    };

    return { promise, cancel };
  }

  private drain() {
    while (this.queue.length > 0 && this.active < MAX_CONCURRENT) {
      const entry = this.queue.pop()!;
      if (entry.cancelled) continue;
      this.active++;

      const render = this.doc!.startRender(entry.pageNumber, entry.scale);
      entry.activeRender = render;

      render.promise
        .then((result) => {
          if (entry.cancelled) {
            result.bitmap.close();
          } else {
            entry.resolve(result.bitmap);
          }
        })
        .catch((err) => {
          if (!entry.cancelled) {
            entry.reject(err instanceof Error ? err : new Error(String(err)));
          }
        })
        .finally(() => {
          entry.activeRender = null;
          this.active--;
          setTimeout(() => this.drain(), 0);
        });
    }
  }

  cancelAll() {
    for (const entry of this.queue) {
      entry.cancelled = true;
      entry.activeRender?.cancel();
    }
    this.queue = [];
  }

  destroy() {
    this.cancelAll();
    this.doc = null;
    this.documentLoadPromise = new Promise<void>(() => {});
  }
}

let instance: RenderManager | null = null;

export function getRenderManager(): RenderManager {
  if (!instance) {
    instance = new RenderManager();
  }
  return instance;
}

export function destroyRenderManager() {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}
