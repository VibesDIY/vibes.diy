import { EventoSendProvider, HandleTriggerCtx, JSONEnDecoder, JSONEnDecoderSingleton, Result } from "@adviser/cement";
import { msgBase, MsgBase } from "@vibes.diy/api-types";
import { type } from "arktype";

export class WSSendProvider implements EventoSendProvider<Request, unknown, unknown> {
  readonly ws: WebSocket;
  readonly ende: JSONEnDecoder;
  constructor(ws: WebSocket, ende?: JSONEnDecoder) {
    this.ws = ws;
    this.ende = ende ?? JSONEnDecoderSingleton();
  }

  async send<T>(ctx: HandleTriggerCtx<Request, unknown, unknown>, res: unknown): Promise<Result<T>> {
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
