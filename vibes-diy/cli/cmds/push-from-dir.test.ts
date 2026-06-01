import { mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";
import { Result } from "@adviser/cement";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pushFromDir } from "./push-from-dir.js";
import type { PushFromDirOptions } from "./push-from-dir.js";

const tempDirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join("/tmp", "push-test-"));
  tempDirs.push(dir);
  await writeFile(join(dir, "App.jsx"), "export default function App() { return <div>Hello</div>; }");
  return dir;
}

function makeMockCtx() {
  return {
    send: {
      send: vi.fn().mockResolvedValue(Result.Ok(undefined)),
    },
    ctx: { getOrThrow: vi.fn() },
    validated: {},
    enRequest: {},
    request: {},
  } as unknown as PushFromDirOptions["ctx"];
}

function makeMockApi() {
  const ensureAppSlug = vi.fn().mockResolvedValue(
    Result.Ok({
      type: "vibes.diy.res-ensure-app-slug",
      fsId: "fs-123",
      ownerHandle: "testuser",
      appSlug: "test-app",
      mode: "production",
      env: {},
      fileSystem: [],
    })
  );
  const ensureAppSettings = vi.fn().mockResolvedValue(
    Result.Ok({
      settings: {
        entry: {
          enableRequest: { autoAcceptRole: "editor" },
          publicAccess: { enable: true },
        },
      },
    })
  );
  return { ensureAppSlug, ensureAppSettings };
}

describe("pushFromDir — fast path defaults", () => {
  it("enables public access and auto-accept-editor by default", async () => {
    const dir = await makeTempDir();
    const api = makeMockApi();
    const ctx = makeMockCtx();

    const result = await pushFromDir({
      dir,
      mode: "production",
      appSlug: "test-app",
      ownerHandle: "testuser",
      apiUrl: "https://vibes.diy/api",
      api,
      ctx,
    });

    expect(result.isErr()).toBe(false);

    // Should make two ensureAppSettings calls: request + publicAccess
    expect(api.ensureAppSettings).toHaveBeenCalledTimes(2);

    const [requestCall, publicCall] = api.ensureAppSettings.mock.calls;
    expect(requestCall[0]).toMatchObject({
      appSlug: "test-app",
      ownerHandle: "testuser",
      request: { enable: true, autoAcceptRole: "editor" },
    });
    expect(publicCall[0]).toMatchObject({
      appSlug: "test-app",
      ownerHandle: "testuser",
      publicAccess: { enable: true },
    });
  });

  it("skips public access and auto-accept when --private is set", async () => {
    const dir = await makeTempDir();
    const api = makeMockApi();
    const ctx = makeMockCtx();

    await pushFromDir({
      dir,
      mode: "production",
      appSlug: "test-app",
      ownerHandle: "testuser",
      private: true,
      apiUrl: "https://vibes.diy/api",
      api,
      ctx,
    });

    // Should still enable requests, but without autoAcceptRole
    expect(api.ensureAppSettings).toHaveBeenCalledTimes(1);
    expect(api.ensureAppSettings.mock.calls[0][0]).toMatchObject({
      request: { enable: true, autoAcceptRole: undefined },
    });
    // publicAccess call must NOT happen
    expect(api.ensureAppSettings.mock.calls.every((c: unknown[]) => !("publicAccess" in (c[0] as object)))).toBe(true);
  });

  it("skips all settings calls when ownerHandle is not set", async () => {
    const dir = await makeTempDir();
    const api = makeMockApi();
    const ctx = makeMockCtx();

    await pushFromDir({
      dir,
      mode: "production",
      appSlug: "test-app",
      ownerHandle: undefined,
      apiUrl: "https://vibes.diy/api",
      api,
      ctx,
    });

    expect(api.ensureAppSettings).not.toHaveBeenCalled();
  });
});
