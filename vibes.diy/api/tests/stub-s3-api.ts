import { Result, URI } from "@adviser/cement";
import { S3Api, FetchResult } from "@vibes.diy/api-types";

/**
 * In-memory S3Api stub. Records puts and serves gets from a Map.
 *
 * Set `hangPut = true` to simulate a wedged R2 — `put()` returns a stream whose
 * write/close never resolve. Used by the cement-bug canary test cases.
 */
export class StubS3Api implements S3Api {
  hangPut = false;
  store = new Map<string, Uint8Array>();
  putCount = 0;
  private pendingPuts = new Map<string, Promise<void>>();
  private idCounter = 0;

  genId(): string {
    this.idCounter += 1;
    return `stub-${this.idCounter}`;
  }

  private toKey(iurl: string): string {
    return URI.from(iurl).pathname.replace(/^\/+/, "");
  }

  async get(iurl: string): Promise<FetchResult> {
    const data = this.store.get(this.toKey(iurl));
    if (data === undefined) return { type: "fetch.notfound", url: iurl };
    return {
      type: "fetch.ok",
      url: iurl,
      data: new ReadableStream({
        start(c) {
          c.enqueue(data);
          c.close();
        },
      }),
    };
  }

  async put(iurl: string): Promise<WritableStream<Uint8Array>> {
    this.putCount += 1;
    const key = this.toKey(iurl);
    if (this.hangPut) {
      return new WritableStream({
        write: () => new Promise<void>(() => undefined),
        close: () => new Promise<void>(() => undefined),
      });
    }
    const chunks: Uint8Array[] = [];
    const store = this.store;
    const pendingPuts = this.pendingPuts;
    let resolveDone!: () => void;
    const done = new Promise<void>((r) => {
      resolveDone = r;
    });
    pendingPuts.set(
      key,
      done.finally(() => pendingPuts.delete(key))
    );
    return new WritableStream({
      write(chunk) {
        chunks.push(chunk);
      },
      close() {
        const total = chunks.reduce((a, c) => a + c.length, 0);
        const merged = new Uint8Array(total);
        let off = 0;
        for (const c of chunks) {
          merged.set(c, off);
          off += c.length;
        }
        store.set(key, merged);
        resolveDone();
      },
      abort() {
        resolveDone();
      },
    });
  }

  async awaitPut(iurl: string): Promise<void> {
    const pending = this.pendingPuts.get(this.toKey(iurl));
    if (pending !== undefined) await pending;
  }

  async rename(fromUrl: string, toUrl: string): Promise<Result<void>> {
    const fromKey = this.toKey(fromUrl);
    const toKey = this.toKey(toUrl);
    await this.awaitPut(fromUrl);
    const data = this.store.get(fromKey);
    if (data === undefined) return Result.Err(new Error(`Object not found: ${fromUrl}`));
    this.store.set(toKey, data);
    this.store.delete(fromKey);
    return Result.Ok(undefined);
  }
}
