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
  senderShardId: "string",
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

    const targets = [...subs].filter((id) => id !== msg.senderShardId);
    console.log(
      "[DocNotify] notify",
      msg.evt.userSlug + "/" + msg.evt.appSlug,
      "docId:",
      msg.evt.docId.slice(0, 8),
      "| sender:",
      msg.senderShardId.slice(0, 8),
      "| fan-out to",
      targets.length,
      "of",
      subs.size,
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
                body: JSON.stringify(msg.evt),
                headers: { "Content-Type": "application/json" },
              }) as unknown as CFRequest
            )
          );
          if (rFetch.isErr()) {
            console.log("[DocNotify] fan-out FAILED shard:", shardId.slice(0, 8), "removing");
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
