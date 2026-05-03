import { exception2Result, Result, URI } from "@adviser/cement";
import type { R2MultipartUpload, R2Object, R2ObjectBody, R2UploadedPart } from "@cloudflare/workers-types";
import type { SuperThis } from "@fireproof/core-types-base";
import type { FetchResult, S3Api } from "@vibes.diy/api-types";

// Subset of R2Bucket actually used by R2ToS3Api. Production passes a real
// R2Bucket (env.FS_IDS_BUCKET) which structurally satisfies this. Tests pass
// a small in-memory fake that implements only this surface.
export interface R2BucketSubset {
  get(key: string): Promise<R2ObjectBody | null>;
  head(key: string): Promise<R2Object | null>;
  put(key: string, value: Uint8Array): Promise<R2Object>;
  delete(key: string): Promise<void>;
  createMultipartUpload(key: string): Promise<R2MultipartUpload>;
}

const PART_SIZE = 5 * 1024 * 1024;

function concatChunks(chunks: readonly Uint8Array[], total: number): Uint8Array {
  const merged = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    merged.set(c, off);
    off += c.length;
  }
  return merged;
}

export class R2ToS3Api implements S3Api {
  private readonly r2: R2BucketSubset;
  private readonly smThis: { nextId: SuperThis["nextId"] };
  private readonly pendingPuts = new Map<string, Promise<void>>();

  constructor(r2: R2BucketSubset, smThis: { nextId: SuperThis["nextId"] }) {
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
    const r = await exception2Result(() => this.r2.get(this.toKey(iurl)));
    if (r.isErr()) {
      const err = r.Err();
      console.error(`R2ToS3Api.get(${iurl}) failed:`, err);
      return { type: "fetch.err", url: iurl, error: err };
    }
    const obj = r.Ok();
    if (obj === null) {
      return { type: "fetch.notfound", url: iurl };
    }
    return { type: "fetch.ok", url: iurl, data: obj.body as unknown as ReadableStream<Uint8Array> };
  }

  // Unified buffer + multipart path.
  // - <5 MiB total: a single r2.put(Uint8Array) on close. No multipart overhead.
  // - >=5 MiB: chunks accumulate up to PART_SIZE, then flush as a multipart
  //   uploadPart and reset. On close, any remaining chunks become the final
  //   part (R2 allows the last part to be smaller than PART_SIZE) and we
  //   complete().
  // The decision is lazy — we never start multipart for small assets.
  // Memory bound: ~PART_SIZE in flight; independent of total asset size.
  // R2 rejects ReadableStream puts without a known length, so we always pass
  // Uint8Array (small path) or per-part Uint8Array (multipart path).
  async put(iurl: string): Promise<WritableStream<Uint8Array>> {
    const key = this.toKey(iurl);
    const r2 = this.r2;
    const pendingPuts = this.pendingPuts;

    let chunks: Uint8Array[] = [];
    let bufferedBytes = 0;
    let multipart: R2MultipartUpload | undefined = undefined;
    let nextPartNumber = 1;
    const completedParts: R2UploadedPart[] = [];

    let resolveDone!: () => void;
    let rejectDone!: (e: Error) => void;
    const donePromise = new Promise<void>((resolve, reject) => {
      resolveDone = resolve;
      rejectDone = reject;
    });
    // Map holds a promise that always resolves once the put settles (success
    // or failure). Rejection is surfaced to the writer-side promise (per
    // WritableStream contract); awaitPut callers just need to know the put
    // settled, not whether it succeeded.
    const settled = donePromise.then(
      () => {
        pendingPuts.delete(key);
      },
      () => {
        pendingPuts.delete(key);
      }
    );
    pendingPuts.set(key, settled);

    const flushPart = async (): Promise<Result<void>> => {
      if (chunks.length === 0) return Result.Ok(undefined);
      const merged = concatChunks(chunks, bufferedBytes);
      chunks = [];
      bufferedBytes = 0;
      if (multipart === undefined) {
        const r = await exception2Result(() => r2.createMultipartUpload(key));
        if (r.isErr()) return Result.Err(r.Err());
        multipart = r.Ok();
      }
      const mp = multipart;
      const r = await exception2Result(() => mp.uploadPart(nextPartNumber++, merged));
      if (r.isErr()) return Result.Err(r.Err());
      completedParts.push(r.Ok());
      return Result.Ok(undefined);
    };

    const finalize = async (): Promise<Result<void>> => {
      if (multipart === undefined) {
        return exception2Result(() => r2.put(key, concatChunks(chunks, bufferedBytes)).then(() => undefined));
      }
      const flush = await flushPart();
      if (flush.isErr()) return flush;
      const mp = multipart;
      return exception2Result(() => mp.complete(completedParts).then(() => undefined));
    };

    return new WritableStream<Uint8Array>({
      async write(chunk) {
        chunks.push(chunk);
        bufferedBytes += chunk.byteLength;
        if (bufferedBytes > PART_SIZE) {
          const r = await flushPart();
          if (r.isErr()) {
            const err = r.Err();
            console.error(`R2ToS3Api.put(${key}) flushPart failed:`, err);
            rejectDone(err);
            // Surface to writer-side promise per WritableStream contract.
            throw err;
          }
        }
      },
      async close() {
        const r = await finalize();
        if (r.isErr()) {
          const err = r.Err();
          console.error(`R2ToS3Api.put(${key}) finalize failed:`, err);
          if (multipart !== undefined) {
            const mp = multipart;
            const ar = await exception2Result(() => mp.abort());
            if (ar.isErr()) console.error(`R2ToS3Api.put(${key}) abort after failure also failed:`, ar.Err());
          }
          rejectDone(err);
          throw err;
        }
        resolveDone();
      },
      async abort(reason) {
        const err = reason instanceof Error ? reason : new Error(String(reason));
        if (multipart !== undefined) {
          const mp = multipart;
          const ar = await exception2Result(() => mp.abort());
          if (ar.isErr()) console.error(`R2ToS3Api.put(${key}) abort failed:`, ar.Err());
        }
        rejectDone(err);
      },
    });
  }

  async awaitPut(iurl: string): Promise<void> {
    const pending = this.pendingPuts.get(this.toKey(iurl));
    if (pending !== undefined) {
      // The map's promise always resolves (rejection is surfaced via the
      // writer-side promise per WritableStream contract).
      await pending;
    }
  }

  async rename(fromUrl: string, toUrl: string): Promise<Result<void>> {
    const fromKey = this.toKey(fromUrl);
    const toKey = this.toKey(toUrl);
    // Wait for the source put to finish before reading.
    await this.awaitPut(fromUrl);

    const rGet = await exception2Result(() => this.r2.get(fromKey));
    if (rGet.isErr()) {
      const err = rGet.Err();
      console.error(`R2ToS3Api.rename(${fromUrl} -> ${toUrl}) get failed:`, err);
      return Result.Err(err);
    }
    const src = rGet.Ok();
    if (src === null) {
      const err = new Error(`Object not found: ${fromUrl}`);
      console.error(`R2ToS3Api.rename: ${err.message}`);
      return Result.Err(err);
    }

    const rBytes = await exception2Result(() => src.arrayBuffer());
    if (rBytes.isErr()) {
      const err = rBytes.Err();
      console.error(`R2ToS3Api.rename(${fromUrl}) read failed:`, err);
      return Result.Err(err);
    }
    const sourceBytes = new Uint8Array(rBytes.Ok());

    const rPut = await exception2Result(() => this.r2.put(toKey, sourceBytes));
    if (rPut.isErr()) {
      const err = rPut.Err();
      console.error(`R2ToS3Api.rename(${fromUrl} -> ${toUrl}) put failed:`, err);
      return Result.Err(err);
    }

    const rHead = await exception2Result(() => this.r2.head(toKey));
    if (rHead.isErr()) {
      const err = rHead.Err();
      console.error(`R2ToS3Api.rename(${toUrl}) head failed:`, err);
      return Result.Err(err);
    }
    const dest = rHead.Ok();
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

    const rDel = await exception2Result(() => this.r2.delete(fromKey));
    if (rDel.isErr()) {
      const err = rDel.Err();
      console.error(`R2ToS3Api.rename(${fromUrl}) delete failed:`, err);
      return Result.Err(err);
    }
    return Result.Ok(undefined);
  }
}
