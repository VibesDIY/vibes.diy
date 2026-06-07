import { describe, expect, it } from "vitest";
import { sharedHandlers, appHandlers, chatHandlers } from "../svc/evento-handler-manifest.js";

function hashes(handlers: readonly { readonly hash: string }[]): Set<string> {
  return new Set(handlers.map((h) => h.hash));
}

describe("evento handler manifest parity", () => {
  it("no handler appears in more than one category", () => {
    const shared = hashes(sharedHandlers);
    const app = hashes(appHandlers);
    const chat = hashes(chatHandlers);

    for (const h of shared) {
      expect(app.has(h), `"${h}" in both shared and app`).toBe(false);
      expect(chat.has(h), `"${h}" in both shared and chat`).toBe(false);
    }
    for (const h of app) {
      expect(chat.has(h), `"${h}" in both app and chat`).toBe(false);
    }
  });

  it("every handler has a unique hash", () => {
    const all = [...sharedHandlers, ...appHandlers, ...chatHandlers];
    const allHashes = all.map((h) => h.hash);
    const uniqueHashes = new Set(allHashes);
    expect(uniqueHashes.size, "duplicate hashes found").toBe(allHashes.length);
  });

  it("shared + app + chat covers all expected handlers", () => {
    const all = hashes([...sharedHandlers, ...appHandlers, ...chatHandlers]);
    expect(all.size).toBeGreaterThan(0);

    expect(all.has("put-doc")).toBe(true);
    expect(all.has("open-chat-handler")).toBe(true);
    expect(all.has("list-recent-vibes")).toBe(true);
    expect(all.has("list-ownerHandle-appSlug")).toBe(true);
    expect(all.has("list-models")).toBe(true);
  });

  it("app handlers do NOT include chat-only handlers", () => {
    const app = hashes(appHandlers);
    expect(app.has("open-chat-handler")).toBe(false);
    expect(app.has("prompt-chat-section")).toBe(false);
    expect(app.has("ensure-app-slug-item")).toBe(false);
    expect(app.has("fork-app")).toBe(false);
  });

  it("chat handlers do NOT include app-only handlers", () => {
    const chat = hashes(chatHandlers);
    expect(chat.has("put-doc")).toBe(false);
    expect(chat.has("subscribe-docs")).toBe(false);
    expect(chat.has("who-am-i")).toBe(false);
    expect(chat.has("create-invite")).toBe(false);
  });

  it("shared handlers are stateless D1 queries only", () => {
    const shared = hashes(sharedHandlers);
    expect(shared.has("list-recent-vibes")).toBe(true);
    expect(shared.has("list-ownerHandle-appSlug")).toBe(true);
    expect(shared.has("ensure-app-settings")).toBe(true);
    expect(shared.has("ensure-user-settings")).toBe(true);
    expect(shared.has("list-models")).toBe(true);
    expect(shared.has("get-app-by-fsid")).toBe(true);

    expect(shared.has("put-doc")).toBe(false);
    expect(shared.has("open-chat-handler")).toBe(false);
  });
});
