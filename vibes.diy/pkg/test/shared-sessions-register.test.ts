// Unit test: SharedSessions→UserNotify registration payload uses `shared:` prefix.
//
// `userNotifyCallbacksForSharedSessions` (shared-sessions.ts) registers with
// UserNotify under `shared:${shard}` so fan-out routing resolves back to
// SHARED_SESSIONS via resolveShardDO rather than to CHAT_SESSIONS.  This test
// asserts the exact POST bodies for register / deregister and verifies that a
// shard not owned by the authenticated userId does NOT issue any fetch (the
// bounded-registration guard that mirrors how ChatSessions gates registration).

import { describe, expect, it, vi } from "vitest";
import { userNotifyCallbacksForSharedSessions } from "../workers/shared-sessions.js";
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

    await cbs.registerUserSubscription!(userId);

    expect(capturedBodies).toHaveLength(1);
    expect(capturedBodies[0]).toEqual({ action: "register", shardId: expectedShardId });
  });

  it("deregisterUserSubscription posts { action: deregister, shardId: shared:<shard> }", async () => {
    const { env, capturedBodies } = buildFakeEnv();
    const cbs = userNotifyCallbacksForSharedSessions(shard, env);

    await cbs.deregisterUserSubscription!(userId);

    expect(capturedBodies).toHaveLength(1);
    expect(capturedBodies[0]).toEqual({ action: "deregister", shardId: expectedShardId });
  });

  it("does NOT fetch when the shard does not match the authenticated userId (bounded-registration guard)", async () => {
    const { env, fakeStub } = buildFakeEnv();
    // shard is built for userId="user_x" but we call with userId="user_y" — mismatch
    const cbs = userNotifyCallbacksForSharedSessions(shard, env);

    await cbs.registerUserSubscription!("user_y");
    await cbs.deregisterUserSubscription!("user_y");

    expect(fakeStub.fetch).not.toHaveBeenCalled();
  });

  it("returns empty object (no callbacks) for a non-notify shard (random UUID)", async () => {
    const { env } = buildFakeEnv();
    const cbs = userNotifyCallbacksForSharedSessions("550e8400-e29b-41d4-a716-446655440000", env);

    // The guard at the top of the function returns {} for non-notify shards.
    expect(cbs).toEqual({});
    expect(cbs.registerUserSubscription).toBeUndefined();
  });
});
