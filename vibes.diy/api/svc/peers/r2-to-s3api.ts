import { exception2Result, Result, URI } from "@adviser/cement";
import type { R2GetOptions, R2MultipartUpload, R2Object, R2ObjectBody, R2UploadedPart } from "@cloudflare/workers-types";
import type { SuperThis } from "@fireproof/core-types-base";
import type { FetchResult, S3Api, S3PutOptions, S3RenameOptions, StorageProgressFn } from "@vibes.diy/api-types";

// Subset of R2Bucket actually used by R2ToS3Api. Production passes a real
// R2Bucket (env.FS_IDS_BUCKET) which structurally satisfies this. Tests pass
// a small in-memory fake that implements only this surface.
export interface R2BucketSubset {
  get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null>;
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

  // Unified buffer + multipart path with non-blocking writes.
  //
  // - <=5 MiB total: a single r2.put(Uint8Array) on close. No multipart
  //   overhead. Small path stays simple and fast.
  // - >5 MiB: chunks accumulate up to PART_SIZE, then a flushPart is kicked
  //   off in the background (we DO NOT await it inside write()). The
  //   in-flight part promise is tracked. The chunk buffer resets so write()
  //   returns immediately and continues accepting chunks. On close, we kick
  //   off finalize in the background too — close() returns fast.
  //
  // Why non-blocking: cement's teeWriter wraps each peer write/close with a
  // 5s peerTimeout. A multi-MB R2 multipart upload can easily exceed 5s of
  // network time. If write() awaited flushPart synchronously, cement would
  // time out the peer mid-upload. Instead we let R2 work happen in the
  // background and surface the eventual result through the put-promise
  // tracked in pendingPuts. awaitPut() (called by rename, NOT by the
  // teeWriter-wrapped close) is where callers actually wait for completion
  // and observe success/failure.
  //
  // R2 rejects ReadableStream puts without a known length (verified
  // 2026-05-03: TypeError "Provided readable stream must have a known
  // length"). We always pass Uint8Array — single PUT for small, per-part
  // for multipart.
  async put(iurl: string, opts?: S3PutOptions): Promise<WritableStream<Uint8Array>> {
    const key = this.toKey(iurl);
    const r2 = this.r2;
    const pendingPuts = this.pendingPuts;
    const onProgress: StorageProgressFn | undefined = opts?.onProgress;

    let chunks: Uint8Array[] = [];
    let bufferedBytes = 0;
    let multipartPromise: Promise<Result<R2MultipartUpload>> | undefined = undefined;
    let nextPartNumber = 1;
    const inFlightParts: Promise<Result<R2UploadedPart>>[] = [];
    let totalBytesUploaded = 0;

    let resolveDone!: () => void;
    let rejectDone!: (e: Error) => void;
    const donePromise = new Promise<void>((resolve, reject) => {
      resolveDone = resolve;
      rejectDone = reject;
    });
    // Map holds a promise that always resolves once the put settles (success
    // or failure). Rejection is surfaced via the put-promise machinery to
    // awaitPut callers in rename().
    const settled = donePromise.then(
      () => {
        pendingPuts.delete(key);
      },
      () => {
        pendingPuts.delete(key);
      }
    );
    pendingPuts.set(key, settled);

    const ensureMultipart = (): Promise<Result<R2MultipartUpload>> => {
      if (multipartPromise === undefined) {
        multipartPromise = exception2Result(() => r2.createMultipartUpload(key));
      }
      return multipartPromise;
    };

    // Snapshot current buffer and kick off a background uploadPart.
    // Returns the in-flight promise so finalize can await all of them later.
    const flushPartBackground = (): Promise<Result<R2UploadedPart>> => {
      const merged = concatChunks(chunks, bufferedBytes);
      chunks = [];
      bufferedBytes = 0;
      const myPartNumber = nextPartNumber++;
      const partBytes = merged.byteLength;
      return (async (): Promise<Result<R2UploadedPart>> => {
        const mpResult = await ensureMultipart();
        if (mpResult.isErr()) return Result.Err(mpResult.Err());
        const mp = mpResult.Ok();
        const r = await exception2Result(() => mp.uploadPart(myPartNumber, merged));
        if (r.isOk() && onProgress) {
          totalBytesUploaded += partBytes;
          onProgress({ stage: "uploading-part", partNumber: myPartNumber, bytes: totalBytesUploaded });
        }
        return r;
      })();
    };

    const finalize = async (): Promise<Result<void>> => {
      // Wait for any background parts that were kicked off during writes.
      const partResults = await Promise.all(inFlightParts);
      const firstErr = partResults.find((r) => r.isErr());
      if (firstErr !== undefined) {
        const mpResult = multipartPromise === undefined ? undefined : await multipartPromise;
        if (mpResult !== undefined && mpResult.isOk()) {
          const mp = mpResult.Ok();
          const ar = await exception2Result(() => mp.abort());
          if (ar.isErr()) console.error(`R2ToS3Api.put(${key}) abort after part failure also failed:`, ar.Err());
        }
        return Result.Err(firstErr.Err());
      }

      if (multipartPromise === undefined) {
        // Small path: never crossed the threshold.
        const small = concatChunks(chunks, bufferedBytes);
        const rPut = await exception2Result(() => r2.put(key, small).then(() => undefined));
        if (rPut.isOk() && onProgress) {
          onProgress({ stage: "asset-stored", bytes: small.byteLength });
        }
        return rPut;
      }

      // Multipart path: flush any remaining chunks as the final part
      // (R2 allows the last part to be smaller than PART_SIZE).
      if (chunks.length > 0) {
        const finalR = await flushPartBackground();
        if (finalR.isErr()) {
          const mpResult = await multipartPromise;
          if (mpResult.isOk()) {
            const mp = mpResult.Ok();
            const ar = await exception2Result(() => mp.abort());
            if (ar.isErr()) console.error(`R2ToS3Api.put(${key}) abort after final-part failure also failed:`, ar.Err());
          }
          return Result.Err(finalR.Err());
        }
        partResults.push(finalR);
      }

      const completed: R2UploadedPart[] = partResults.flatMap((r) => (r.isOk() ? [r.Ok()] : []));
      const mpResult = await multipartPromise;
      if (mpResult.isErr()) return Result.Err(mpResult.Err());
      const mp = mpResult.Ok();
      const completeR = await exception2Result(() => mp.complete(completed).then(() => undefined));
      if (completeR.isErr()) {
        const ar = await exception2Result(() => mp.abort());
        if (ar.isErr()) console.error(`R2ToS3Api.put(${key}) abort after complete failure also failed:`, ar.Err());
      } else if (onProgress) {
        onProgress({ stage: "asset-stored", bytes: totalBytesUploaded });
      }
      return completeR;
    };

    // Background finalize: settles donePromise. Called from close()/abort()
    // so the WritableStream-level promise returns quickly and stays inside
    // cement's per-op peerTimeout window. Real R2 work continues; awaitPut
    // is where callers eventually wait for the result.
    const finalizeInBackground = (): void => {
      finalize().then(
        (r) => {
          if (r.isErr()) {
            const err = r.Err();
            console.error(`R2ToS3Api.put(${key}) finalize failed:`, err);
            rejectDone(err);
          } else {
            resolveDone();
          }
        },
        (e: unknown) => {
          const err = e instanceof Error ? e : new Error(String(e));
          console.error(`R2ToS3Api.put(${key}) finalize threw:`, err);
          rejectDone(err);
        }
      );
    };

    return new WritableStream<Uint8Array>({
      write(chunk) {
        chunks.push(chunk);
        bufferedBytes += chunk.byteLength;
        if (bufferedBytes > PART_SIZE) {
          inFlightParts.push(flushPartBackground());
        }
      },
      close() {
        finalizeInBackground();
      },
      async abort(reason) {
        const err = reason instanceof Error ? reason : new Error(String(reason));
        if (multipartPromise !== undefined) {
          const mpResult = await multipartPromise;
          if (mpResult.isOk()) {
            const mp = mpResult.Ok();
            const ar = await exception2Result(() => mp.abort());
            if (ar.isErr()) console.error(`R2ToS3Api.put(${key}) abort failed:`, ar.Err());
          }
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

  // Streaming copy via Range gets + multipart for objects > PART_SIZE.
  // Memory bound: ~PART_SIZE in transit, regardless of source size.
  // Small objects (<= PART_SIZE) take a single arrayBuffer + put round-trip.
  //
  // Future: R2's S3-compatible CopyObject is a true server-side copy with
  // zero data transfer through the worker. Switching to it would make rename
  // O(1) on object size but requires the AWS S3 SDK and R2 access keys/IAM
  // (out of scope for the Workers binding we use here).
  async rename(fromUrl: string, toUrl: string, opts?: S3RenameOptions): Promise<Result<void>> {
    const fromKey = this.toKey(fromUrl);
    const toKey = this.toKey(toUrl);
    const onProgress = opts?.onProgress;
    // Wait for the source put to finish before reading.
    await this.awaitPut(fromUrl);

    const rHead = await exception2Result(() => this.r2.head(fromKey));
    if (rHead.isErr()) {
      const err = rHead.Err();
      console.error(`R2ToS3Api.rename(${fromUrl}) head failed:`, err);
      return Result.Err(err);
    }
    const srcMeta = rHead.Ok();
    if (srcMeta === null) {
      const err = new Error(`Object not found: ${fromUrl}`);
      console.error(`R2ToS3Api.rename: ${err.message}`);
      return Result.Err(err);
    }
    const sourceSize = srcMeta.size;

    if (sourceSize <= PART_SIZE) {
      const rCopy = await this.copySmallObject(fromKey, toKey);
      if (rCopy.isErr()) return rCopy;
      if (onProgress) {
        onProgress({ stage: "asset-renamed", bytes: sourceSize });
      }
    } else {
      const rCopy = await this.copyLargeObjectStreaming(fromKey, toKey, sourceSize, onProgress);
      if (rCopy.isErr()) return rCopy;
    }

    const rDestHead = await exception2Result(() => this.r2.head(toKey));
    if (rDestHead.isErr()) {
      const err = rDestHead.Err();
      console.error(`R2ToS3Api.rename(${toUrl}) destination head failed:`, err);
      return Result.Err(err);
    }
    const dest = rDestHead.Ok();
    if (dest === null) {
      const err = new Error(`Destination put failed: ${toUrl}`);
      console.error(`R2ToS3Api.rename: ${err.message}`);
      return Result.Err(err);
    }
    if (dest.size !== sourceSize) {
      const err = new Error(`Destination size mismatch: from=${sourceSize} to=${dest.size}`);
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

  private async copySmallObject(fromKey: string, toKey: string): Promise<Result<void>> {
    const rGet = await exception2Result(() => this.r2.get(fromKey));
    if (rGet.isErr()) {
      const err = rGet.Err();
      console.error(`R2ToS3Api.rename get(${fromKey}) failed:`, err);
      return Result.Err(err);
    }
    const src = rGet.Ok();
    if (src === null) {
      const err = new Error(`Object disappeared during rename: ${fromKey}`);
      console.error(`R2ToS3Api.rename: ${err.message}`);
      return Result.Err(err);
    }
    const rBytes = await exception2Result(() => src.arrayBuffer());
    if (rBytes.isErr()) {
      const err = rBytes.Err();
      console.error(`R2ToS3Api.rename arrayBuffer(${fromKey}) failed:`, err);
      return Result.Err(err);
    }
    const rPut = await exception2Result(() => this.r2.put(toKey, new Uint8Array(rBytes.Ok())));
    if (rPut.isErr()) {
      const err = rPut.Err();
      console.error(`R2ToS3Api.rename put(${toKey}) failed:`, err);
      return Result.Err(err);
    }
    return Result.Ok(undefined);
  }

  private async copyLargeObjectStreaming(
    fromKey: string,
    toKey: string,
    sourceSize: number,
    onProgress?: StorageProgressFn
  ): Promise<Result<void>> {
    const rMp = await exception2Result(() => this.r2.createMultipartUpload(toKey));
    if (rMp.isErr()) {
      const err = rMp.Err();
      console.error(`R2ToS3Api.rename createMultipartUpload(${toKey}) failed:`, err);
      return Result.Err(err);
    }
    const mp = rMp.Ok();

    const completedParts: R2UploadedPart[] = [];
    let partNumber = 1;
    let totalCopied = 0;
    for (let offset = 0; offset < sourceSize; offset += PART_SIZE) {
      const length = Math.min(PART_SIZE, sourceSize - offset);
      const rGet = await exception2Result(() => this.r2.get(fromKey, { range: { offset, length } }));
      if (rGet.isErr()) {
        const err = rGet.Err();
        console.error(`R2ToS3Api.rename range-get(${fromKey}, offset=${offset}) failed:`, err);
        await this.abortQuiet(mp, toKey);
        return Result.Err(err);
      }
      const part = rGet.Ok();
      if (part === null) {
        const err = new Error(`Range get returned null on ${fromKey} at offset=${offset}`);
        console.error(`R2ToS3Api.rename: ${err.message}`);
        await this.abortQuiet(mp, toKey);
        return Result.Err(err);
      }
      const rBytes = await exception2Result(() => part.arrayBuffer());
      if (rBytes.isErr()) {
        const err = rBytes.Err();
        console.error(`R2ToS3Api.rename arrayBuffer(${fromKey}, offset=${offset}) failed:`, err);
        await this.abortQuiet(mp, toKey);
        return Result.Err(err);
      }
      const bytes = new Uint8Array(rBytes.Ok());
      const rUpload = await exception2Result(() => mp.uploadPart(partNumber, bytes));
      if (rUpload.isErr()) {
        const err = rUpload.Err();
        console.error(`R2ToS3Api.rename uploadPart(${toKey}, part=${partNumber}) failed:`, err);
        await this.abortQuiet(mp, toKey);
        return Result.Err(err);
      }
      completedParts.push(rUpload.Ok());
      totalCopied += bytes.byteLength;
      if (onProgress) {
        onProgress({ stage: "rename-part", partNumber, bytes: totalCopied });
      }
      partNumber += 1;
    }

    const rComplete = await exception2Result(() => mp.complete(completedParts).then(() => undefined));
    if (rComplete.isErr()) {
      const err = rComplete.Err();
      console.error(`R2ToS3Api.rename complete(${toKey}) failed:`, err);
      await this.abortQuiet(mp, toKey);
      return Result.Err(err);
    }
    if (onProgress) {
      onProgress({ stage: "asset-renamed", bytes: totalCopied });
    }
    return Result.Ok(undefined);
  }

  private async abortQuiet(mp: R2MultipartUpload, key: string): Promise<void> {
    const ar = await exception2Result(() => mp.abort());
    if (ar.isErr()) console.error(`R2ToS3Api.rename abort(${key}) failed:`, ar.Err());
  }
}
