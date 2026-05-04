import { DurableObject, DurableObjectState, Request as CFRequest, Response as CFResponse } from "@cloudflare/workers-types";
import { CFEnv } from "@vibes.diy/api-types";
import { exception2Result } from "@adviser/cement";
import { type } from "arktype";

declare const Response: typeof CFResponse;

const DocNotifyRegister = type({
  action: "'register'",
  shardId: "string",
});

const DocNotifyDeregister = type({
  action: "'deregister'",
  shardId: "string",
});

const DocNotifyNotify = type({
  action: "'notify'",
  // senderShardId is informational (logging/diagnostics) — exclusion happens
  // per-WebSocket via senderConnId so siblings on the same shard still fan out.
  senderShardId: "string",
  senderConnId: "string",
  evt: {
    type: "string",
    userSlug: "string",
    appSlug: "string",
    docId: "string",
  },
});

const DocNotifyMessage = DocNotifyRegister.or(DocNotifyDeregister).or(DocNotifyNotify);
type DocNotifyMessage = typeof DocNotifyMessage.infer;

const SUBSCRIBERS_KEY = "subscribers";

export class DocNotify implements DurableObject {
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
    const parsed = DocNotifyMessage(rJson.Ok());
    if (parsed instanceof type.errors) {
      return new Response("Invalid message", { status: 400 });
    }
    const body = parsed;

    const subs = await this.getSubscribers();

    switch (body.action) {
      case "register":
        subs.add(body.shardId);
        await this.saveSubscribers();
        console.log("[DocNotify] register shard:", body.shardId.slice(0, 8), "| subscribers:", subs.size);
        return new Response("ok");

      case "deregister":
        subs.delete(body.shardId);
        await this.saveSubscribers();
        console.log("[DocNotify] deregister shard:", body.shardId.slice(0, 8), "| subscribers:", subs.size);
        return new Response("ok");

      case "notify":
        await this.fanOut(body, subs);
        return new Response("ok");

      default:
        return new Response("Unknown action", { status: 400 });
    }
  }

  private async fanOut(msg: typeof DocNotifyNotify.infer, subs: Set<string>): Promise<void> {
    const stale: string[] = [];
    const promises: Promise<void>[] = [];

    // Fan out to ALL subscriber shards including the sender shard — the
    // sender connection is excluded per-WebSocket inside chat-sessions via
    // senderConnId, which lets sibling tabs/browsers on the same shard
    // (warm-DO sharing per vibe) still receive the notification.
    const targets = [...subs];
    console.log(
      "[DocNotify] notify",
      msg.evt.userSlug + "/" + msg.evt.appSlug,
      "docId:",
      msg.evt.docId.slice(0, 8),
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
              new Request("https://internal/doc-notify", {
                method: "POST",
                body: JSON.stringify({ evt: msg.evt, senderConnId: msg.senderConnId }),
                headers: { "Content-Type": "application/json" },
              }) as unknown as CFRequest
            )
          );
          if (rFetch.isErr()) {
            console.log("[DocNotify] fan-out FAILED shard:", shardId.slice(0, 8), "removing (fetch error)");
            stale.push(shardId);
          } else if (!rFetch.Ok().ok) {
            // 410 Gone = no live connections on that shard
            console.log("[DocNotify] fan-out STALE shard:", shardId.slice(0, 8), "removing (status", rFetch.Ok().status + ")");
            stale.push(shardId);
          } else {
            console.log("[DocNotify] fan-out OK shard:", shardId.slice(0, 8));
          }
        })()
      );
    }

    await Promise.all(promises);

    // Clean up stale subscribers that failed to receive
    if (stale.length > 0) {
      for (const shardId of stale) {
        subs.delete(shardId);
      }
      await this.saveSubscribers();
    }
  }
}
