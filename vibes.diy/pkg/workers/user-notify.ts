import { DurableObject, DurableObjectState, Request as CFRequest, Response as CFResponse } from "@cloudflare/workers-types";
import { CFEnv } from "@vibes.diy/api-types";
import { exception2Result } from "@adviser/cement";
import { type } from "arktype";

declare const Response: typeof CFResponse;

const UserNotifyRegister = type({ action: "'register'", shardId: "string" });
const UserNotifyDeregister = type({ action: "'deregister'", shardId: "string" });

const UserNotifyEvt = type({
  type: "'vibes.diy.evt-user-notification'",
  notificationType: "string",
  ownerHandle: "string",
  appSlug: "string",
});

const UserNotifyNotify = type({
  action: "'notify'",
  targetUserId: "string",
  senderShardId: "string",
  senderConnId: "string",
  evt: UserNotifyEvt,
});

const UserNotifyMessage = UserNotifyRegister.or(UserNotifyDeregister).or(UserNotifyNotify);
type UserNotifyMessage = typeof UserNotifyMessage.infer;

const SUBSCRIBERS_KEY = "subscribers";

export class UserNotify implements DurableObject {
  private subscribers: Set<string> | undefined;
  private readonly state: DurableObjectState;
  private readonly env: CFEnv;

  constructor(state: DurableObjectState, env: CFEnv) {
    this.state = state;
    this.env = env;
  }

  private async getSubscribers(): Promise<Set<string>> {
    if (!this.subscribers) {
      const stored = await this.state.storage.get<string[]>(SUBSCRIBERS_KEY);
      this.subscribers = new Set(stored ?? []);
    }
    return this.subscribers;
  }

  private async saveSubscribers(): Promise<void> {
    if (this.subscribers) {
      await this.state.storage.put(SUBSCRIBERS_KEY, [...this.subscribers]);
    }
  }

  async fetch(request: CFRequest): Promise<CFResponse> {
    if (request.method !== "POST") {
      return new Response("Expected POST", { status: 400 });
    }
    const rJson = await exception2Result(() => request.json());
    if (rJson.isErr()) return new Response("Invalid JSON", { status: 400 });
    const parsed = UserNotifyMessage(rJson.Ok());
    if (parsed instanceof type.errors) return new Response("Invalid message", { status: 400 });

    const subs = await this.getSubscribers();

    switch (parsed.action) {
      case "register":
        subs.add(parsed.shardId);
        await this.saveSubscribers();
        console.log("[UserNotify] register shard:", parsed.shardId.slice(0, 8), "| subscribers:", subs.size);
        return new Response("ok");

      case "deregister":
        subs.delete(parsed.shardId);
        await this.saveSubscribers();
        console.log("[UserNotify] deregister shard:", parsed.shardId.slice(0, 8), "| subscribers:", subs.size);
        return new Response("ok");

      case "notify":
        await this.fanOut(parsed, subs);
        return new Response("ok");

      default:
        return new Response("Unknown action", { status: 400 });
    }
  }

  private async fanOut(msg: typeof UserNotifyNotify.infer, subs: Set<string>): Promise<void> {
    const stale: string[] = [];
    const promises: Promise<void>[] = [];
    const targets = [...subs];
    console.log(
      "[UserNotify] notify",
      msg.evt.notificationType,
      msg.evt.ownerHandle + "/" + msg.evt.appSlug,
      "| sender shard:",
      msg.senderShardId.slice(0, 8),
      "conn:",
      msg.senderConnId.slice(0, 8),
      "| fan-out to",
      targets.length,
      "shards"
    );

    for (const shardId of targets) {
      promises.push(
        (async () => {
          const id = this.env.CHAT_SESSIONS.idFromName(shardId);
          const stub = this.env.CHAT_SESSIONS.get(id);
          const rFetch = await exception2Result(() =>
            stub.fetch(
              new Request("https://internal/user-notify", {
                method: "POST",
                body: JSON.stringify({ evt: msg.evt, senderConnId: msg.senderConnId, targetUserId: msg.targetUserId }),
                headers: { "Content-Type": "application/json" },
              }) as unknown as CFRequest
            )
          );
          if (rFetch.isErr()) {
            console.error("[UserNotify] fan-out FAILED shard:", shardId.slice(0, 8), "removing");
            stale.push(shardId);
          } else if (!rFetch.Ok().ok) {
            console.warn("[UserNotify] fan-out STALE shard:", shardId.slice(0, 8), "removing (status", rFetch.Ok().status + ")");
            stale.push(shardId);
          } else {
            console.log("[UserNotify] fan-out OK shard:", shardId.slice(0, 8));
          }
        })()
      );
    }

    await Promise.all(promises);
    if (stale.length > 0) {
      for (const shardId of stale) subs.delete(shardId);
      await this.saveSubscribers();
    }
  }
}
