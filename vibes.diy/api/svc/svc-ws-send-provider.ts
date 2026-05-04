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
  // Firefly: per-(userSlug/appSlug/dbName) subscription keys this connection
  // is subscribed to for document change notifications. dbName-scoped so a
  // tighter `read` ACL on one db doesn't leak via change events on another.
  readonly subscribedDocKeys = new Set<string>();
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
