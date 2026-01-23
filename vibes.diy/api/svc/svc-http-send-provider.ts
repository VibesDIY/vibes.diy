import { CoercedHeadersInit, EventoSendProvider, HandleTriggerCtx, HttpHeader, Lazy, Result } from "@adviser/cement";
import { HttpResponseBodyType, HttpResponseJsonType, msgBase, MsgBase } from "@vibes.diy/api-types";
import { type } from "arktype";

const defaultHttpHeaders = Lazy(() =>
  HttpHeader.from({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS,PUT,DELETE",
    "Access-Control-Allow-Headers": "Origin, Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
  })
);

export function DefaultHttpHeaders(...h: CoercedHeadersInit[]): HeadersInit {
  return defaultHttpHeaders()
    .Merge(...h)
    .AsHeaderInit();
}

export class HTTPSendProvider implements EventoSendProvider<Request, unknown, unknown> {
  response?: Response;
  getResponse(): Response {
    if (!this.response) {
      this.response = new Response(JSON.stringify({ type: "error", message: "Response not set" }), {
        status: 500,
        headers: DefaultHttpHeaders({ "Content-Type": "application/json" }),
      });
    }
    const res = this.response;
    this.response = undefined;
    return res;
  }
  async send<T>(ctx: HandleTriggerCtx<Request, unknown, unknown>, res: unknown): Promise<Result<T>> {
    // noop, handled in createHandler
    if (this.response) {
      return Result.Err("response could only be set once");
    }
    // kaputt
    const is = type(HttpResponseBodyType).or(HttpResponseJsonType);
    if (is instanceof type.errors) {
      this.response = new Response(JSON.stringify({ type: "error", message: "Invalid response type" }), {
        status: 500,
        headers: DefaultHttpHeaders({ "Content-Type": "application/json" }),
      });
      return Result.Err("invalid response type");
    }

    const msg = msgBase(ctx.enRequest);
    if (msg instanceof type.errors) {
      this.response = new Response(JSON.stringify({ type: "error", message: "Invalid message base" }), {
        status: 400,
        headers: DefaultHttpHeaders({ "Content-Type": "application/json" }),
      });
      return Result.Err("invalid message base");
    }
    // need to set src / transactionId ... the optionals to real
    const defaultRes: MsgBase = {
      tid: msg.tid,
      src: msg.dst,
      dst: msg.src,
      ttl: 10,
      payload: res,
    };
    return ctx.encoder.decode(defaultRes).then((rStr) => {
      if (rStr.isErr()) {
        const x = {
          type: "error",
          message: "Failed to decode response",
          error: rStr.Err(),
        };
        this.response = new Response(JSON.stringify(x), {
          status: 500,
          headers: DefaultHttpHeaders({ "Content-Type": "application/json" }),
        });
        return Result.Err(rStr.Err());
      }
      this.response = new Response(rStr.Ok() as string, {
        status: 200,
        headers: DefaultHttpHeaders({
          "Content-Type": "application/json",
          "Server-Timing": `total;dur=${(ctx.stats.request.doneTime.getTime() - ctx.stats.request.startTime.getTime()).toFixed(2)}`,
        }),
      });
      return Result.Ok(defaultRes as T);
    });
  }
}
