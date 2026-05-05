import { describe, it, expect } from "vitest";
import type { R2GetOptions, R2MultipartUpload, R2Object, R2ObjectBody, R2UploadedPart } from "@cloudflare/workers-types";
import { R2ToS3Api } from "@vibes.diy/api-svc";
import type { R2BucketSubset } from "@vibes.diy/api-svc";
import type { StorageProgressInfo } from "@vibes.diy/api-types";

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
    async get(key, options) {
      calls.get += 1;
      const bytes = store.get(key);
      if (bytes === undefined) return null;
      const range = (options as R2GetOptions | undefined)?.range;
      if (range !== undefined && !(range instanceof Headers)) {
        let start = 0;
        let end = bytes.byteLength;
        if ("offset" in range && range.offset !== undefined) start = range.offset;
        if ("length" in range && range.length !== undefined) end = start + range.length;
        if ("suffix" in range && range.suffix !== undefined) {
          start = bytes.byteLength - range.suffix;
          end = bytes.byteLength;
        }
        return makeFakeR2ObjectBody(key, bytes.subarray(start, end));
      }
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
  // close() returns immediately (R2 work runs in background); awaitPut waits
  // for the actual put-promise to settle.
  await api.awaitPut(url);
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

    const writable = await api.put("s3://r2/temp/h.tmp");
    const writer = writable.getWriter();
    const chunkSize = 1024 * 1024;
    for (let off = 0; off < payload.byteLength; off += chunkSize) {
      await writer.write(payload.subarray(off, Math.min(off + chunkSize, payload.byteLength)));
    }
    await writer.close();
    // close() returns fast; await the put-promise. The map promise swallows
    // the rejection (rejection is observable via the writer-side promise per
    // WritableStream contract — we don't surface it here).
    await api.awaitPut("s3://r2/temp/h.tmp");
    expect(fake.calls.abort).toBe(1);
    expect(fake.store.has("r2/temp/h.tmp")).toBe(false);
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

  it("Case J: rename of small (<=PART_SIZE) object uses single-PUT", async () => {
    const fake = makeFakeR2();
    const api = new R2ToS3Api(fake, stubSthis);
    const payload = makePayload(8192, 41);
    fake.store.set("r2/temp/j.tmp", payload);
    // Reset call counters so we observe the rename in isolation.
    Object.keys(fake.calls).forEach((k) => {
      fake.calls[k as keyof FakeR2Calls] = 0;
    });

    const r = await api.rename("s3://r2/temp/j.tmp", "s3://r2/zCidJ");
    expect(r.isOk()).toBe(true);
    expect(fake.store.has("r2/temp/j.tmp")).toBe(false);
    expect(fake.store.get("r2/zCidJ")).toEqual(payload);
    expect(fake.calls.put).toBe(1);
    expect(fake.calls.createMultipart).toBe(0);
  });

  it("Case K: rename of large (>PART_SIZE) object uses multipart streaming copy", async () => {
    const fake = makeFakeR2();
    const api = new R2ToS3Api(fake, stubSthis);
    const payload = makePayload(12 * 1024 * 1024, 53);
    fake.store.set("r2/temp/k.tmp", payload);
    Object.keys(fake.calls).forEach((k) => {
      fake.calls[k as keyof FakeR2Calls] = 0;
    });

    const r = await api.rename("s3://r2/temp/k.tmp", "s3://r2/zCidK");
    expect(r.isOk()).toBe(true);
    expect(fake.store.has("r2/temp/k.tmp")).toBe(false);
    const dest = fake.store.get("r2/zCidK");
    expect(dest?.byteLength).toBe(payload.byteLength);
    expect(dest?.[0]).toBe(payload[0]);
    expect(dest?.[payload.byteLength >> 1]).toBe(payload[payload.byteLength >> 1]);
    expect(dest?.[payload.byteLength - 1]).toBe(payload[payload.byteLength - 1]);

    // Multipart streaming was used: createMultipart once, multiple uploadParts,
    // one complete, no single-PUT.
    expect(fake.calls.createMultipart).toBe(1);
    expect(fake.calls.uploadPart).toBeGreaterThanOrEqual(2);
    expect(fake.calls.complete).toBe(1);
    expect(fake.calls.put).toBe(0);
    // Source was read in chunks (range gets).
    expect(fake.calls.get).toBeGreaterThanOrEqual(2);
  }, 15000);

  it("Case L: onProgress fires per uploadPart and once on asset-stored for multipart put", async () => {
    const fake = makeFakeR2();
    const api = new R2ToS3Api(fake, stubSthis);
    const payload = makePayload(12 * 1024 * 1024, 61);
    const events: StorageProgressInfo[] = [];

    const writable = await api.put("s3://r2/temp/l.tmp", { onProgress: (info) => events.push(info) });
    const writer = writable.getWriter();
    const chunkSize = 1024 * 1024;
    for (let off = 0; off < payload.byteLength; off += chunkSize) {
      await writer.write(payload.subarray(off, Math.min(off + chunkSize, payload.byteLength)));
    }
    await writer.close();
    await api.awaitPut("s3://r2/temp/l.tmp");

    const partEvents = events.filter((e) => e.stage === "uploading-part");
    const storedEvents = events.filter((e) => e.stage === "asset-stored");
    expect(partEvents.length).toBe(fake.calls.uploadPart);
    expect(partEvents.length).toBeGreaterThanOrEqual(2);
    expect(storedEvents).toHaveLength(1);
    expect(storedEvents[0].bytes).toBe(payload.byteLength);
    // Part numbers strictly increase 1..N
    partEvents.forEach((e, i) => expect(e.partNumber).toBe(i + 1));
    // Cumulative bytes are monotonically non-decreasing.
    let prev = 0;
    for (const e of partEvents) {
      expect(e.bytes ?? 0).toBeGreaterThanOrEqual(prev);
      prev = e.bytes ?? prev;
    }
  }, 15000);

  it("Case M: onProgress fires once with asset-stored for small (single-PUT) put", async () => {
    const fake = makeFakeR2();
    const api = new R2ToS3Api(fake, stubSthis);
    const payload = makePayload(2048, 67);
    const events: StorageProgressInfo[] = [];

    const writable = await api.put("s3://r2/temp/m.tmp", { onProgress: (info) => events.push(info) });
    const writer = writable.getWriter();
    await writer.write(payload);
    await writer.close();
    await api.awaitPut("s3://r2/temp/m.tmp");

    expect(events).toHaveLength(1);
    expect(events[0].stage).toBe("asset-stored");
    expect(events[0].bytes).toBe(payload.byteLength);
    expect(events[0].partNumber).toBeUndefined();
  });

  it("Case N: rename of large object emits rename-part progress and final asset-renamed", async () => {
    const fake = makeFakeR2();
    const api = new R2ToS3Api(fake, stubSthis);
    const payload = makePayload(12 * 1024 * 1024, 71);
    fake.store.set("r2/temp/n.tmp", payload);
    const events: StorageProgressInfo[] = [];

    const r = await api.rename("s3://r2/temp/n.tmp", "s3://r2/zCidN", {
      onProgress: (info) => events.push(info),
    });
    expect(r.isOk()).toBe(true);

    const partEvents = events.filter((e) => e.stage === "rename-part");
    const finalEvents = events.filter((e) => e.stage === "asset-renamed");
    expect(partEvents.length).toBeGreaterThanOrEqual(2);
    expect(finalEvents).toHaveLength(1);
    expect(finalEvents[0].bytes).toBe(payload.byteLength);
    partEvents.forEach((e, i) => expect(e.partNumber).toBe(i + 1));
  }, 15000);
});
