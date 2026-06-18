import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

// Regression coverage: on /chat/prompt?prompt64=INPUT the decoded INPUT must be
// shown immediately as the initial user message (handed to <Chat initialPrompt>)
// while the "Preparing AI Session…" overlay is still up — not only after the
// server round-trips the prompt back.

const authState: { isSignedIn: boolean; isLoaded: boolean } = {
  isSignedIn: true,
  isLoaded: true,
};

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

vi.mock("@clerk/react", () => ({
  useAuth: () => authState,
}));

vi.mock("~/vibes.diy/app/vibes-diy-provider.js", () => ({
  useVibesDiy: () => ({
    // Decode just strips the "b64:" prefix our encode/decode stub uses.
    sthis: { txt: { base64: { decode: (s: string) => s.replace(/^b64:/, "") } } },
    // getTokenClaims never resolves so the open-chat effect stays parked and
    // doesn't navigate away during the assertion window.
    chatApi: { getTokenClaims: () => new Promise(() => {}) },
  }),
}));

vi.mock("~/vibes.diy/app/hooks/useRecentVibes.js", () => ({
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
  afterEach(() => {
    cleanup();
    currentSearch = new URLSearchParams();
    sessionStorage.removeItem(PENDING_PROMPT_KEY);
    authState.isSignedIn = true;
    authState.isLoaded = true;
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
