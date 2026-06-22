import { describe, expect, it } from "vitest";
import { sharedHandlers, appHandlers, chatHandlers } from "../svc/evento-handler-manifest.js";
import { chatPlaneHandlers } from "../svc/chat-msg-evento.js";

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

  it("chat plane (chatMsgEvento) excludes appHandlers — doc ops live on AppSessions (#2265 A2)", () => {
    const chatPlane = hashes(chatPlaneHandlers);
    for (const h of hashes(appHandlers)) {
      expect(chatPlane.has(h), `appHandler "${h}" must not be served by ChatSessions`).toBe(false);
    }
    // Doc writes in particular must never reach the chat plane (AccessFnDO gate).
    expect(chatPlane.has("put-doc")).toBe(false);
    expect(chatPlane.has("subscribe-docs")).toBe(false);
    // But the chat plane still serves chat streaming + shared queries.
    expect(chatPlane.has("open-chat-handler")).toBe(true);
    expect(chatPlane.has("vibe.whoAmI")).toBe(true);
    // User-scoped reads/grants that the parent app calls on chatApi must stay
    // reachable on the chat plane (they were reclassified out of appHandlers).
    // Regression guard: dropping appHandlers must not strand these callers.
    expect(chatPlane.has("list-dm-threads")).toBe(true); // DmInbox / vibe-route badge
    expect(chatPlane.has("asset-upload-grant")).toBe(true); // HandleAvatarEditor / srv-sandbox putAsset
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

  it("identity/settings/report handlers are shared, not chat (Track B re-home)", () => {
    const shared = hashes(sharedHandlers);
    const chat = hashes(chatHandlers);
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
    for (const h of reHomed) {
      expect(shared.has(h), `${h} must be a sharedHandler`).toBe(true);
      expect(chat.has(h), `${h} must NOT be a chatHandler`).toBe(false);
    }
  });
});
