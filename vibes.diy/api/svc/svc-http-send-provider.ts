import { CoercedHeadersInit, EventoSendProvider, HandleTriggerCtx, HttpHeader, Lazy, Result } from "@adviser/cement";
import { HttpResponseBodyType, HttpResponseJsonType } from "@vibes.diy/api-types";
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
      ctx.send.send(ctx, this.response);
      return Result.Err("invalid response type");
    }
    const body = HttpResponseBodyType(res);
    const json = HttpResponseJsonType(res);
    if (json instanceof type.errors && body instanceof type.errors) {
      this.response = new Response(JSON.stringify({ type: "error", message: "Response does not match expected types" }), {
        status: 500,
        headers: DefaultHttpHeaders({ "Content-Type": "application/json" }),
      });
      ctx.send.send(ctx, this.response);
      return Result.Err("response does not match expected types");
    }
    if (!(json instanceof type.errors)) {
      this.response = new Response(JSON.stringify(json.json), {
        status: json.status,
        headers: DefaultHttpHeaders({
          "Content-Type": "application/json",
          "Server-Timing": `total;dur=${(ctx.stats.request.doneTime.getTime() - ctx.stats.request.startTime.getTime()).toFixed(2)}`,
        }),
      });
      ctx.send.send(ctx, this.response);
      return Result.Ok(json as unknown as T);
    }
    if (!(body instanceof type.errors)) {
      this.response = new Response(body.body as BodyInit, {
        status: body.status,
        headers: DefaultHttpHeaders({
          "Content-Type": body.headers?.["Content-Type"] ?? "application/octet-stream",
          "Server-Timing": `total;dur=${(ctx.stats.request.doneTime.getTime() - ctx.stats.request.startTime.getTime()).toFixed(2)}`,
          ...body.headers,
        }),
      });
      ctx.send.send(ctx, this.response);
      return Result.Ok(body as unknown as T);
    }
    return Result.Err("unhandled response type");
  }
}
