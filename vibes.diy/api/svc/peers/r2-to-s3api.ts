import { Result, URI } from "@adviser/cement";
import { R2Bucket } from "@cloudflare/workers-types";
import { SuperThis } from "@fireproof/core-types-base";
import { FetchResult, S3Api } from "@vibes.diy/api-types";

export class R2ToS3Api implements S3Api {
  private r2: R2Bucket;
  private smThis: { nextId: SuperThis["nextId"] };
  private pendingPuts = new Map<string, Promise<void>>();

  constructor(r2: R2Bucket, smThis: { nextId: SuperThis["nextId"] }) {
    this.r2 = r2;
    this.smThis = smThis;
  }

  genId(): string {
    return this.smThis.nextId(12).str;
  }

  // Path-preserving key extraction.
  // s3://r2/<cid>          -> <cid>
  // s3://r2/temp/<id>.tmp  -> temp/<id>.tmp
  private toKey(iurl: string): string {
    return URI.from(iurl).pathname.replace(/^\/+/, "");
  }

  async get(iurl: string): Promise<FetchResult> {
    try {
      const obj = await this.r2.get(this.toKey(iurl));
      if (obj === null) {
        return { type: "fetch.notfound", url: iurl };
      }
      return { type: "fetch.ok", url: iurl, data: obj.body as unknown as ReadableStream<Uint8Array> };
    } catch (e) {
      console.error(`R2ToS3Api.get(${iurl}) failed:`, e);
      return { type: "fetch.err", url: iurl, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }

  // Buffer-then-put: collect chunks via the writable, then call r2.put with a
  // single Uint8Array on close. R2 rejects ReadableStream puts without a known
  // content-length (the original TransformStream approach manifested as
  // "all peers failed" with no detail). Buffering keeps semantics simple and
  // is fine for our content sizes (KB to a few MB).
  async put(iurl: string): Promise<WritableStream<Uint8Array>> {
    const key = this.toKey(iurl);
    const r2 = this.r2;
    const pendingPuts = this.pendingPuts;

    const chunks: Uint8Array[] = [];
    let resolveDone!: () => void;
    let rejectDone!: (e: Error) => void;
    const donePromise = new Promise<void>((resolve, reject) => {
      resolveDone = resolve;
      rejectDone = reject;
    });
    pendingPuts.set(
      key,
      donePromise.finally(() => pendingPuts.delete(key))
    );

    return new WritableStream<Uint8Array>({
      write(chunk) {
        chunks.push(chunk);
      },
      async close() {
        try {
          const total = chunks.reduce((acc, c) => acc + c.length, 0);
          const merged = new Uint8Array(total);
          let off = 0;
          for (const c of chunks) {
            merged.set(c, off);
            off += c.length;
          }
          await r2.put(key, merged);
          resolveDone();
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          console.error(`R2ToS3Api.put(${key}, ${chunks.reduce((a, c) => a + c.length, 0)}B) failed:`, err);
          rejectDone(err);
          throw err;
        }
      },
      abort(reason) {
        const err = reason instanceof Error ? reason : new Error(String(reason));
        rejectDone(err);
      },
    });
  }

  async awaitPut(iurl: string): Promise<void> {
    const pending = this.pendingPuts.get(this.toKey(iurl));
    if (pending !== undefined) {
      await pending;
    }
  }

  async rename(fromUrl: string, toUrl: string): Promise<Result<void>> {
    try {
      const fromKey = this.toKey(fromUrl);
      const toKey = this.toKey(toUrl);
      // Wait for the source put to finish before reading.
      await this.awaitPut(fromUrl);
      const src = await this.r2.get(fromKey);
      if (src === null) {
        const err = new Error(`Object not found: ${fromUrl}`);
        console.error(`R2ToS3Api.rename: ${err.message}`);
        return Result.Err(err);
      }
      const sourceBytes = new Uint8Array(await src.arrayBuffer());
      await this.r2.put(toKey, sourceBytes);
      const dest = await this.r2.head(toKey);
      if (dest === null) {
        const err = new Error(`Destination put failed: ${toUrl}`);
        console.error(`R2ToS3Api.rename: ${err.message}`);
        return Result.Err(err);
      }
      if (dest.size !== sourceBytes.length) {
        const err = new Error(`Destination size mismatch: from=${sourceBytes.length} to=${dest.size}`);
        console.error(`R2ToS3Api.rename: ${err.message}`);
        return Result.Err(err);
      }
      // Only delete source after a successful copy + size sanity check.
      await this.r2.delete(fromKey);
      return Result.Ok(undefined);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error(`R2ToS3Api.rename(${fromUrl} -> ${toUrl}) failed:`, err);
      return Result.Err(err);
    }
  }
}
