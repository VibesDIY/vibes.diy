// A2 (#2265): DM message docs ride a channel-keyed AppSessions connection
// (`appApiFor("<channelUserSlug>--dm")`), not chatApi/ChatSessions — so DM
// writes leave the chat plane and DM threads get local doc-changed broadcast.
import React from "react";
import { render, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Result } from "@adviser/cement";
import { directChannelUserSlug as dmSlug } from "@vibes.diy/api-types";
import type { VibesDiyApiIface } from "@vibes.diy/api-types";
import { VibesDiyContext } from "~/vibes.diy/app/vibes-diy-provider.js";
import type { VibesDiyCtx } from "~/vibes.diy/app/vibes-diy-provider.js";
import MessageThreadRoute from "~/vibes.diy/app/routes/messages.$ownerHandleA.$ownerHandleB.js";

afterEach(() => cleanup());

function renderThread(ctx: Partial<VibesDiyCtx>) {
  return render(
    <VibesDiyContext.Provider value={ctx as VibesDiyCtx}>
      <MemoryRouter initialEntries={["/messages/alice/bob"]}>
        <Routes>
          <Route path="/messages/:ownerHandleA/:ownerHandleB" element={<MessageThreadRoute />} />
        </Routes>
      </MemoryRouter>
    </VibesDiyContext.Provider>
  );
}

describe("DM thread route connection routing", () => {
  it("builds the DM connection via appApiFor(`<channel>--dm`) and DmThread uses it", async () => {
    const queryDocs = vi.fn(async () => Result.Ok({ docs: [] }));
    const dmApiInstance = {
      queryDocs,
      putDoc: vi.fn(async () => Result.Ok({})),
      markDmRead: vi.fn(async () => Result.Ok({})),
    };
    const appApiFor = vi.fn(() => dmApiInstance as unknown as VibesDiyApiIface);
    const listHandleBindings = vi.fn(async () => Result.Ok({ items: [{ ownerHandle: "alice" }] }));

    renderThread({ chatApi: { listHandleBindings } as unknown as VibesDiyCtx["chatApi"], appApiFor });

    const expectedKey = `${dmSlug("alice", "bob")}--dm`; // _d.alice.bob--dm
    await waitFor(() => expect(appApiFor).toHaveBeenCalledWith(expectedKey));
    // DmThread loaded its messages over the AppSessions DM connection, not chatApi.
    await waitFor(() => expect(queryDocs).toHaveBeenCalled());
  });

  it("does NOT route DM doc ops to chatApi when appApiFor is absent (no stale fallback)", async () => {
    // ChatSessions no longer serves appHandlers (#2265 A2), so DM doc ops must
    // never fall back to chatApi — that would only hit the wildcard handler.
    // Without appApiFor, DmThread degrades to a no-op instead.
    const queryDocs = vi.fn(async () => Result.Ok({ docs: [] }));
    const listHandleBindings = vi.fn(async () => Result.Ok({ items: [{ ownerHandle: "alice" }] }));

    renderThread({
      chatApi: { listHandleBindings, queryDocs, markDmRead: vi.fn(async () => Result.Ok({})) } as unknown as VibesDiyCtx["chatApi"],
    });

    // Let effects flush; the DM thread must not have queried docs over chatApi.
    await waitFor(() => expect(listHandleBindings).toHaveBeenCalled());
    expect(queryDocs).not.toHaveBeenCalled();
  });
});
