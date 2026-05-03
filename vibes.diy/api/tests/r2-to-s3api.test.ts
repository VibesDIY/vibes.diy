import { describe, it, expect } from "vitest";
import type { R2MultipartUpload, R2Object, R2ObjectBody, R2UploadedPart } from "@cloudflare/workers-types";
import { R2ToS3Api } from "@vibes.diy/api-svc";
import type { R2BucketSubset } from "@vibes.diy/api-svc";

const PART_SIZE = 5 * 1024 * 1024;

interface FakeR2Calls {
  put: number;
  get: number;
  head: number;
  delete: number;
  createMultipart: number;
  uploadPart: number;
  complete: number;
  abort: number;
}

interface FakeR2Bucket extends R2BucketSubset {
  readonly store: Map<string, Uint8Array>;
  readonly calls: FakeR2Calls;
  readonly inFlightMultipartParts: Map<string, Uint8Array[]>;
  failComplete: boolean;
}

function makeFakeR2(): FakeR2Bucket {
  const store = new Map<string, Uint8Array>();
  const inFlightMultipartParts = new Map<string, Uint8Array[]>();
  const calls: FakeR2Calls = {
    put: 0,
    get: 0,
    head: 0,
    delete: 0,
    createMultipart: 0,
    uploadPart: 0,
    complete: 0,
    abort: 0,
  };
  let nextUploadId = 1;
  const fake: FakeR2Bucket = {
    store,
    calls,
    inFlightMultipartParts,
    failComplete: false,
    async put(key, value) {
      calls.put += 1;
      const bytes = value instanceof Uint8Array ? value : new Uint8Array(value as ArrayBuffer);
      store.set(key, bytes);
      return makeFakeR2Object(key, bytes.byteLength);
    },
    async get(key) {
      calls.get += 1;
      const bytes = store.get(key);
      if (bytes === undefined) return null;
      return makeFakeR2ObjectBody(key, bytes);
    },
    async head(key) {
      calls.head += 1;
      const bytes = store.get(key);
      if (bytes === undefined) return null;
      return makeFakeR2Object(key, bytes.byteLength);
    },
    async delete(key) {
      calls.delete += 1;
      store.delete(key);
    },
    async createMultipartUpload(key) {
      calls.createMultipart += 1;
      const uploadId = `upl-${nextUploadId++}`;
      inFlightMultipartParts.set(uploadId, []);
      const mp: R2MultipartUpload = {
        key,
        uploadId,
        async uploadPart(partNumber, value) {
          calls.uploadPart += 1;
          const bytes = value instanceof Uint8Array ? value : new Uint8Array(value as ArrayBuffer);
          const parts = inFlightMultipartParts.get(uploadId);
          if (parts === undefined) throw new Error(`uploadPart on aborted/completed upload ${uploadId}`);
          parts[partNumber - 1] = bytes;
          const r: R2UploadedPart = { partNumber, etag: `etag-${partNumber}` };
          return r;
        },
        async complete(uploadedParts) {
          calls.complete += 1;
          if (fake.failComplete) {
            inFlightMultipartParts.delete(uploadId);
            throw new Error("simulated complete() failure");
          }
          const parts = inFlightMultipartParts.get(uploadId);
          if (parts === undefined) throw new Error(`complete on aborted upload ${uploadId}`);
          const ordered = uploadedParts.map((p) => {
            const part = parts[p.partNumber - 1];
            if (part === undefined) throw new Error(`missing part ${p.partNumber}`);
            return part;
          });
          const total = ordered.reduce((a, c) => a + c.byteLength, 0);
          const merged = new Uint8Array(total);
          let off = 0;
          for (const p of ordered) {
            merged.set(p, off);
            off += p.byteLength;
          }
          store.set(key, merged);
          inFlightMultipartParts.delete(uploadId);
          return makeFakeR2Object(key, total);
        },
        async abort() {
          calls.abort += 1;
          inFlightMultipartParts.delete(uploadId);
        },
      };
      return mp;
    },
  };
  return fake;
}

function makeFakeR2Object(key: string, size: number): R2Object {
  return {
    key,
    version: "v1",
    size,
    etag: "etag",
    httpEtag: '"etag"',
    checksums: {} as R2Object["checksums"],
    uploaded: new Date(0),
    storageClass: "Standard",
    writeHttpMetadata() {
      // no-op for tests
    },
  } as R2Object;
}

function makeFakeR2ObjectBody(key: string, bytes: Uint8Array): R2ObjectBody {
  const obj = makeFakeR2Object(key, bytes.byteLength);
  return {
    ...obj,
    bodyUsed: false,
    body: new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes);
        c.close();
      },
    }),
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    },
    async bytes() {
      return bytes;
    },
    async text() {
      return new TextDecoder().decode(bytes);
    },
    async json<T>(): Promise<T> {
      return JSON.parse(new TextDecoder().decode(bytes)) as T;
    },
    async blob() {
      // Copy into a fresh ArrayBuffer to satisfy strict Blob typing.
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      return new Blob([copy.buffer]);
    },
  } as unknown as R2ObjectBody;
}

const stubSthis = {
  nextId: (_bytes?: number) => ({
    str: "stub-id-12",
    bin: new Uint8Array(),
    toString: () => "stub-id-12",
  }),
};

async function pipeBytes(api: R2ToS3Api, url: string, bytes: Uint8Array, chunkSize: number): Promise<void> {
  const writable = await api.put(url);
  const writer = writable.getWriter();
  for (let off = 0; off < bytes.byteLength; off += chunkSize) {
    const end = Math.min(off + chunkSize, bytes.byteLength);
    await writer.write(bytes.subarray(off, end));
  }
  await writer.close();
}

function makePayload(size: number, marker: number): Uint8Array {
  const out = new Uint8Array(size);
  for (let i = 0; i < size; i++) out[i] = (marker + i) & 0xff;
  return out;
}

describe("R2ToS3Api unified buffer + multipart", () => {
  it("Case G: small (1 KB) single-PUT path", async () => {
    const fake = makeFakeR2();
    const api = new R2ToS3Api(fake, stubSthis);
    const payload = makePayload(1024, 7);
    await pipeBytes(api, "s3://r2/temp/g.tmp", payload, 256);

    expect(fake.calls.put).toBe(1);
    expect(fake.calls.createMultipart).toBe(0);
    expect(fake.calls.uploadPart).toBe(0);
    expect(fake.calls.complete).toBe(0);
    expect(fake.store.get("r2/temp/g.tmp")).toEqual(payload);
  });

  it("Case F: exactly 5 MiB stays on single-PUT path", async () => {
    const fake = makeFakeR2();
    const api = new R2ToS3Api(fake, stubSthis);
    const payload = makePayload(PART_SIZE, 11);
    await pipeBytes(api, "s3://r2/temp/f.tmp", payload, 1024 * 1024);

    expect(fake.calls.put).toBe(1);
    expect(fake.calls.createMultipart).toBe(0);
    expect(fake.store.get("r2/temp/f.tmp")?.byteLength).toBe(PART_SIZE);
  });

  it("Case E: 12 MiB switches to multipart path with multiple parts", async () => {
    const fake = makeFakeR2();
    const api = new R2ToS3Api(fake, stubSthis);
    const payload = makePayload(12 * 1024 * 1024, 17);
    await pipeBytes(api, "s3://r2/temp/e.tmp", payload, 1024 * 1024);

    expect(fake.calls.put).toBe(0);
    expect(fake.calls.createMultipart).toBe(1);
    expect(fake.calls.uploadPart).toBeGreaterThanOrEqual(2);
    expect(fake.calls.complete).toBe(1);
    expect(fake.calls.abort).toBe(0);
    const stored = fake.store.get("r2/temp/e.tmp");
    expect(stored?.byteLength).toBe(payload.byteLength);
    // Spot-check first/middle/last bytes instead of deep-equal on 12 MiB.
    expect(stored?.[0]).toBe(payload[0]);
    expect(stored?.[payload.byteLength >> 1]).toBe(payload[payload.byteLength >> 1]);
    expect(stored?.[payload.byteLength - 1]).toBe(payload[payload.byteLength - 1]);
  }, 15000);

  it("Case H: complete() failure triggers abort and rejects awaitPut", async () => {
    const fake = makeFakeR2();
    fake.failComplete = true;
    const api = new R2ToS3Api(fake, stubSthis);
    const payload = makePayload(6 * 1024 * 1024, 23);

    let writeError: Error | undefined;
    const writable = await api.put("s3://r2/temp/h.tmp");
    const writer = writable.getWriter();
    const chunkSize = 1024 * 1024;
    const closePromise = (async () => {
      for (let off = 0; off < payload.byteLength; off += chunkSize) {
        await writer.write(payload.subarray(off, Math.min(off + chunkSize, payload.byteLength)));
      }
      await writer.close();
    })().catch((e: unknown) => {
      writeError = e instanceof Error ? e : new Error(String(e));
    });

    await closePromise;
    expect(writeError).toBeDefined();
    expect(writeError?.message).toMatch(/simulated complete\(\) failure/);
    expect(fake.calls.abort).toBe(1);
    expect(fake.store.has("r2/temp/h.tmp")).toBe(false);

    // pendingPuts cleared so a subsequent awaitPut resolves to undefined.
    await expect(api.awaitPut("s3://r2/temp/h.tmp")).resolves.toBeUndefined();
  });

  it("Case I: two concurrent puts of different keys both finalize", async () => {
    const fake = makeFakeR2();
    const api = new R2ToS3Api(fake, stubSthis);
    const a = makePayload(12 * 1024 * 1024, 31);
    const b = makePayload(12 * 1024 * 1024, 37);

    await Promise.all([
      pipeBytes(api, "s3://r2/temp/i-a.tmp", a, 1024 * 1024),
      pipeBytes(api, "s3://r2/temp/i-b.tmp", b, 1024 * 1024),
    ]);

    expect(fake.calls.createMultipart).toBe(2);
    expect(fake.calls.complete).toBe(2);
    const sa = fake.store.get("r2/temp/i-a.tmp");
    const sb = fake.store.get("r2/temp/i-b.tmp");
    expect(sa?.byteLength).toBe(a.byteLength);
    expect(sb?.byteLength).toBe(b.byteLength);
    expect(sa?.[0]).toBe(a[0]);
    expect(sb?.[0]).toBe(b[0]);
  }, 15000);

  it("Case J: rename copies temp object to final key (existing behavior)", async () => {
    const fake = makeFakeR2();
    const api = new R2ToS3Api(fake, stubSthis);
    const payload = makePayload(8192, 41);
    await pipeBytes(api, "s3://r2/temp/j.tmp", payload, 1024);
    expect(fake.store.has("r2/temp/j.tmp")).toBe(true);

    const r = await api.rename("s3://r2/temp/j.tmp", "s3://r2/zCidJ");
    expect(r.isOk()).toBe(true);
    expect(fake.store.has("r2/temp/j.tmp")).toBe(false);
    expect(fake.store.get("r2/zCidJ")).toEqual(payload);
  });
});
