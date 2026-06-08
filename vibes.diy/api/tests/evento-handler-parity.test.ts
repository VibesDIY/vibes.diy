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
    expect(all.has("list-request-grants")).toBe(true);
    expect(all.has("vibe.whoAmI")).toBe(true);
  });

  it("app handlers are doc/notification ops only", () => {
    const app = hashes(appHandlers);
    expect(app.has("put-doc")).toBe(true);
    expect(app.has("subscribe-docs")).toBe(true);

    expect(app.has("open-chat-handler")).toBe(false);
    expect(app.has("list-request-grants")).toBe(false);
    expect(app.has("vibe.whoAmI")).toBe(false);
  });

  it("chat handlers are chat-streaming ops only", () => {
    const chat = hashes(chatHandlers);
    expect(chat.has("open-chat-handler")).toBe(true);
    expect(chat.has("prompt-chat-section-handler")).toBe(true);
    expect(chat.has("ensure-appSlug-item")).toBe(true);

    expect(chat.has("put-doc")).toBe(false);
    expect(chat.has("list-request-grants")).toBe(false);
  });

  it("shared handlers include grants/membership (transition: called from parent app on chat connection)", () => {
    const shared = hashes(sharedHandlers);
    expect(shared.has("list-request-grants")).toBe(true);
    expect(shared.has("vibe.whoAmI")).toBe(true);
    expect(shared.has("create-invite")).toBe(true);
    expect(shared.has("list-members")).toBe(true);

    expect(shared.has("put-doc")).toBe(false);
    expect(shared.has("open-chat-handler")).toBe(false);
  });
});
