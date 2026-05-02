import { Result, URI } from "@adviser/cement";
import { R2Bucket, ReadableStream as CFReadableStream } from "@cloudflare/workers-types";
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
      return { type: "fetch.err", url: iurl, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }

  async put(iurl: string): Promise<WritableStream<Uint8Array>> {
    const key = this.toKey(iurl);
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    // Track the put completion so close()/rename() can await it.
    // R2 .put(key, ReadableStream) resolves once the stream has been fully consumed,
    // i.e. after the writer side closes.
    const putPromise = this.r2
      .put(key, readable as unknown as CFReadableStream)
      .then(() => undefined)
      .finally(() => {
        this.pendingPuts.delete(key);
      });
    this.pendingPuts.set(key, putPromise);
    return writable;
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
        return Result.Err(new Error(`Object not found: ${fromUrl}`));
      }
      const sourceSize = src.size;
      await this.r2.put(toKey, src.body as unknown as CFReadableStream);
      const dest = await this.r2.head(toKey);
      if (dest === null) {
        return Result.Err(new Error(`Destination put failed: ${toUrl}`));
      }
      if (dest.size !== sourceSize) {
        return Result.Err(new Error(`Destination size mismatch on rename: from=${sourceSize} to=${dest.size}`));
      }
      // Only delete source after a successful copy + size sanity check.
      await this.r2.delete(fromKey);
      return Result.Ok(undefined);
    } catch (e) {
      return Result.Err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
