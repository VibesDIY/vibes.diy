import { EventoSendProvider, HandleTriggerCtx, JSONEnDecoder, JSONEnDecoderSingleton, Result } from "@adviser/cement";
import { msgBase, MsgBase, W3CWebSocketEvent } from "@vibes.diy/api-types";
import { type } from "arktype";

export interface ChatIdCtx {
  chatId: string;
  tid: string;
}

export class WSSendProvider implements EventoSendProvider<W3CWebSocketEvent, unknown, unknown> {
  readonly ws: WebSocket;
  readonly ende: JSONEnDecoder;
  readonly chatIds = new Set<ChatIdCtx>();
  constructor(ws: WebSocket, ende?: JSONEnDecoder) {
    this.ws = ws;
    this.ende = ende ?? JSONEnDecoderSingleton();
  }

  async send<T>(ctx: HandleTriggerCtx<W3CWebSocketEvent, unknown, unknown>, res: unknown): Promise<Result<T>> {
    // console.log("WSSendProvider preparing to send response:", res);
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
