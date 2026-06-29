import { Request as CFRequest, Response as CFResponse } from "@cloudflare/workers-types";
import { CFEnv, isUserNotifyShard, userNotifyShardFor, shardBelongsToUser, type EvtUserNotification } from "@vibes.diy/api-types";

// #2714 Spec B Phase E — the per-plane UserNotify callback builders, relocated
// here from the deleted ChatSessions/AppSessions/SharedSessions classes so the
// unified `Sessions` class (sessions.ts) can reuse them. The registration
// shardId prefixes (`app:`/`shared:`/bare) are unchanged — resolveShardDO maps
// them to the physical Sessions instances. Warn labels say `[Sessions]` now (the
// old class names are gone; a `[ChatSessions]` warn here would masquerade as an
// old-class drain marker).

// Vibe plane (formerly AppSessions): registers under `app:<vibeKey>`.
// ⚠️ LOAD-BEARING — the `app:` prefix here is the persisted registration shardId
// resolveShardDO maps back to the physical DO instance; it must stay identical
// to app.ts's `idFromName(\`app:${vibe}\`)`. Frozen for instance/registration
// continuity across #2714 Spec B — do not rename (see resolve-shard-do.ts).
export function userNotifyCallbacksForAppSessions(vibeKey: string, env: CFEnv) {
  const shardId = `app:${vibeKey}`;

  function fetchUserNotify(userId: string, body: Record<string, unknown>): Promise<CFResponse> {
    const id = env.USER_NOTIFY.idFromName(userId);
    const stub = env.USER_NOTIFY.get(id);
    return stub.fetch(
      new Request("https://internal/user-notify", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }) as unknown as CFRequest
    );
  }

  return {
    notifyUser: async (userId: string, evt: EvtUserNotification, senderConnId: string): Promise<void> => {
      await fetchUserNotify(userId, {
        action: "notify",
        targetUserId: userId,
        senderShardId: shardId,
        senderConnId,
        evt,
      });
    },
    registerUserSubscription: async (userId: string): Promise<void> => {
      await fetchUserNotify(userId, { action: "register", shardId });
    },
    deregisterUserSubscription: async (userId: string): Promise<void> => {
      await fetchUserNotify(userId, { action: "deregister", shardId });
    },
  };
}

// Codegen plane (formerly ChatSessions). The `notifyUser` emitter is wired
// UNCONDITIONALLY (build-complete fires from a random-UUID codegen shard);
// registration is bounded to the stable per-user notify shard.
export function userNotifyCallbacksForChatSessions(shard: string, env: CFEnv) {
  function fetchUserNotify(userId: string, body: Record<string, unknown>): Promise<CFResponse> {
    const id = env.USER_NOTIFY.idFromName(userId);
    const stub = env.USER_NOTIFY.get(id);
    return stub.fetch(
      new Request("https://internal/user-notify", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }) as unknown as CFRequest
    );
  }

  const notifyUser = async (userId: string, evt: EvtUserNotification, senderConnId: string): Promise<void> => {
    await fetchUserNotify(userId, {
      action: "notify",
      targetUserId: userId,
      senderShardId: `chat:${shard}`,
      senderConnId,
      evt,
    });
  };

  // Non-notify shard (e.g. a random-UUID codegen connection): emit only, no
  // registration. This is the path that delivers build-complete from codegen.
  if (!isUserNotifyShard(shard)) return { notifyUser };

  return {
    notifyUser,
    registerUserSubscription: async (userId: string): Promise<void> => {
      // The `?shard=` param is client-supplied on the public /api path, so only let a
      // connection register a shard in its OWN authenticated user's family. This ties
      // the (otherwise arbitrary) shard to the verified userId — a client can't inflate
      // UserNotify with forged shards. Codegen rolls on overload, so this plane accepts
      // the BOUNDED family (shardBelongsToUser, capped at MAX_ROLL_INDEX + 1), not strict
      // equality — keeping the per-user subscriber set finite. The shared plane below
      // stays strict-equality (exactly one shard per user); only codegen relaxes.
      if (!shardBelongsToUser(shard, userId)) {
        // Expected only on a forged/out-of-family shard, or if the client's DO-name id
        // (clerk.user.id) ever drifts from the server's claims.userId — in which case
        // notification registration silently no-ops, so surface it for telemetry.
        console.warn("[Sessions] skip user-notify register (codegen): shard not in user family", shard.slice(0, 24));
        return;
      }
      await fetchUserNotify(userId, { action: "register", shardId: shard });
    },
    deregisterUserSubscription: async (userId: string): Promise<void> => {
      if (!shardBelongsToUser(shard, userId)) return;
      await fetchUserNotify(userId, { action: "deregister", shardId: shard });
    },
  };
}

// Shared plane (formerly SharedSessions): registers under `shared:<shard>` so
// resolveShardDO routes fan-out to the unified SESSIONS handle. Only the stable
// per-user notify shard may register.
export function userNotifyCallbacksForSharedSessions(shard: string, env: CFEnv) {
  if (!isUserNotifyShard(shard)) return {};

  const shardId = `shared:${shard}`;

  function fetchUserNotify(userId: string, body: Record<string, unknown>): Promise<CFResponse> {
    const id = env.USER_NOTIFY.idFromName(userId);
    const stub = env.USER_NOTIFY.get(id);
    return stub.fetch(
      new Request("https://internal/user-notify", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }) as unknown as CFRequest
    );
  }

  return {
    registerUserSubscription: async (userId: string): Promise<void> => {
      if (shard !== userNotifyShardFor(userId)) {
        console.warn("[Sessions] skip user-notify register (shared): shard does not match authenticated user", shard.slice(0, 16));
        return;
      }
      await fetchUserNotify(userId, { action: "register", shardId });
    },
    deregisterUserSubscription: async (userId: string): Promise<void> => {
      if (shard !== userNotifyShardFor(userId)) return;
      await fetchUserNotify(userId, { action: "deregister", shardId });
    },
  };
}
