import { EventoEnDecoder, Result, JSONEnDecoderSingleton, top_uint8 } from "@adviser/cement";
import { w3CWebSocketEvent, W3CWebSocketEvent } from "@vibes.diy/api-types";
import { type } from "arktype";

export class ReqResEventoEnDecoder implements EventoEnDecoder<Request, string> {
  async encode(args: Request): Promise<Result<unknown>> {
    if (args.method === "POST" || args.method === "PUT") {
      const body = (await args.json()) as unknown;
      return Result.Ok(body);
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
          return Result.Ok();
        }
        return this.jsEncoder.parse(await top_uint8(arkMatch.event.data as never));
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
