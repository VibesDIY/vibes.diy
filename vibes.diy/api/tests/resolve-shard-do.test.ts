import { describe, expect, it } from "vitest";
import { resolveShardDO } from "../../pkg/workers/resolve-shard-do.js";
import type { CFEnv } from "@vibes.diy/api-types";

// #2714 Spec B — the planes collapsed into one class "Sessions". UserNotify
// fan-out routes `app:`/`shared:` registrations to SESSIONS and bare ids to
// CODEGEN_SESSIONS (mirroring app.ts's plane→binding routing).
const SESSIONS = { sentinel: "SESSIONS" } as unknown as CFEnv["SESSIONS"];
const CODEGEN_SESSIONS = { sentinel: "CODEGEN_SESSIONS" } as unknown as CFEnv["CODEGEN_SESSIONS"];

const env = { SESSIONS, CODEGEN_SESSIONS } as unknown as CFEnv;

describe("resolveShardDO", () => {
  it("app:foo → SESSIONS with name 'foo'", () => {
    const result = resolveShardDO("app:foo", env);
    expect(result.ns).toBe(SESSIONS);
    expect(result.name).toBe("foo");
  });

  it("foo (no prefix) → CODEGEN_SESSIONS with name 'foo'", () => {
    const result = resolveShardDO("foo", env);
    expect(result.ns).toBe(CODEGEN_SESSIONS);
    expect(result.name).toBe("foo");
  });

  it("foo:bar (unknown prefix) → CODEGEN_SESSIONS with full input as name", () => {
    const result = resolveShardDO("foo:bar", env);
    expect(result.ns).toBe(CODEGEN_SESSIONS);
    expect(result.name).toBe("foo:bar");
  });

  it("app:foo:bar → SESSIONS with name 'foo:bar' (only first colon is delimiter)", () => {
    const result = resolveShardDO("app:foo:bar", env);
    expect(result.ns).toBe(SESSIONS);
    expect(result.name).toBe("foo:bar");
  });

  it("app: (empty suffix) → SESSIONS with empty name", () => {
    const result = resolveShardDO("app:", env);
    expect(result.ns).toBe(SESSIONS);
    expect(result.name).toBe("");
  });

  it("shared:foo → SESSIONS with name 'foo'", () => {
    const result = resolveShardDO("shared:foo", env);
    expect(result.ns).toBe(SESSIONS);
    expect(result.name).toBe("foo");
  });

  it("shared:notify-user-abc → SESSIONS with the user shard name", () => {
    const result = resolveShardDO("shared:notify-user-abc", env);
    expect(result.ns).toBe(SESSIONS);
    expect(result.name).toBe("notify-user-abc");
  });
});
