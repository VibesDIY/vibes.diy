import type { ReqRegisterHandle, ResRegisterHandle } from "@vibes.diy/api-types";
import {
  runRegisterHandle,
  type RegisterHandleApi,
  type RegisterHandleDeps,
  type RegisterHandleResultLike,
} from "../../pkg/commands/handle-register.js";
import { assertContains, assertTrue, captureOutput } from "./test-helpers.js";

function okRes(userSlug: string): ResRegisterHandle {
  return {
    type: "vibes.diy.res-register-handle",
    userId: "user_123",
    userSlug,
    created: "2026-03-10T12:00:00.000Z",
  };
}

function depsWithRegister(
  registerHandle: RegisterHandleApi["registerHandle"]
): RegisterHandleDeps {
  return {
    api: {
      registerHandle,
    },
  };
}

function okResult(data: ResRegisterHandle): RegisterHandleResultLike {
  return {
    isErr(): boolean {
      return false;
    },
    Err(): unknown {
      return undefined;
    },
    Ok(): ResRegisterHandle {
      return data;
    },
  };
}

function errResult(message: string): RegisterHandleResultLike {
  return {
    isErr(): boolean {
      return true;
    },
    Err(): unknown {
      return { message };
    },
    Ok(): ResRegisterHandle {
      throw new Error("unexpected Ok() on error result");
    },
  };
}

Deno.test("runRegisterHandle: auto-registers when slug is omitted", async function (): Promise<void> {
  const captured = captureOutput();
  const deps = depsWithRegister(function register(
    req: Omit<ReqRegisterHandle, "type" | "auth">
  ): Promise<RegisterHandleResultLike> {
    assertTrue(typeof req.userSlug === "undefined", "userSlug should be omitted when not provided");
    return Promise.resolve(okResult(okRes("fresh-river-stone")));
  });

  const result = await runRegisterHandle({}, captured.output, deps);
  assertTrue(result.isOk(), "register should succeed");
  assertContains(captured.stdout(), "@fresh-river-stone", "output should include registered handle");
});

Deno.test("runRegisterHandle: strips @ prefix before sending", async function (): Promise<void> {
  const captured = captureOutput();
  const deps = depsWithRegister(function register(
    req: Omit<ReqRegisterHandle, "type" | "auth">
  ): Promise<RegisterHandleResultLike> {
    assertTrue(req.userSlug === "jchris", "slug should be normalized without @");
    return Promise.resolve(okResult(okRes("jchris")));
  });

  const result = await runRegisterHandle({ slug: "@jchris" }, captured.output, deps);
  assertTrue(result.isOk(), "register should succeed");
  assertContains(captured.stdout(), "@jchris", "output should print normalized handle");
});

Deno.test("runRegisterHandle: rejects empty slug before API call", async function (): Promise<void> {
  const captured = captureOutput();
  const deps = depsWithRegister(function register(
    _req: Omit<ReqRegisterHandle, "type" | "auth">
  ): Promise<RegisterHandleResultLike> {
    return Promise.resolve(okResult(okRes("should-not-run")));
  });

  const result = await runRegisterHandle({ slug: "   " }, captured.output, deps);
  assertTrue(result.isErr(), "empty slug should fail");
  assertContains(String(result.Err()), "must not be empty", "empty slug error should be explicit");
});

Deno.test("runRegisterHandle: surfaces API errors", async function (): Promise<void> {
  const captured = captureOutput();
  const deps = depsWithRegister(function register(
    _req: Omit<ReqRegisterHandle, "type" | "auth">
  ): Promise<RegisterHandleResultLike> {
    return Promise.resolve(errResult("Not logged in. Run: use-vibes login"));
  });

  const result = await runRegisterHandle({ slug: "alice" }, captured.output, deps);
  assertTrue(result.isErr(), "auth error should fail");
  assertContains(String(result.Err()), "use-vibes login", "error should mention login");
});
