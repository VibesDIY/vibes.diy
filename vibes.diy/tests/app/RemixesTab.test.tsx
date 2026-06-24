import React from "react";
import { render as rtlRender, screen, cleanup, waitFor } from "@testing-library/react";
import type { NotificationRow } from "@vibes.diy/api-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RemixesTab } from "~/vibes.diy/app/components/mine/RemixesTab.js";
import { setTestAuth, setTestUser } from "./clerk-test-mock.js";
import { vibesWrapper } from "./vibes-provider-harness.js";

const mockListNotifications = vi.fn();

const render = (ui: React.ReactElement) =>
  rtlRender(ui, { wrapper: vibesWrapper({ chatApi: { listNotifications: mockListNotifications } }) });

function okList(items: NotificationRow[], nextCursor?: string) {
  return {
    isOk: () => true,
    isErr: () => false,
    Ok: () => ({ items, unreadCount: items.length, nextCursor }),
    Err: () => ({ message: "unexpected error" }),
  };
}

function makeRemix(id: string, overrides: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id,
    userId: "user-1",
    notificationType: "vibe-remixed",
    ownerHandle: "alice",
    appSlug: "cool-app",
    body: `@bob remixed your vibe cool-app`,
    actorHandle: "bob",
    targetRef: { remixOwnerHandle: "bob", remixAppSlug: "bobs-remix" },
    dedupeKey: `vibe-remixed:bob/bobs-remix-${id}`,
    created: "2026-01-01T00:00:00.000Z",
    readAt: null,
    ...overrides,
  };
}

describe("RemixesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTestAuth({ isLoaded: true, isSignedIn: true });
    setTestUser({ id: "user-1" });
  });
  afterEach(() => cleanup());

  it("queries listNotifications filtered to vibe-remixed + appSlug", async () => {
    mockListNotifications.mockResolvedValue(okList([makeRemix("a")]));
    render(<RemixesTab ownerHandle="alice" appSlug="cool-app" />);
    await waitFor(() =>
      expect(mockListNotifications).toHaveBeenCalledWith({ notificationType: "vibe-remixed", appSlug: "cool-app" })
    );
  });

  it("renders remixer handle and a link to the published remix", async () => {
    mockListNotifications.mockResolvedValue(okList([makeRemix("a")]));
    render(<RemixesTab ownerHandle="alice" appSlug="cool-app" />);

    const link = await screen.findByText("@bob");
    expect(link.closest("a")).toHaveAttribute("href", "/vibe/bob/bobs-remix");
  });

  it("shows an empty state when there are no remixes", async () => {
    mockListNotifications.mockResolvedValue(okList([]));
    render(<RemixesTab ownerHandle="alice" appSlug="cool-app" />);
    expect(await screen.findByText(/No one has remixed this vibe yet/)).toBeTruthy();
  });
});
