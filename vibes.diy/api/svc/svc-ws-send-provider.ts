import { EventoSendProvider, HandleTriggerCtx, JSONEnDecoder, JSONEnDecoderSingleton, Result } from "@adviser/cement";
import { msgBase, MsgBase, SectionEvent, W3CWebSocketEvent } from "@vibes.diy/api-types";
import { type } from "arktype";

export interface ChatIdCtx {
  readonly chatId: string;
  readonly promptIds: Map<string, SectionEvent>;
  readonly tids: Set<string>;
}

export class WSSendProvider implements EventoSendProvider<W3CWebSocketEvent, unknown, unknown> {
  readonly ws: WebSocket;
  readonly ende: JSONEnDecoder;
  readonly chatIds = new Map<string, ChatIdCtx>();
  // Firefly: subscription keys this connection holds for document change
  // notifications. Keys are db-scoped so a tighter `read` ACL on one db doesn't
  // leak via change events on another. Two shapes, both rooted at the db so a
  // channel can never collide with a db of the same name (#2340):
  //   owner/app/<dbName>            — bare db key (non-access-fn, or the #2337
  //                                   fallback before a channel materializes)
  //   owner/app/<dbName>/<channel>  — access-fn channel key (nested under its db)
  readonly subscribedDocKeys = new Set<string>();
  // Per-(ownerHandle/appSlug) subscription keys this connection is subscribed to
  // for request-grant notifications (owner pending approvals).
  readonly subscribedRequestGrantKeys = new Set<string>();
  // Per-(ownerHandle/appSlug) keys this connection is subscribed to for
  // viewer-grant refresh notifications (triggers parent whoAmI refresh).
  readonly subscribedViewerGrantKeys = new Set<string>();
  // The userId this connection is subscribed to for user-level notifications
  // (build-complete, request-approved, etc.). A single value because a
  // WebSocket connection belongs to exactly one authenticated user.
  subscribedUserKey: string | undefined = undefined;
  adminMode = false;
  // Unique per-WebSocket id used to skip the originating connection when
  // fanning out doc-changed notifications. Many connections share a shard
  // (warm-DO sharing per (ownerHandle, appSlug)), so shard-level exclusion
  // would mute sibling tabs/browsers — exclusion must be per-connection.
  readonly connId: string = crypto.randomUUID();
  constructor(ws: WebSocket, ende?: JSONEnDecoder) {
    this.ws = ws;
    this.ende = ende ?? JSONEnDecoderSingleton();
  }

  async send<T>(ctx: HandleTriggerCtx<W3CWebSocketEvent, unknown, unknown>, res: unknown): Promise<Result<T>> {
    const msg = msgBase(ctx.enRequest);
    if (msg instanceof type.errors) {
      this.ws.send(this.ende.uint8ify({ type: "error", message: "Invalid message incoming" }));
      return Result.Err("invalid incoming message");
    }
    const outMsg = msgBase(res);
    let sendMsg: MsgBase;
    if (outMsg instanceof type.errors) {
      sendMsg = {
        tid: msg.tid,
        src: msg.dst,
        dst: msg.src,
        ttl: 10,
        payload: res,
      };
    } else {
      sendMsg = outMsg;
    }
    this.ws.send(this.ende.uint8ify(sendMsg));
    return Result.Ok(sendMsg as unknown as T);
  }
}
