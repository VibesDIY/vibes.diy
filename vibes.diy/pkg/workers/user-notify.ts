import { DurableObject, DurableObjectState, Request as CFRequest, Response as CFResponse } from "@cloudflare/workers-types";
import { CFEnv, isUserNotificationEvent, UserNotificationEvent } from "@vibes.diy/api-types";
import { exception2Result } from "@adviser/cement";
import { type } from "arktype";

declare const Response: typeof CFResponse;

const UserNotifyRegister = type({
  action: "'register'",
  shardId: "string",
  userId: "string",
});

const UserNotifyDeregister = type({
  action: "'deregister'",
  shardId: "string",
  userId: "string",
});

const UserNotifyNotify = type({
  action: "'notify'",
  userId: "string",
  senderShardId: "string",
  senderConnId: "string",
  evt: type("Record<string, unknown>"),
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
    if (rJson.isErr()) {
      return new Response("Invalid JSON", { status: 400 });
    }

    const parsed = UserNotifyMessage(rJson.Ok());
    if (parsed instanceof type.errors) {
      return new Response("Invalid message", { status: 400 });
    }
    const body = parsed;

    const subs = await this.getSubscribers();

    switch (body.action) {
      case "register":
        subs.add(body.shardId);
        await this.saveSubscribers();
        console.log("[UserNotify] register shard:", body.shardId.slice(0, 8), "| subscribers:", subs.size, "| user:", body.userId);
        return new Response("ok");

      case "deregister":
        subs.delete(body.shardId);
        await this.saveSubscribers();
        console.log(
          "[UserNotify] deregister shard:",
          body.shardId.slice(0, 8),
          "| subscribers:",
          subs.size,
          "| user:",
          body.userId
        );
        return new Response("ok");

      case "notify":
        if (!isUserNotificationEvent(body.evt)) {
          return new Response("Invalid user notification event", { status: 400 });
        }
        await this.fanOut(
          {
            ...body,
            evt: body.evt,
          },
          subs
        );
        return new Response("ok");

      default:
        return new Response("Unknown action", { status: 400 });
    }
  }

  private async fanOut(
    msg: Omit<typeof UserNotifyNotify.infer, "evt"> & { evt: UserNotificationEvent },
    subs: Set<string>
  ): Promise<void> {
    const stale: string[] = [];
    const promises: Promise<void>[] = [];

    const targets = [...subs];
    console.log(
      "[UserNotify] notify user:",
      msg.userId,
      `type:${msg.evt.type}`,
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
                body: JSON.stringify({
                  evt: msg.evt,
                  senderConnId: msg.senderConnId,
                  userId: msg.userId,
                }),
                headers: { "Content-Type": "application/json" },
              }) as unknown as CFRequest
            )
          );
          if (rFetch.isErr()) {
            console.log("[UserNotify] fan-out FAILED shard:", shardId.slice(0, 8), "removing (fetch error)");
            stale.push(shardId);
          } else if (!rFetch.Ok().ok) {
            console.log("[UserNotify] fan-out STALE shard:", shardId.slice(0, 8), "removing (status", rFetch.Ok().status + ")");
            stale.push(shardId);
          } else {
            console.log("[UserNotify] fan-out OK shard:", shardId.slice(0, 8));
          }
        })()
      );
    }

    await Promise.all(promises);

    if (stale.length > 0) {
      for (const shardId of stale) {
        subs.delete(shardId);
      }
      await this.saveSubscribers();
    }
  }
}
