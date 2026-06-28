import { describe, expect, it } from "vitest";
import { sharedMsgEvento } from "../svc/shared-msg-evento.js";
import { handlersForShard } from "../svc/evento-handler-manifest.js";

function hset(hs: readonly { hash: string }[]) {
  return new Set(hs.map((h) => h.hash));
}

describe("sharedMsgEvento", () => {
  it("serves exactly the handlers allowed on the shared shard", () => {
    const served = new Set(
      sharedMsgEvento()
        .handlers()
        .actions.map((h: { hash: string }) => h.hash)
    );
    for (const h of hset(handlersForShard("shared"))) expect(served.has(h), `missing ${h}`).toBe(true);
  });
  it("serves no vibe-only or codegen-only handler", () => {
    const served = new Set(
      sharedMsgEvento()
        .handlers()
        .actions.map((h: { hash: string }) => h.hash)
    );
    // Anything served on codegen/vibe but NOT on shared must be absent here.
    const sharedHashes = hset(handlersForShard("shared"));
    const elsewhere = [...hset(handlersForShard("vibe")), ...hset(handlersForShard("codegen"))].filter(
      (h) => sharedHashes.has(h) === false
    );
    expect(elsewhere.length, "expected some non-shared handlers to exist").toBeGreaterThan(0);
    for (const h of elsewhere) expect(served.has(h), `leaked non-shared handler ${h}`).toBe(false);
  });
});
