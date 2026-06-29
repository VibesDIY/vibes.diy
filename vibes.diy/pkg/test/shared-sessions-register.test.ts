// Unit test: SharedSessions→UserNotify registration payload uses `shared:` prefix.
//
// `userNotifyCallbacksForSharedSessions` (shared-sessions.ts) registers with
// UserNotify under `shared:${shard}` so fan-out routing resolves back to
// SHARED_SESSIONS via resolveShardDO rather than to CHAT_SESSIONS.  This test
// asserts the exact POST bodies for register / deregister and verifies that a
// shard not owned by the authenticated userId does NOT issue any fetch (the
// bounded-registration guard that mirrors how ChatSessions gates registration).

import { describe, expect, it, vi } from "vitest";
import { userNotifyCallbacksForSharedSessions } from "../workers/session-callbacks.js";
import { userNotifyShardFor } from "@vibes.diy/api-types";
import type { CFEnv } from "@vibes.diy/api-types";

// Build a minimal CFEnv stub that captures POST bodies sent to USER_NOTIFY.
function buildFakeEnv() {
  const capturedBodies: unknown[] = [];

  const fakeStub = {
    fetch: vi.fn(async (req: Request) => {
      capturedBodies.push(await req.json());
      return new Response("ok", { status: 200 });
    }),
  };

  const fakeNamespace = {
    idFromName: vi.fn((_name: string) => "fake-do-id"),
    get: vi.fn((_id: unknown) => fakeStub),
  };

  const env = {
    USER_NOTIFY: fakeNamespace,
  } as unknown as CFEnv;

  return { env, capturedBodies, fakeNamespace, fakeStub };
}

describe("userNotifyCallbacksForSharedSessions — registration payload", () => {
  const userId = "user_x";
  const shard = userNotifyShardFor(userId);
  const expectedShardId = `shared:${shard}`;

  it("registerUserSubscription posts { action: register, shardId: shared:<shard> }", async () => {
    const { env, capturedBodies } = buildFakeEnv();
    const cbs = userNotifyCallbacksForSharedSessions(shard, env);
    const registerUserSubscription = cbs.registerUserSubscription;

    expect(registerUserSubscription).toBeDefined();
    await registerUserSubscription?.(userId);

    expect(capturedBodies).toHaveLength(1);
    expect(capturedBodies[0]).toEqual({ action: "register", shardId: expectedShardId });
  });

  it("deregisterUserSubscription posts { action: deregister, shardId: shared:<shard> }", async () => {
    const { env, capturedBodies } = buildFakeEnv();
    const cbs = userNotifyCallbacksForSharedSessions(shard, env);
    const deregisterUserSubscription = cbs.deregisterUserSubscription;

    expect(deregisterUserSubscription).toBeDefined();
    await deregisterUserSubscription?.(userId);

    expect(capturedBodies).toHaveLength(1);
    expect(capturedBodies[0]).toEqual({ action: "deregister", shardId: expectedShardId });
  });

  it("does NOT fetch when the shard does not match the authenticated userId (bounded-registration guard)", async () => {
    const { env, fakeStub } = buildFakeEnv();
    // shard is built for userId="user_x" but we call with userId="user_y" — mismatch
    const cbs = userNotifyCallbacksForSharedSessions(shard, env);
    const registerUserSubscription = cbs.registerUserSubscription;
    const deregisterUserSubscription = cbs.deregisterUserSubscription;

    expect(registerUserSubscription).toBeDefined();
    expect(deregisterUserSubscription).toBeDefined();
    await registerUserSubscription?.("user_y");
    await deregisterUserSubscription?.("user_y");

    expect(fakeStub.fetch).not.toHaveBeenCalled();
  });

  it("returns empty object (no callbacks) for a non-notify shard (random UUID)", async () => {
    const { env } = buildFakeEnv();
    const cbs = userNotifyCallbacksForSharedSessions("550e8400-e29b-41d4-a716-446655440000", env);

    // The guard at the top of the function returns {} for non-notify shards.
    expect(cbs).toEqual({});
    expect(cbs.registerUserSubscription).toBeUndefined();
  });

  it("does NOT register a ROLLED codegen-family shard (shared plane stays STRICT equality)", async () => {
    // The codegen plane admits the bounded family (base~1, …) so the client can
    // roll; the shared plane must NOT — it keeps exactly one shard per user. So a
    // `notify-user-<uid>~1` shard, while owned by this user, is rejected here. This
    // is the split that preserves Track B's bounded-subscriber-set on the shared
    // plane. (Security invariants, design spec 2026-06-29.)
    const { env, fakeStub } = buildFakeEnv();
    const rolled = `${shard}~1`;
    const cbs = userNotifyCallbacksForSharedSessions(rolled, env);
    await cbs.registerUserSubscription?.(userId);
    await cbs.deregisterUserSubscription?.(userId);
    expect(fakeStub.fetch).not.toHaveBeenCalled();
  });
});
