import React from "react";
import { render as rtlRender, screen, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { vibesWrapper } from "./vibes-provider-harness.js";

// Inject the VibesDiy context via the real provider instead of mocking it.
const render = (ui: React.ReactElement, options?: Parameters<typeof rtlRender>[1]) =>
  rtlRender(ui, { wrapper: vibesWrapper({ chatApi: { getAppByFsId } }), ...options });

// These tests cover the app detail panel (right-hand drawer) rendered by
// MyAppsSection. They assert the regression fix for #2011: the panel must show
// a REAL creator handle (never the old hardcoded "@amber-macias"), must not
// render the "(placeholder copy)" description, and must not render the no-op
// "Unsubscribe" button.

// ---- dependency mocks (must be declared before importing the component) ----
// react-router-dom is provided for real by MemoryRouter in vibesWrapper.

// Use the real @vibes.diy/base design system (no mock) — partial base mocks
// poison files that import other base exports under isolate:false.

// Spread the real module so other exports (e.g. notifyRecentVibesChanged) stay
// available to files that import them; only override the hook itself.
vi.mock("~/vibes.diy/app/hooks/useRecentVibes.js", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useRecentVibes: () => ({ items: [], loadMore: vi.fn(), hasMore: false, loading: false }),
}));

const getAppByFsId = vi.fn();
// VibesDiy context is injected via vibesWrapper (see local render above).

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

  it("clears a previous app's display name when switching to one without it", async () => {
    // First app resolves with a display name.
    getAppByFsId.mockResolvedValueOnce(okResult({ meta: [], ownerDisplayName: "Ada Lovelace" }));
    const first = makeItem({ ownerHandle: "ada", appSlug: "app-e1" });
    const { rerender } = render(
      <AppDetailPanel item={first} appHostBaseUrl="https://example.com" onClose={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByText(/Created by/)).toHaveTextContent("Created by Ada Lovelace"));

    // Switch to a different, uncached app whose response carries no display name.
    getAppByFsId.mockResolvedValueOnce(okResult({ meta: [] }));
    const second = makeItem({ ownerHandle: "grace", appSlug: "app-e2" });
    rerender(<AppDetailPanel item={second} appHostBaseUrl="https://example.com" onClose={vi.fn()} />);

    // The old name must never show — the slug fallback takes over immediately
    // and stays after the second fetch resolves with no display name.
    expect(screen.queryByText(/Ada Lovelace/)).toBeNull();
    expect(screen.getByText(/Created by/)).toHaveTextContent("Created by @grace");
    await waitFor(() => expect(getAppByFsId).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/Created by/)).toHaveTextContent("Created by @grace");
  });

  it("still renders the Enter link to the chat route", () => {
    getAppByFsId.mockResolvedValue(okResult({ meta: [] }));
    const item = makeItem({ ownerHandle: "owner-d", appSlug: "app-d" });

    render(<AppDetailPanel item={item} appHostBaseUrl="https://example.com" onClose={vi.fn()} />);

    expect(screen.getByText("Enter").closest("a")).toHaveAttribute("href", "/chat/owner-d/app-d");
  });
});
