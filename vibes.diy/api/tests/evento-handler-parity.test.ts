import { describe, expect, it } from "vitest";
import { handlerManifest, handlersForShard, ShardKind } from "../svc/evento-handler-manifest.js";
import { chatPlaneHandlers } from "../svc/chat-msg-evento.js";

// The single declarative manifest (#2714) is the source of truth: each handler
// carries `allowed: ShardKind[]`. These assertions read that metadata directly
// — there is no per-plane handler array to keep in sync anymore.

function hashesOn(kind: ShardKind): Set<string> {
  return new Set(handlersForShard(kind).map((h) => h.hash));
}

function allowedOf(hash: string): readonly ShardKind[] {
  const found = handlerManifest.filter((e) => e.handler.hash === hash);
  expect(found.length, `"${hash}" must appear exactly once in the manifest`).toBe(1);
  return found[0].allowed;
}

describe("evento handler manifest (declarative, #2714)", () => {
  it("every handler has a unique hash", () => {
    const allHashes = handlerManifest.map((e) => e.handler.hash);
    expect(new Set(allHashes).size, "duplicate hashes found").toBe(allHashes.length);
  });

  it("every handler is allowed on at least one shard kind", () => {
    for (const e of handlerManifest) {
      expect(e.allowed.length, `"${e.handler.hash}" has an empty allowed set`).toBeGreaterThan(0);
      for (const k of e.allowed) {
        expect(["stream", "vibe", "shared"]).toContain(k);
      }
    }
  });

  it("covers all expected handlers", () => {
    const all = new Set(handlerManifest.map((e) => e.handler.hash));
    expect(all.size).toBeGreaterThan(0);
    expect(all.has("put-doc")).toBe(true);
    expect(all.has("open-chat-handler")).toBe(true);
    expect(all.has("list-recent-vibes")).toBe(true);
    expect(all.has("list-ownerHandle-appSlug")).toBe(true);
    expect(all.has("list-models")).toBe(true);
    expect(all.has("list-request-grants")).toBe(true);
    expect(all.has("vibe.whoAmI")).toBe(true);
  });

  it("doc ops are vibe-only — they must never reach the stream or shared shard (#2265 AccessFnDO gate)", () => {
    // Category (b) topology: doc writes do LOCAL broadcast on the vibe shard, so
    // serving them elsewhere would persist-and-go-quiet (silent split-brain).
    for (const hash of ["put-doc", "subscribe-docs", "get-doc", "delete-doc", "subscribe-viewer-grants"]) {
      expect([...allowedOf(hash)].sort(), `${hash} must be vibe-only`).toEqual(["vibe"]);
    }
    const stream = hashesOn("stream");
    const shared = hashesOn("shared");
    expect(stream.has("put-doc")).toBe(false);
    expect(stream.has("subscribe-docs")).toBe(false);
    expect(shared.has("put-doc")).toBe(false);
    expect(shared.has("subscribe-docs")).toBe(false);
  });

  it("chat streaming write ops (ensure/fork/setMode) are stream-only", () => {
    for (const hash of ["ensure-appSlug-item", "fork-app", "set-mode-fsid"]) {
      expect([...allowedOf(hash)].sort(), `${hash} must be stream-only`).toEqual(["stream"]);
    }
  });

  it("open-chat + prompt are allowed on stream AND vibe (img-gen on vibeApi, #2350)", () => {
    for (const hash of ["open-chat-handler", "prompt-chat-section-handler"]) {
      expect([...allowedOf(hash)].sort(), `${hash} must be stream+vibe`).toEqual(["stream", "vibe"]);
    }
    expect(hashesOn("stream").has("open-chat-handler")).toBe(true);
    expect(hashesOn("vibe").has("open-chat-handler")).toBe(true);
  });

  it("shared reads/grants/membership are allowed on every shard kind", () => {
    for (const hash of [
      "list-request-grants",
      "vibe.whoAmI",
      "create-invite",
      "list-members",
      "list-models",
      // user-scoped reads the parent app calls on chatApi must stay reachable
      "list-dm-threads", // DmInbox / vibe-route badge
      "asset-upload-grant", // HandleAvatarEditor / srv-sandbox putAsset
    ]) {
      expect([...allowedOf(hash)].sort(), `${hash} must be allowed on all shards`).toEqual(["shared", "stream", "vibe"]);
    }
  });

  it("identity/settings/report handlers are allowed everywhere (Track B re-home)", () => {
    const reHomed = [
      "list-user-slug-bindings",
      "create-user-slug-binding",
      "delete-user-slug-binding",
      "get-cert-from-csr",
      "vibes.diy.req-report-growth-memberships",
      "vibes.diy.req-report-growth-vibes-with-data",
      "vibes.diy.req-report-active-members",
      "vibes.diy.req-report-top-vibes-by-members",
      "vibes.diy.req-report-attribution-referrers",
      "vibes.diy.req-report-campaign-health",
      "vibes.diy.req-report-campaign-ad-previews",
    ];
    for (const hash of reHomed) {
      expect(allowedOf(hash)).toContain("shared");
      expect(allowedOf(hash)).toContain("stream");
    }
  });

  it("chat-history READ queries are plain D1 reads — allowed on every shard, not stream-only", () => {
    for (const hash of ["get-chat-response", "get-chat-details", "list-application-chats"]) {
      expect([...allowedOf(hash)].sort(), `${hash} must be allowed on all shards`).toEqual(["shared", "stream", "vibe"]);
    }
  });

  it("preserves manifest order per shard (historical shared → vibe → stream push order)", () => {
    // The manifest is partitioned shared-block → vibe-block → stream-block, and
    // handlersForShard is a *stable* filter, so each plane's served order equals
    // the order of the matching manifest entries. cf-serve push order matters for
    // dispatch precedence, so this contract gets its own regression guard.
    const manifestOrder = handlerManifest.map((e) => e.handler.hash);
    const isSubsequence = (sub: readonly string[], full: readonly string[]): boolean => {
      let i = 0;
      for (const h of full) {
        if (h === sub[i]) i++;
      }
      return i === sub.length;
    };
    for (const kind of ["stream", "vibe", "shared"] as const) {
      const served = handlersForShard(kind).map((h) => h.hash);
      expect(isSubsequence(served, manifestOrder), `${kind} order must follow manifest order`).toBe(true);
    }

    // Concrete sequence invariants matching the historical per-plane push order.
    const vibe = handlersForShard("vibe").map((h) => h.hash);
    // shared reads precede vibe doc ops precede the open-chat/prompt stopgap pair.
    expect(vibe.indexOf("list-models")).toBeLessThan(vibe.indexOf("put-doc"));
    expect(vibe.indexOf("put-doc")).toBeLessThan(vibe.indexOf("open-chat-handler"));
    expect(vibe.indexOf("open-chat-handler")).toBeLessThan(vibe.indexOf("prompt-chat-section-handler"));

    const stream = handlersForShard("stream").map((h) => h.hash);
    // shared reads precede chat ops; within chat ops: ensure → open-chat → prompt → fork → setMode.
    expect(stream.indexOf("list-models")).toBeLessThan(stream.indexOf("ensure-appSlug-item"));
    expect(stream.indexOf("ensure-appSlug-item")).toBeLessThan(stream.indexOf("open-chat-handler"));
    expect(stream.indexOf("open-chat-handler")).toBeLessThan(stream.indexOf("prompt-chat-section-handler"));
    expect(stream.indexOf("prompt-chat-section-handler")).toBeLessThan(stream.indexOf("fork-app"));
    expect(stream.indexOf("fork-app")).toBeLessThan(stream.indexOf("set-mode-fsid"));
  });

  it("chatPlaneHandlers == handlersForShard('stream'): streaming + shared reads, no doc ops", () => {
    const chatPlane = new Set(chatPlaneHandlers.map((h) => h.hash));
    expect(chatPlane).toEqual(hashesOn("stream"));
    // Doc writes must never reach the chat plane (AccessFnDO gate).
    expect(chatPlane.has("put-doc")).toBe(false);
    expect(chatPlane.has("subscribe-docs")).toBe(false);
    // But the chat plane still serves chat streaming + shared queries.
    expect(chatPlane.has("open-chat-handler")).toBe(true);
    expect(chatPlane.has("vibe.whoAmI")).toBe(true);
  });
});
