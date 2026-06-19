import React from "react";
import { render as rtlRender, screen, cleanup } from "@testing-library/react";
import { vibesWrapper } from "./vibes-provider-harness.js";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setTestAuth } from "./clerk-test-mock.js";

// Regression coverage: on /chat/prompt?prompt64=INPUT the decoded INPUT must be
// shown immediately as the initial user message (handed to <Chat initialPrompt>)
// while the "Preparing AI Session…" overlay is still up — not only after the
// server round-trips the prompt back.

// Mutable search params + sessionStorage fallback per test.
let currentSearch = new URLSearchParams();

vi.mock("react-router", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearchParams: () => [currentSearch, vi.fn()] as const,
  };
});

// Clerk auth comes from the shared singleton mock (clerk-test-mock.ts).

// Inject the VibesDiy context via the real provider instead of mocking it.
// decode just strips the "b64:" prefix our encode/decode stub uses; getTokenClaims
// never resolves so the open-chat effect stays parked during the assertion window.
const render = (ui: React.ReactElement, options?: Parameters<typeof rtlRender>[1]) =>
  rtlRender(ui, {
    wrapper: vibesWrapper({
      sthis: { txt: { base64: { decode: (s: string) => s.replace(/^b64:/, "") } } },
      chatApi: { getTokenClaims: () => new Promise(() => undefined) },
    }),
    ...options,
  });

// Spread the real module so other exports (e.g. the useRecentVibes hook) stay
// available to files that import them; only override the notifier.
vi.mock("~/vibes.diy/app/hooks/useRecentVibes.js", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  notifyRecentVibesChanged: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  toast: { error: vi.fn() },
}));

// Stub <Chat> so we can read the props the route hands it.
vi.mock("~/vibes.diy/app/routes/chat/chat.$ownerHandle.$appSlug.js", () => ({
  Chat: ({ inConstruction, initialPrompt }: { inConstruction?: boolean; initialPrompt?: string }) => (
    <div data-testid="chat" data-in-construction={inConstruction ? "true" : "false"} data-initial-prompt={initialPrompt ?? ""} />
  ),
}));

import ChatPrompt from "~/vibes.diy/app/routes/chat/prompt.js";

const PENDING_PROMPT_KEY = "vibes.pendingPrompt";

describe("/chat/prompt initial user message", () => {
  beforeEach(() => {
    setTestAuth({ isSignedIn: true, isLoaded: true });
  });

  afterEach(() => {
    cleanup();
    currentSearch = new URLSearchParams();
    sessionStorage.removeItem(PENDING_PROMPT_KEY);
  });

  it("passes the decoded prompt64 to Chat as initialPrompt", () => {
    currentSearch = new URLSearchParams({ prompt64: "b64:make me a todo app" });
    render(<ChatPrompt />);
    const chat = screen.getByTestId("chat");
    expect(chat.getAttribute("data-initial-prompt")).toBe("make me a todo app");
    expect(chat.getAttribute("data-in-construction")).toBe("true");
    expect(screen.getByText("Preparing AI Session…")).toBeTruthy();
  });

  it("falls back to the sessionStorage pending prompt when prompt64 is absent", () => {
    sessionStorage.setItem(PENDING_PROMPT_KEY, "remembered prompt");
    render(<ChatPrompt />);
    expect(screen.getByTestId("chat").getAttribute("data-initial-prompt")).toBe("remembered prompt");
  });

  it("shows no overlay and no initial prompt when there is nothing to send", () => {
    render(<ChatPrompt />);
    expect(screen.getByTestId("chat").getAttribute("data-initial-prompt")).toBe("");
    expect(screen.queryByText("Preparing AI Session…")).toBeNull();
  });
});
