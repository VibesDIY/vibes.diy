import { describe, expect, it } from "vitest";
import { Future, Result } from "@adviser/cement";
import { uploadFiles, type AssetUploader, type UploadResult } from "../../vibe/runtime/firefly-files-write.js";

// Phase 7 test surface: pure function with injected uploader. No
// postMessage / fetch / globals. Per agents/rules-bag.md: dependency
// injection, not mocking.

interface FakeCall {
  readonly key: string;
  readonly mimeType?: string;
  readonly blobType: string;
  readonly size: number;
}

function fakeUploader(opts: {
  results?: (call: FakeCall) => Result<UploadResult>;
  hold?: Map<string, Future<Result<UploadResult>>>;
}): { uploader: AssetUploader; calls: FakeCall[]; inFlight: { current: number; peak: number } } {
  const calls: FakeCall[] = [];
  const inFlight = { current: 0, peak: 0 };
  let nextKey = 0;
  const uploader: AssetUploader = {
    async putAsset(blob, mimeType) {
      const key = `call-${nextKey++}`;
      const call: FakeCall = { key, blobType: blob.type, size: blob.size, ...(mimeType ? { mimeType } : {}) };
      calls.push(call);
      inFlight.current++;
      inFlight.peak = Math.max(inFlight.peak, inFlight.current);
      try {
        if (opts.hold?.has(call.blobType)) {
          // Hold release tied to the file's blob type so tests can stage
          // the order of completion.
          const r = await opts.hold.get(call.blobType)?.asPromise();
          return r ?? Result.Err<UploadResult>("no result");
        }
        if (opts.results) return opts.results(call);
        return Result.Ok<UploadResult>({
          status: "ok",
          cid: `cid-${call.size}-${call.blobType}`,
          getURL: `s3://r2/cid-${call.size}`,
          size: call.size,
          uploadId: `upl-${call.size}-${call.blobType}`,
        });
      } finally {
        inFlight.current--;
      }
    },
  };
  return { uploader, calls, inFlight };
}

describe("uploadFiles — Firefly write helper", () => {
  it("returns input unchanged when _files is absent", async () => {
    const { uploader, calls } = fakeUploader({});
    const doc = { _id: "x", title: "no files" };
    expect(await uploadFiles(doc, uploader)).toEqual(doc);
    expect(calls).toHaveLength(0);
  });

  it("returns input unchanged when _files is empty", async () => {
    const { uploader, calls } = fakeUploader({});
    const doc = { _id: "x", _files: {} };
    expect(await uploadFiles(doc, uploader)).toEqual(doc);
    expect(calls).toHaveLength(0);
  });

  it("replaces a File entry with {uploadId, type, size, lastModified}", async () => {
    const { uploader, calls } = fakeUploader({});
    const file = new File(["hello"], "hello.txt", { type: "text/plain", lastModified: 1700000000 });
    const doc = { _id: "x", _files: { photo: file } };
    const out = (await uploadFiles(doc, uploader)) as { _files: Record<string, unknown> };
    expect(calls).toHaveLength(1);
    expect(calls[0].mimeType).toBe("text/plain");
    expect(out._files.photo).toMatchObject({
      uploadId: expect.any(String),
      type: "text/plain",
      size: 5,
      lastModified: 1700000000,
    });
  });

  it("replaces a Blob entry but omits lastModified (Blob has no lastModified)", async () => {
    const { uploader } = fakeUploader({});
    const blob = new Blob(["hi"], { type: "image/png" });
    const out = (await uploadFiles({ _files: { photo: blob } }, uploader)) as { _files: Record<string, unknown> };
    const meta = out._files.photo as Record<string, unknown>;
    expect(meta.uploadId).toEqual(expect.any(String));
    expect(meta.type).toBe("image/png");
    expect(meta.size).toBe(2);
    expect(meta.lastModified).toBeUndefined();
  });

  it("idempotent — entries already in {uploadId,...} shape pass through", async () => {
    const { uploader, calls } = fakeUploader({});
    const meta = { uploadId: "upl-existing", type: "text/plain", size: 4, lastModified: 1700000001 };
    const out = (await uploadFiles({ _files: { photo: meta } }, uploader)) as { _files: Record<string, unknown> };
    expect(out._files.photo).toBe(meta);
    expect(calls).toHaveLength(0);
  });

  it("handles mixed entries — uploads the Files, passes through pre-shaped entries", async () => {
    const { uploader, calls } = fakeUploader({});
    const newFile = new File(["new"], "new.txt", { type: "text/plain" });
    const existing = { uploadId: "upl-existing", type: "image/jpeg", size: 999 };
    const out = (await uploadFiles({ _files: { fresh: newFile, kept: existing } }, uploader)) as {
      _files: Record<string, unknown>;
    };
    expect(calls).toHaveLength(1);
    expect((out._files.fresh as { uploadId: string }).uploadId).toEqual(expect.any(String));
    expect(out._files.kept).toBe(existing);
  });

  it("preserves _files key order regardless of completion order", async () => {
    // Hold "image/a" so it finishes after "image/b" even though "image/a"
    // started first.
    const aFuture = new Future<Result<UploadResult>>();
    const bFuture = new Future<Result<UploadResult>>();
    const hold = new Map<string, Future<Result<UploadResult>>>([
      ["image/a", aFuture],
      ["image/b", bFuture],
    ]);
    const { uploader } = fakeUploader({ hold });

    const doc = {
      _files: {
        first: new File(["a"], "a.png", { type: "image/a" }),
        second: new File(["b"], "b.png", { type: "image/b" }),
      },
    };
    const promise = uploadFiles(doc, uploader);
    // b completes first
    bFuture.resolve(Result.Ok({ status: "ok", cid: "cb", getURL: "s3://r2/cb", size: 1, uploadId: "upl-b" }));
    aFuture.resolve(Result.Ok({ status: "ok", cid: "ca", getURL: "s3://r2/ca", size: 1, uploadId: "upl-a" }));
    const out = (await promise) as { _files: Record<string, unknown> };
    expect(Object.keys(out._files)).toEqual(["first", "second"]);
    expect((out._files.first as { uploadId: string }).uploadId).toBe("upl-a");
    expect((out._files.second as { uploadId: string }).uploadId).toBe("upl-b");
  });

  it("throws on uploader error so the put fails atomically", async () => {
    const { uploader } = fakeUploader({
      results: () => Result.Err<UploadResult>("network exploded"),
    });
    const file = new File(["x"], "x.txt", { type: "text/plain" });
    await expect(uploadFiles({ _files: { photo: file } }, uploader)).rejects.toThrow(/network exploded/);
  });

  it("throws when uploader returns ok-Result wrapping an error UploadResult", async () => {
    const { uploader } = fakeUploader({
      results: () => Result.Ok<UploadResult>({ status: "error", message: "grant minting failed" }),
    });
    const file = new File(["x"], "x.txt", { type: "text/plain" });
    await expect(uploadFiles({ _files: { photo: file } }, uploader)).rejects.toThrow(/grant minting failed/);
  });

  it("respects bounded concurrency (default 3)", async () => {
    // 5 files, all held until released. Watch that peak in-flight ≤ 3.
    const futures: Future<Result<UploadResult>>[] = Array.from({ length: 5 }, () => new Future<Result<UploadResult>>());
    const hold = new Map<string, Future<Result<UploadResult>>>(futures.map((f, i) => [`type-${i}`, f] as const));
    const { uploader, inFlight } = fakeUploader({ hold });

    const docFiles = Object.fromEntries(futures.map((_, i) => [`f${i}`, new File([`${i}`], `f${i}.txt`, { type: `type-${i}` })]));
    const promise = uploadFiles({ _files: docFiles }, uploader);
    // Yield enough to let workers start.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(inFlight.peak).toBeLessThanOrEqual(3);
    expect(inFlight.peak).toBeGreaterThan(0);
    // Release all.
    for (let i = 0; i < futures.length; i++) {
      futures[i].resolve(Result.Ok({ status: "ok", cid: `c${i}`, getURL: `s3://r2/c${i}`, size: 1, uploadId: `u${i}` }));
    }
    await promise;
  });

  it("respects custom concurrency = 1 (sequential)", async () => {
    const futures: Future<Result<UploadResult>>[] = Array.from({ length: 4 }, () => new Future<Result<UploadResult>>());
    const hold = new Map<string, Future<Result<UploadResult>>>(futures.map((f, i) => [`one-${i}`, f] as const));
    const { uploader, inFlight } = fakeUploader({ hold });

    const docFiles = Object.fromEntries(futures.map((_, i) => [`g${i}`, new File([`${i}`], `g${i}.txt`, { type: `one-${i}` })]));
    const promise = uploadFiles({ _files: docFiles }, uploader, { concurrency: 1 });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(inFlight.peak).toBe(1);
    for (const f of futures) {
      f.resolve(Result.Ok({ status: "ok", cid: "c", getURL: "s3://r2/c", size: 1, uploadId: "u" }));
      await Promise.resolve();
    }
    await promise;
  });
});
