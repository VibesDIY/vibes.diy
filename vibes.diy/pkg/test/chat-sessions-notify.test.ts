// Unit test: ChatSessions wires the `notifyUser` emitter so codegen-completion
// build notifications actually fire.
//
// prompt-chat-section's `.finally` emits build-complete / build-failed via
// `vctx.notifyUser`. That handler runs on the chat plane (ChatSessions DO), and a
// codegen connection uses a random-UUID shard — NOT a stable notify-user shard. So
// the emitter must be wired UNCONDITIONALLY; gating it on isUserNotifyShard (as the
// receive-side registration is) would leave `vctx.notifyUser` undefined and silently
// drop every build notification. This test pins that contract. (#2265 Track B)

import { describe, expect, it, vi } from "vitest";
import { userNotifyCallbacksForChatSessions } from "../workers/session-callbacks.js";
import { userNotifyShardFor } from "@vibes.diy/api-types";
import type { CFEnv, EvtUserNotification } from "@vibes.diy/api-types";

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
  const env = { USER_NOTIFY: fakeNamespace } as unknown as CFEnv;
  return { env, capturedBodies, fakeStub };
}

const buildCompleteEvt: EvtUserNotification = {
  type: "vibes.diy.evt-user-notification",
  notificationType: "build-complete",
  ownerHandle: "chris-dev",
  appSlug: "birds-brief-half",
};

describe("userNotifyCallbacksForChatSessions — notifyUser emitter", () => {
  const userId = "user_x";
  const randomShard = "550e8400-e29b-41d4-a716-446655440000"; // a codegen connection's shard

  it("wires notifyUser on a random-UUID codegen shard (build emission path)", async () => {
    const { env, capturedBodies } = buildFakeEnv();
    const cbs = userNotifyCallbacksForChatSessions(randomShard, env);

    // The emitter must exist even though this shard is not a notify-user shard —
    // this is the connection codegen actually finishes on.
    expect(cbs.notifyUser).toBeDefined();
    await cbs.notifyUser?.(userId, buildCompleteEvt, "sender-conn-1");

    expect(capturedBodies).toHaveLength(1);
    expect(capturedBodies[0]).toEqual({
      action: "notify",
      targetUserId: userId,
      senderShardId: `chat:${randomShard}`,
      senderConnId: "sender-conn-1",
      evt: buildCompleteEvt,
    });
  });

  it("does NOT wire registration on a random-UUID codegen shard (bounded-registration guard)", () => {
    const { env } = buildFakeEnv();
    const cbs = userNotifyCallbacksForChatSessions(randomShard, env);
    // Emit-only: registering a random-UUID shard would leak dead shards into UserNotify.
    expect(cbs.registerUserSubscription).toBeUndefined();
    expect(cbs.deregisterUserSubscription).toBeUndefined();
  });

  it("wires notifyUser AND registration on the stable notify-user shard", async () => {
    const { env, capturedBodies } = buildFakeEnv();
    const shard = userNotifyShardFor(userId);
    const cbs = userNotifyCallbacksForChatSessions(shard, env);

    expect(cbs.notifyUser).toBeDefined();
    expect(cbs.registerUserSubscription).toBeDefined();
    expect(cbs.deregisterUserSubscription).toBeDefined();

    await cbs.registerUserSubscription?.(userId);
    expect(capturedBodies).toEqual([{ action: "register", shardId: shard }]);
  });
});
