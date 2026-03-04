import { Result, URI } from "@adviser/cement";
import { R2Bucket, ReadableStream as CFReadableStream } from "@cloudflare/workers-types";
import { SuperThis } from "@fireproof/core-types-base";
import { FetchResult, S3Api } from "@vibes.diy/api-types";

export class R2ToS3Api implements S3Api {
  private r2: R2Bucket;
  private smThis: { nextId: SuperThis["nextId"] };
  constructor(r2: R2Bucket, smThis: { nextId: SuperThis["nextId"] }) {
    this.r2 = r2;
    this.smThis = smThis;
  }
  genId(): string {
    return this.smThis.nextId(12).str;
  }
  private toKey(iurl: string): string {
    return URI.from(iurl).pathname.replace(/.*\//, "");
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
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    // R2 accepts ReadableStream directly — no buffering needed
    void this.r2.put(this.toKey(iurl), readable as unknown as CFReadableStream);
    return writable;
  }
  async rename(fromUrl: string, toUrl: string): Promise<Result<void>> {
    try {
      // R2 doesn't support renaming, so we need to copy and delete
      const obj = await this.r2.get(this.toKey(fromUrl));
      if (obj === null) {
        return Result.Err(`Object not found: ${fromUrl}`);
      }
      await this.r2.put(this.toKey(toUrl), obj.body as unknown as CFReadableStream);
      await this.r2.delete(this.toKey(fromUrl));
      return Result.Ok(undefined);
    } catch (e) {
      return Result.Err(e as Error);
    }
  }
}
