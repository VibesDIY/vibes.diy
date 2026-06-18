import React from "react";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

// These tests cover the app detail panel (right-hand drawer) rendered by
// MyAppsSection. They assert the regression fix for #2011: the panel must show
// a REAL creator handle (never the old hardcoded "@amber-macias"), must not
// render the "(placeholder copy)" description, and must not render the no-op
// "Unsubscribe" button.

// ---- dependency mocks (must be declared before importing the component) ----

vi.mock("react-router-dom", () => ({
  Link: ({ to, children, onClick }: { to: string; children?: React.ReactNode; onClick?: () => void }) => (
    <a href={to} onClick={onClick}>
      {children}
    </a>
  ),
}));

vi.mock("@vibes.diy/base", () => ({
  TexturedPattern: () => null,
}));

vi.mock("~/vibes.diy/app/hooks/useRecentVibes.js", () => ({
  useRecentVibes: () => ({ items: [], loadMore: vi.fn(), hasMore: false, loading: false }),
}));

const getAppByFsId = vi.fn();
vi.mock("~/vibes.diy/app/vibes-diy-provider.js", () => ({
  useVibesDiy: () => ({ chatApi: { getAppByFsId } }),
}));

// Import the component AFTER all vi.mock() calls.
import { AppDetailPanel } from "~/vibes.diy/app/components/MyAppsSection.js";

// AppDetailPanel only reads ownerHandle/appSlug/title/icon off the item.
function makeItem(overrides: Record<string, unknown> = {}) {
  return { ownerHandle: "jane-doe", appSlug: "cool-app", title: "Cool App", icon: undefined, ...overrides } as never;
}

function okResult(value: Record<string, unknown>) {
  return { isErr: () => false, Ok: () => value };
}

describe("AppDetailPanel (issue #2011)", () => {
  afterEach(() => {
    cleanup();
    getAppByFsId.mockReset();
  });

  // The detail panel caches fetched data at module scope keyed by
  // `${ownerHandle}/${appSlug}`, so each test uses a distinct app to stay
  // independent.

  it("renders the slug handle immediately, then upgrades to the owner display name", async () => {
    getAppByFsId.mockResolvedValue(okResult({ meta: [], ownerDisplayName: "Jane Doe" }));
    const item = makeItem({ ownerHandle: "jane-doe", appSlug: "app-a" });

    render(<AppDetailPanel item={item} appHostBaseUrl="https://example.com" onClose={vi.fn()} />);

    // Synchronously known from the list row — never the old mock handle.
    expect(screen.getByText(/Created by/)).toHaveTextContent("Created by @jane-doe");
    expect(screen.queryByText(/amber-macias/)).toBeNull();

    // Upgrades to the fetched display name.
    await waitFor(() => expect(screen.getByText(/Created by/)).toHaveTextContent("Created by Jane Doe"));
  });

  it("falls back to the slug handle when no display name is returned", async () => {
    getAppByFsId.mockResolvedValue(okResult({ meta: [] }));
    const item = makeItem({ ownerHandle: "no-name", appSlug: "app-b" });

    render(<AppDetailPanel item={item} appHostBaseUrl="https://example.com" onClose={vi.fn()} />);

    await waitFor(() => expect(getAppByFsId).toHaveBeenCalled());
    expect(screen.getByText(/Created by/)).toHaveTextContent("Created by @no-name");
  });

  it("does not render the placeholder description or the no-op Unsubscribe button", () => {
    getAppByFsId.mockResolvedValue(okResult({ meta: [] }));
    const item = makeItem({ ownerHandle: "owner-c", appSlug: "app-c" });

    render(<AppDetailPanel item={item} appHostBaseUrl="https://example.com" onClose={vi.fn()} />);

    expect(screen.queryByText(/placeholder copy/)).toBeNull();
    expect(screen.queryByText(/Unsubscribe/)).toBeNull();
  });

  it("still renders the Enter link to the chat route", () => {
    getAppByFsId.mockResolvedValue(okResult({ meta: [] }));
    const item = makeItem({ ownerHandle: "owner-d", appSlug: "app-d" });

    render(<AppDetailPanel item={item} appHostBaseUrl="https://example.com" onClose={vi.fn()} />);

    expect(screen.getByText("Enter").closest("a")).toHaveAttribute("href", "/chat/owner-d/app-d");
  });
});
