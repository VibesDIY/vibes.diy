import type { ReqListUserSlugAppSlug, ResListUserSlugAppSlug } from "@vibes.diy/api-types";
import {
  runWhoami,
  type WhoamiApi,
  type WhoamiDeps,
  type WhoamiDeviceInfo,
  type WhoamiListResultLike,
} from "../../pkg/commands/whoami.js";
import { assertContains, assertTrue, captureOutput } from "./test-helpers.js";

const testDeviceInfo: WhoamiDeviceInfo = {
  fingerprint: "test-fingerprint-abc123",
  certExpiry: new Date("2027-03-10T18:39:22.000Z"),
};

function okResult(data: ResListUserSlugAppSlug): WhoamiListResultLike {
  return {
    isErr(): boolean {
      return false;
    },
    Err(): unknown {
      return undefined;
    },
    Ok(): ResListUserSlugAppSlug {
      return data;
    },
  };
}

function errResult(err: unknown): WhoamiListResultLike {
  return {
    isErr(): boolean {
      return true;
    },
    Err(): unknown {
      return err;
    },
    Ok(): ResListUserSlugAppSlug {
      throw new Error("unexpected Ok() on error result");
    },
  };
}

function stubApi(
  listFn: (req: Omit<ReqListUserSlugAppSlug, "type" | "auth">) => Promise<WhoamiListResultLike>
): WhoamiApi {
  return { listUserSlugAppSlug: listFn };
}

function depsWithHandles(items: Array<{ userSlug: string; userId: string; appSlugs: string[] }>): WhoamiDeps {
  return {
    deviceInfo: testDeviceInfo,
    api: stubApi(() =>
      Promise.resolve(
        okResult({
          type: "vibes.diy.res-list-user-slug-app-slug",
          items,
        })
      )
    ),
  };
}

Deno.test("whoami: prints handles from API", async function (): Promise<void> {
  const captured = captureOutput();
  const deps = depsWithHandles([
    { userSlug: "jchris", userId: "user_1", appSlugs: [] },
    { userSlug: "jchris-bot", userId: "user_1", appSlugs: [] },
  ]);

  const result = await runWhoami(captured.output, deps);
  assertTrue(result.isOk(), "whoami should succeed");

  const out = captured.stdout();
  assertContains(out, "Handle: @jchris\n", "should print first handle");
  assertContains(out, "Handle: @jchris-bot\n", "should print second handle");
  assertContains(out, "Device: test-fingerprint-abc123\n", "should print device");
  assertContains(out, "Certificate: valid until", "should print cert");

  // Verify order: handles before device
  const handleIdx = out.indexOf("Handle:");
  const deviceIdx = out.indexOf("Device:");
  assertTrue(handleIdx < deviceIdx, "handles should appear before device info");
});

Deno.test("whoami: prints warning when API is unreachable", async function (): Promise<void> {
  const captured = captureOutput();
  const deps: WhoamiDeps = {
    deviceInfo: testDeviceInfo,
    api: stubApi(() => Promise.resolve(errResult({ message: "connection refused" }))),
  };

  const result = await runWhoami(captured.output, deps);
  assertTrue(result.isOk(), "whoami should still succeed (API failure is non-fatal)");
  assertContains(captured.stderr(), "Could not reach API", "should warn about API");
  assertContains(captured.stdout(), "Device:", "should still show device");
  assertContains(captured.stdout(), "Certificate:", "should still show cert");
});

Deno.test("whoami: prints session-expired when API returns require-login", async function (): Promise<void> {
  const captured = captureOutput();
  const deps: WhoamiDeps = {
    deviceInfo: testDeviceInfo,
    api: stubApi(() =>
      Promise.resolve(
        errResult({
          type: "vibes.diy.error",
          code: "require-login",
          message: "Not authenticated",
        })
      )
    ),
  };

  const result = await runWhoami(captured.output, deps);
  assertTrue(result.isOk(), "whoami should still succeed (API failure is non-fatal)");
  assertContains(captured.stderr(), "Session expired", "should mention session expired");
  assertContains(captured.stdout(), "Device:", "should still show device");
});

Deno.test("whoami: prints 'no handles' when API returns empty", async function (): Promise<void> {
  const captured = captureOutput();
  const deps = depsWithHandles([]);

  const result = await runWhoami(captured.output, deps);
  assertTrue(result.isOk(), "whoami should succeed");
  assertContains(captured.stdout(), "No handles linked", "should say no handles");
  assertContains(captured.stdout(), "Device:", "should still show device");
});
