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

export class DocNotify implements DurableObject {
  private readonly subscribers = new Set<string>();
  private readonly env: CFEnv;

  constructor(_state: DurableObjectState, env: CFEnv) {
    this.env = env;
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

    switch (body.action) {
      case "register":
        this.subscribers.add(body.shardId);
        return new Response("ok");

      case "deregister":
        this.subscribers.delete(body.shardId);
        return new Response("ok");

      case "notify":
        await this.fanOut(body);
        return new Response("ok");

      default:
        return new Response("Unknown action", { status: 400 });
    }
  }

  private async fanOut(msg: typeof DocNotifyNotify.infer): Promise<void> {
    const stale: string[] = [];
    const promises: Promise<void>[] = [];

    for (const shardId of this.subscribers) {
      if (shardId === msg.senderShardId) continue;

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
            stale.push(shardId);
          }
        })()
      );
    }

    await Promise.all(promises);

    // Clean up stale subscribers that failed to receive
    for (const shardId of stale) {
      this.subscribers.delete(shardId);
    }
  }
}
