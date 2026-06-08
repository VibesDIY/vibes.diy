import { describe, expect, it } from "vitest";
import { resolveShardDO } from "../../pkg/workers/resolve-shard-do.js";
import type { CFEnv } from "@vibes.diy/api-types";

const APP_SESSIONS = { sentinel: "APP_SESSIONS" } as unknown as CFEnv["APP_SESSIONS"];
const CHAT_SESSIONS = { sentinel: "CHAT_SESSIONS" } as unknown as CFEnv["CHAT_SESSIONS"];

const env = { APP_SESSIONS, CHAT_SESSIONS } as unknown as CFEnv;

describe("resolveShardDO", () => {
  it("app:foo → APP_SESSIONS with name 'foo'", () => {
    const result = resolveShardDO("app:foo", env);
    expect(result.ns).toBe(APP_SESSIONS);
    expect(result.name).toBe("foo");
  });

  it("foo (no prefix) → CHAT_SESSIONS with name 'foo'", () => {
    const result = resolveShardDO("foo", env);
    expect(result.ns).toBe(CHAT_SESSIONS);
    expect(result.name).toBe("foo");
  });

  it("foo:bar (unknown prefix) → CHAT_SESSIONS with full input as name", () => {
    const result = resolveShardDO("foo:bar", env);
    expect(result.ns).toBe(CHAT_SESSIONS);
    expect(result.name).toBe("foo:bar");
  });

  it("app:foo:bar → APP_SESSIONS with name 'foo:bar' (only first colon is delimiter)", () => {
    const result = resolveShardDO("app:foo:bar", env);
    expect(result.ns).toBe(APP_SESSIONS);
    expect(result.name).toBe("foo:bar");
  });

  it("app: (empty suffix) → APP_SESSIONS with empty name", () => {
    const result = resolveShardDO("app:", env);
    expect(result.ns).toBe(APP_SESSIONS);
    expect(result.name).toBe("");
  });
});
