import { EventoEnDecoder, Result, JSONEnDecoderSingleton, top_uint8, exception2Result } from "@adviser/cement";
import { w3CWebSocketEvent, W3CWebSocketEvent } from "@vibes.diy/api-types";
import { type } from "arktype";

const encodeDebugEnv = (import.meta as ImportMeta & { env?: { DEV?: boolean; DEBUG?: string } }).env;
const shouldLogEncodeDebug = Boolean(encodeDebugEnv?.DEV || encodeDebugEnv?.DEBUG);

function encodeDebugLog(...args: unknown[]): void {
  if (shouldLogEncodeDebug) {
    console.log(...args);
  }
}

export class ReqResEventoEnDecoder implements EventoEnDecoder<Request, string> {
  async encode(args: Request): Promise<Result<unknown>> {
    if (args.method === "POST" || args.method === "PUT") {
      // Only auto-parse JSON bodies. Binary upload routes (e.g.
      // POST /assets with application/octet-stream) need to read
      // request.body themselves; consuming it here would leave the
      // handler with an empty stream.
      const contentType = args.headers.get("Content-Type") ?? "";
      if (contentType.includes("json")) {
        return exception2Result(() => args.json());
      }
      return Result.Ok();
    }
    return Result.Ok();
  }
  decode(data: unknown): Promise<Result<string>> {
    return Promise.resolve(Result.Ok(JSON.stringify(data)));
  }
}

export class W3CWebSocketEventEventoEnDecoder implements EventoEnDecoder<W3CWebSocketEvent, string> {
  readonly jsEncoder = JSONEnDecoderSingleton();
  async encode(args: W3CWebSocketEvent): Promise<Result<unknown>> {
    const arkMatch = w3CWebSocketEvent(args);
    if (arkMatch instanceof type.errors) {
      return Result.Ok();
    }
    switch (arkMatch.type) {
      case "MessageEvent":
        if (!arkMatch.event.data) {
          encodeDebugLog("[encode] MessageEvent: no data");
          return Result.Ok();
        }
        {
          const uint8 = await top_uint8(arkMatch.event.data as never);
          encodeDebugLog("[encode] MessageEvent: top_uint8 size=", uint8.length);
          const parsed = this.jsEncoder.parse(uint8);
          if (parsed.isErr()) {
            console.error("[encode] jsEncoder.parse failed:", parsed.Err());
          } else {
            const val = parsed.Ok();
            const preview = JSON.stringify(val);
            encodeDebugLog(
              "[encode] jsEncoder.parse ok, type=",
              (val as Record<string, Record<string, unknown>>)?.payload?.type,
              "tid=",
              (val as Record<string, unknown>)?.tid,
              "preview=",
              preview.slice(0, 120)
            );
          }
          return parsed;
        }
      case "CloseEvent":
      case "ErrorEvent":
        // console.warn("Not Impl WS Event:", arkMatch);
        return Result.Ok();
      default:
        console.error("Unknown WS Event:", arkMatch);
        return Result.Ok();
    }
  }
  decode(data: unknown): Promise<Result<string>> {
    return Promise.resolve(Result.Ok(JSON.stringify(data)));
  }
}

export class MsgBaseEventoEnDecoder implements EventoEnDecoder<unknown, string> {
  async encode(args: unknown): Promise<Result<unknown>> {
    if (typeof args === "string") {
      const r = exception2Result(() => JSON.parse(args) as unknown);
      if (r.isErr()) {
        return Result.Ok();
      }
      return Result.Ok(r.Ok());
    }
    return Result.Ok(args);
  }
  decode(data: unknown): Promise<Result<string>> {
    return Promise.resolve(Result.Ok(JSON.stringify(data)));
  }
}

export class CombinedEventoEnDecoder implements EventoEnDecoder<Request | W3CWebSocketEvent, string> {
  private decoders: EventoEnDecoder<unknown, string>[];
  constructor(...decoders: EventoEnDecoder<unknown, string>[]) {
    this.decoders = decoders;
  }
  async encode(args: Request | W3CWebSocketEvent): Promise<Result<unknown>> {
    for (const decoder of this.decoders) {
      const result = await decoder.encode(args);
      if (result.isOk()) {
        return result;
      }
    }
    return Result.Ok();
  }
  decode(data: unknown): Promise<Result<string>> {
    return Promise.resolve(Result.Ok(JSON.stringify(data)));
  }
}
