import React from "react";
import { render, screen, waitFor, fireEvent, act, cleanup, within } from "@testing-library/react";
import type { ResRecentVibesItem } from "@vibes.diy/api-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecentVibes } from "~/vibes.diy/app/components/RecentVibes.js";
import { setTestAuth, setTestUser } from "./clerk-test-mock.js";
import { vibesWrapper } from "./vibes-provider-harness.js";

const mockListRecentVibes = vi.fn();
const mockSetUnpublish = vi.fn();
const mockSharedApi = {
  listRecentVibes: mockListRecentVibes,
  setUnpublish: mockSetUnpublish,
};

function ok<T>(value: T) {
  return { isOk: () => true, isErr: () => false, Ok: () => value, Err: () => ({ message: "unexpected" }) };
}

function err(message: string) {
  return { isOk: () => false, isErr: () => true, Ok: () => undefined, Err: () => ({ message }) };
}

function makeItem(appSlug: string, extra: Partial<ResRecentVibesItem> = {}): ResRecentVibesItem {
  return { ownerHandle: "alice", appSlug, title: appSlug, updated: "2026-01-01T00:00:00.000Z", ...extra };
}

function renderSidebar() {
  return render(<RecentVibes />, { wrapper: vibesWrapper({ sharedApi: mockSharedApi }) });
}

/**
 * Stateful backing store so listRecentVibes reflects a prior setUnpublish —
 * mirrors the real server, which returns the row already tombstoned on the
 * refetch that fires after a successful delete.
 */
function withStore(initial: ResRecentVibesItem[]) {
  let items = initial;
  mockListRecentVibes.mockImplementation(async () => ok({ items, nextCursor: undefined }));
  mockSetUnpublish.mockImplementation(async ({ ownerHandle, appSlug }: { ownerHandle: string; appSlug: string }) => {
    const unpublishedAt = "2026-02-02T00:00:00.000Z";
    items = items.map((i) => (i.appSlug === appSlug ? { ...i, unpublishedAt } : i));
    return ok({ ownerHandle, appSlug, unpublishedAt, previousUnpublishedAt: "" });
  });
}

async function openDeleteModal() {
  fireEvent.click(screen.getAllByRole("button", { name: "Vibe actions" })[0]);
  fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
  expect(screen.getByRole("dialog", { name: /confirm delete/i })).toBeTruthy();
}

describe("RecentVibes delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTestAuth({ isLoaded: true, isSignedIn: true });
    setTestUser({ id: "user-1" });
  });

  // This project runs with isolate:false and globals off, so RTL's automatic
  // afterEach(cleanup) is not registered — unmount explicitly to stop DOM from
  // one test bleeding into the next.
  afterEach(() => {
    cleanup();
  });

  it("deletes an owned vibe via setUnpublish and removes it from the list", async () => {
    withStore([makeItem("alpha"), makeItem("beta")]);

    renderSidebar();
    await waitFor(() => expect(screen.getByText("alpha")).toBeTruthy());

    await openDeleteModal();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    });

    expect(mockSetUnpublish).toHaveBeenCalledWith({ ownerHandle: "alice", appSlug: "alpha", unpublish: true });
    await waitFor(() => expect(screen.queryByText("alpha")).toBeNull());
    expect(screen.getByText("beta")).toBeTruthy();
  });

  it("keeps the row and surfaces an error when the delete fails", async () => {
    withStore([makeItem("alpha")]);
    mockSetUnpublish.mockResolvedValue(err("network down"));

    renderSidebar();
    await waitFor(() => expect(screen.getByText("alpha")).toBeTruthy());

    await openDeleteModal();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    });

    // Error is surfaced and the modal stays open for retry.
    expect(screen.getByRole("alert").textContent).toContain("network down");
    // The row is untouched — assert within the list, since the open modal also
    // renders the title.
    expect(within(screen.getByRole("list")).getByText("alpha")).toBeTruthy();
    expect(mockSetUnpublish).toHaveBeenCalledTimes(1);
  });

  it("hides already-unpublished vibes from the sidebar list", async () => {
    mockListRecentVibes.mockResolvedValue(
      ok({
        items: [makeItem("alpha"), makeItem("gone", { unpublishedAt: "2026-01-05T00:00:00.000Z" })],
        nextCursor: undefined,
      })
    );

    renderSidebar();
    await waitFor(() => expect(screen.getByText("alpha")).toBeTruthy());
    expect(screen.queryByText("gone")).toBeNull();
  });
});
