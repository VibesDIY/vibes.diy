import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { decorateFiles, type FileCtx, type DocFileMeta } from "../../vibe/runtime/firefly-files-read.js";

const ctx: FileCtx = {
  baseUrl: "https://vibes.example.com/api",
  userSlug: "alice",
  appSlug: "todo",
  dbName: "default",
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function metaEntry(overrides: Partial<DocFileMeta> = {}): DocFileMeta {
  return {
    cid: "bafyfakecid",
    type: "text/plain",
    size: 5,
    lastModified: 1700000000000,
    ...overrides,
  };
}

describe("decorateFiles passthrough", () => {
  it("returns doc unchanged when _files is absent", () => {
    const doc = { _id: "x", title: "hello" };
    const out = decorateFiles(doc, ctx);
    expect(out).toBe(doc);
  });

  it("returns doc unchanged when _files is empty", () => {
    const doc = { _id: "x", _files: {} };
    const out = decorateFiles(doc, ctx);
    expect(out).toBe(doc);
  });

  it("does not mutate the input doc", () => {
    const original = metaEntry();
    const files = { hello: original };
    const doc = { _id: "x", _files: files };
    const out = decorateFiles(doc, ctx);
    // Original entry untouched.
    expect(original.url).toBeUndefined();
    expect(original.file).toBeUndefined();
    expect(files.hello).toBe(original);
    // Returned doc has a new _files object with a new entry.
    expect(out).not.toBe(doc);
    expect((out as typeof doc)._files).not.toBe(files);
    expect((out as typeof doc)._files.hello).not.toBe(original);
  });
});

describe("decorateFiles single file", () => {
  it("populates url with correct shape", () => {
    const doc = { _files: { hello: metaEntry({ cid: "cid-abc", type: "text/plain" }) } };
    const out = decorateFiles(doc, ctx);
    const entry = out._files.hello;
    expect(entry.url).toBe("https://vibes.example.com/api/files/alice/todo/default/cid-abc?mime=text%2Fplain");
  });

  it("file() returns a File whose bytes match the fetched response", async () => {
    const bytes = new TextEncoder().encode("hello world");
    const blob = new Blob([bytes], { type: "text/plain" });
    fetchMock.mockResolvedValue({
      blob: () => Promise.resolve(blob),
    });

    const doc = {
      _files: {
        greeting: metaEntry({
          cid: "cid-greet",
          type: "text/plain",
          lastModified: 1700000000000,
        }),
      },
    };
    const out = decorateFiles(doc, ctx);
    const entry = out._files.greeting;

    const file = await entry.file!();
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("cid-greet");
    expect(file.type).toBe("text/plain");
    expect(file.lastModified).toBe(1700000000000);
    expect(await file.text()).toBe("hello world");

    // fetch was called against the populated url.
    expect(fetchMock).toHaveBeenCalledWith(entry.url);
  });

  it("file() round-trips arbitrary bytes via arrayBuffer", async () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 250, 251, 252, 253]);
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    fetchMock.mockResolvedValue({ blob: () => Promise.resolve(blob) });

    const doc = {
      _files: {
        bin: metaEntry({ cid: "cid-bin", type: "application/octet-stream", size: bytes.byteLength }),
      },
    };
    const out = decorateFiles(doc, ctx);
    const file = await out._files.bin.file!();
    const buf = new Uint8Array(await file.arrayBuffer());
    expect(Array.from(buf)).toEqual(Array.from(bytes));
  });
});

describe("decorateFiles multi-file", () => {
  it("decorates every entry", () => {
    const doc = {
      _files: {
        a: metaEntry({ cid: "cid-a", type: "image/png" }),
        b: metaEntry({ cid: "cid-b", type: "image/jpeg" }),
      },
    };
    const out = decorateFiles(doc, ctx);
    expect(out._files.a.url).toBe("https://vibes.example.com/api/files/alice/todo/default/cid-a?mime=image%2Fpng");
    expect(out._files.b.url).toBe("https://vibes.example.com/api/files/alice/todo/default/cid-b?mime=image%2Fjpeg");
    expect(typeof out._files.a.file).toBe("function");
    expect(typeof out._files.b.file).toBe("function");
  });
});

describe("decorateFiles mime encoding", () => {
  it("encodes image/svg+xml safely", () => {
    const doc = { _files: { x: metaEntry({ cid: "cid-svg", type: "image/svg+xml" }) } };
    const out = decorateFiles(doc, ctx);
    expect(out._files.x.url).toBe("https://vibes.example.com/api/files/alice/todo/default/cid-svg?mime=image%2Fsvg%2Bxml");
  });

  it("encodes application/json; charset=utf-8 safely", () => {
    const doc = {
      _files: {
        x: metaEntry({ cid: "cid-json", type: "application/json; charset=utf-8" }),
      },
    };
    const out = decorateFiles(doc, ctx);
    expect(out._files.x.url).toBe(
      "https://vibes.example.com/api/files/alice/todo/default/cid-json?mime=application%2Fjson%3B%20charset%3Dutf-8"
    );
  });
});

describe("decorateFiles idempotence", () => {
  it("re-decorating an already-decorated doc yields an equivalent url", () => {
    const doc = { _files: { hello: metaEntry({ cid: "cid-abc", type: "text/plain" }) } };
    const once = decorateFiles(doc, ctx);
    const twice = decorateFiles(once, ctx);
    expect(twice._files.hello.url).toBe(once._files.hello.url);
    expect(typeof twice._files.hello.file).toBe("function");
  });
});
