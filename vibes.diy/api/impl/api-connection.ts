import { Result, ReturnOnFunc } from "@adviser/cement";
import { W3CWebSocketErrorEvent, W3CWebSocketMessageEvent, W3CWebSocketCloseEvent } from "@vibes.diy/api-types";

export interface VibeDiyApiConnection {
  ctx: unknown;
  onError: ReturnOnFunc<[W3CWebSocketErrorEvent]>;
  onMessage: ReturnOnFunc<[W3CWebSocketMessageEvent]>;
  onClose: ReturnOnFunc<[W3CWebSocketCloseEvent]>;
  send(data: Uint8Array<ArrayBuffer>): Result<void>;
  close(): Promise<void>;
}
