import { describe, expect, it } from "vitest";
import { resolveShardDO } from "../../pkg/workers/resolve-shard-do.js";
import type { CFEnv } from "@vibes.diy/api-types";

// #2714 Spec B — the planes collapsed into one class "Sessions", addressed via
// two handles that share a namespace on non-cli envs. The PHYSICAL DO name is
// plane-prefixed so instances never collide across planes; resolveShardDO maps a
// registered shardId to that exact physical name (the name app.ts opens).
const SESSIONS = { sentinel: "SESSIONS" } as unknown as CFEnv["SESSIONS"];
const CODEGEN_SESSIONS = { sentinel: "CODEGEN_SESSIONS" } as unknown as CFEnv["CODEGEN_SESSIONS"];

const env = { SESSIONS, CODEGEN_SESSIONS } as unknown as CFEnv;

describe("resolveShardDO", () => {
  it("app:foo → SESSIONS, physical name 'app:foo' (full, matches app.ts)", () => {
    const result = resolveShardDO("app:foo", env);
    expect(result.ns).toBe(SESSIONS);
    expect(result.name).toBe("app:foo");
  });

  it("foo (bare codegen) → CODEGEN_SESSIONS, physical name 'codegen:foo'", () => {
    const result = resolveShardDO("foo", env);
    expect(result.ns).toBe(CODEGEN_SESSIONS);
    expect(result.name).toBe("codegen:foo");
  });

  it("foo:bar (unknown prefix) → CODEGEN_SESSIONS, physical name 'codegen:foo:bar'", () => {
    const result = resolveShardDO("foo:bar", env);
    expect(result.ns).toBe(CODEGEN_SESSIONS);
    expect(result.name).toBe("codegen:foo:bar");
  });

  it("app:foo:bar (known prefix, multi-colon suffix) → SESSIONS, full name kept intact", () => {
    // Only the FIRST colon delimits the prefix; the remaining `foo:bar` stays in
    // the physical name verbatim, matching the string app.ts feeds idFromName.
    const result = resolveShardDO("app:foo:bar", env);
    expect(result.ns).toBe(SESSIONS);
    expect(result.name).toBe("app:foo:bar");
  });

  it("app: (known prefix, empty suffix) → SESSIONS, physical name 'app:'", () => {
    // Empty suffix still resolves on the prefix binding — the full id (trailing
    // colon and all) is the physical name, so it can't collide with a bare
    // codegen `app` registration (which would resolve to 'codegen:app').
    const result = resolveShardDO("app:", env);
    expect(result.ns).toBe(SESSIONS);
    expect(result.name).toBe("app:");
  });

  it("app:foo--bar → SESSIONS with the full vibe-keyed physical name", () => {
    const result = resolveShardDO("app:foo--bar", env);
    expect(result.ns).toBe(SESSIONS);
    expect(result.name).toBe("app:foo--bar");
  });

  it("shared:foo → SESSIONS, physical name 'shared:foo'", () => {
    const result = resolveShardDO("shared:foo", env);
    expect(result.ns).toBe(SESSIONS);
    expect(result.name).toBe("shared:foo");
  });

  it("shared:notify-user-abc → SESSIONS with the full shared physical name", () => {
    const result = resolveShardDO("shared:notify-user-abc", env);
    expect(result.ns).toBe(SESSIONS);
    expect(result.name).toBe("shared:notify-user-abc");
  });

  it("bare notify-user-abc → CODEGEN_SESSIONS as 'codegen:notify-user-abc'", () => {
    const result = resolveShardDO("notify-user-abc", env);
    expect(result.ns).toBe(CODEGEN_SESSIONS);
    expect(result.name).toBe("codegen:notify-user-abc");
  });

  // Cross-plane collision guard: the same logical user shard registered on the
  // shared plane vs the codegen plane must resolve to DISTINCT physical names,
  // so they never co-tenant one instance even when the bindings share a class.
  it("shared vs codegen for the same user shard → distinct physical names", () => {
    const shared = resolveShardDO("shared:notify-user-x", env);
    const codegen = resolveShardDO("notify-user-x", env);
    expect(shared.name).not.toBe(codegen.name);
  });
});
