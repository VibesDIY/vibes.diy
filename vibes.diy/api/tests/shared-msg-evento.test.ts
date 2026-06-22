import { describe, expect, it } from "vitest";
import { sharedMsgEvento } from "../svc/shared-msg-evento.js";
import { sharedHandlers, appHandlers, chatHandlers } from "../svc/evento-handler-manifest.js";

function hset(hs: readonly { hash: string }[]) {
  return new Set(hs.map((h) => h.hash));
}

describe("sharedMsgEvento", () => {
  it("serves every sharedHandler", () => {
    const served = new Set(
      sharedMsgEvento()
        .handlers()
        .actions.map((h: { hash: string }) => h.hash)
    );
    for (const h of hset(sharedHandlers)) expect(served.has(h), `missing ${h}`).toBe(true);
  });
  it("serves no app or chat handler", () => {
    const served = new Set(
      sharedMsgEvento()
        .handlers()
        .actions.map((h: { hash: string }) => h.hash)
    );
    for (const h of hset(appHandlers)) expect(served.has(h), `leaked app ${h}`).toBe(false);
    for (const h of hset(chatHandlers)) expect(served.has(h), `leaked chat ${h}`).toBe(false);
  });
});
