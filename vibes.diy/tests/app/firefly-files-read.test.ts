import { describe, expect, it } from "vitest";
import { decorateFiles, type Fetcher } from "../../vibe/runtime/firefly-files-read.js";

describe("decorateFiles — Firefly client shim", () => {
  it("returns input unchanged when _files is absent", () => {
    const doc = { _id: "x", title: "no files" };
    expect(decorateFiles(doc)).toEqual(doc);
  });

  it("returns input unchanged when _files is empty", () => {
    const doc = { _id: "x", _files: {} };
    expect(decorateFiles(doc)).toEqual(doc);
  });

  it("attaches file() shim to each entry without mutating input", () => {
    const original = {
      _id: "doc-1",
      _files: {
        photo: {
          uploadId: "upl-1",
          type: "image/png",
          size: 100,
          lastModified: 1700000000,
          url: "https://app--user.host/_files/db/doc-1/photo?v=upl-1",
        },
      },
    };
    const decorated = decorateFiles(original);
    expect(decorated).not.toBe(original);
    expect(decorated._files).not.toBe(original._files);
    expect(typeof (decorated._files.photo as { file?: unknown }).file).toBe("function");
    // Input is untouched.
    expect((original._files.photo as { file?: unknown }).file).toBeUndefined();
  });

  it("file() shim fetches the URL and returns a File with matching bytes/type", async () => {
    const bytes = "hello-shim";
    const url = "https://app--user.host/_files/db/doc-1/photo?v=upl-2";
    const calls: string[] = [];
    const fetcher: Fetcher = async (input) => {
      calls.push(input);
      return new Response(bytes, { status: 200, headers: { "Content-Type": "text/plain" } });
    };
    const decorated = decorateFiles(
      { _files: { photo: { uploadId: "upl-2", type: "text/plain", size: bytes.length, lastModified: 1700000000, url } } },
      fetcher
    );
    const meta = decorated._files.photo as unknown as { file: () => Promise<File>; type: string; lastModified?: number };
    const file = await meta.file();
    expect(calls).toEqual([url]);
    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe("text/plain");
    expect(file.lastModified).toBe(1700000000);
    expect(await file.text()).toBe(bytes);
  });

  it("file() shim throws on non-OK responses (vs returning a fake file)", async () => {
    const url = "https://app--user.host/_files/db/doc-1/missing?v=upl-3";
    const fetcher: Fetcher = async () => new Response('{"type":"error","message":"Access denied"}', { status: 403 });
    const decorated = decorateFiles({ _files: { secret: { uploadId: "upl-3", type: "text/plain", size: 0, url } } }, fetcher);
    const meta = decorated._files.secret as unknown as { file: () => Promise<File> };
    await expect(meta.file()).rejects.toThrow(/403/);
  });

  it("decorates multi-entry _files independently", () => {
    const decorated = decorateFiles({
      _files: {
        a: { uploadId: "upl-a", type: "text/plain", size: 1, url: "https://h/_files/d/x/a?v=upl-a" },
        b: { uploadId: "upl-b", type: "image/png", size: 2, url: "https://h/_files/d/x/b?v=upl-b" },
      },
    });
    expect(typeof (decorated._files.a as { file?: unknown }).file).toBe("function");
    expect(typeof (decorated._files.b as { file?: unknown }).file).toBe("function");
  });

  it("idempotent — re-decorating yields equivalent shape", () => {
    const url = "https://h/_files/d/x/a?v=upl-id";
    const once = decorateFiles({ _files: { a: { uploadId: "upl-id", type: "text/plain", size: 1, url } } });
    const twice = decorateFiles(once);
    expect(typeof (twice._files.a as { file?: unknown }).file).toBe("function");
    expect((twice._files.a as { url?: string }).url).toBe(url);
  });

  it("leaves entries without a url unchanged", () => {
    const doc = { _files: { malformed: { uploadId: "upl-x", type: "text/plain", size: 1 } } };
    const decorated = decorateFiles(doc);
    expect((decorated._files.malformed as { file?: unknown }).file).toBeUndefined();
  });

  // Stage C left this gap: `meta.file()` does a no-credentials fetch.
  // Cross-origin from the iframe (`<app>--<user>.<env>.vibesdiy.net`) to
  // the asset host (`assets.<env>.vibesdiy.net`) won't carry the
  // vibes-asset-session cookie unless the request is `credentials: "include"`,
  // so private files 401 when fetched via meta.file(). Browsers attach
  // partitioned SameSite=None cookies to <img> subresource loads natively
  // (the cookie still fires for `<img src={meta.url}>`), so this gap is
  // invisible until a vibe author reaches for transcoding/hashing/ML and
  // calls meta.file() directly.
  //
  // Two-part fix:
  //   1. Widen `Fetcher` to `(input, init?: RequestInit) => Promise<Response>`
  //      and have defaultFetcher pass `{ credentials: "include" }`.
  //   2. Read handler at `assets.<base>/_files/...` reflects request Origin
  //      + sets `Access-Control-Allow-Credentials: true` (mirroring what the
  //      bridge endpoints already do) so the credentialed fetch isn't blocked
  //      by CORS.
  //
  // `it.fails` so this passes today (gap exists) and starts failing once the
  // fix lands — forcing whoever closes the gap to flip this back to `it()`.
  it.fails(
    "KNOWN GAP: meta.file() should pass credentials: 'include' so private cross-origin reads attach the cookie",
    async () => {
      const url = "https://assets.example.com/_files/u/a/db/doc-1/photo?v=upl-cred";
      let observedCredentials: RequestCredentials | undefined;
      const widenedFetcher: (input: string, init?: RequestInit) => Promise<Response> = async (_input, init) => {
        observedCredentials = init?.credentials;
        return new Response("ok", { status: 200, headers: { "Content-Type": "text/plain" } });
      };
      const decorated = decorateFiles(
        { _files: { photo: { uploadId: "upl-cred", type: "text/plain", size: 2, url } } },
        widenedFetcher as Fetcher
      );
      const meta = decorated._files.photo as unknown as { file: () => Promise<File> };
      await meta.file();
      expect(observedCredentials).toBe("include");
    }
  );
});
