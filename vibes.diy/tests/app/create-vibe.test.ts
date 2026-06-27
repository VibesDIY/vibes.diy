import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildCreateVibeUrl,
  createVibe,
  resolveBuilderOriginFrom,
  VIBES_DIY_BUILDER_URL,
  CREATE_VIBE_SAFE_URL_LENGTH,
} from "@vibes.diy/vibe-runtime";

// Mirrors how routes/chat/prompt.tsx reads the param: standard base64 over
// UTF-8 (sthis.txt.base64.decode). Decode locally so the test is self-contained.
function decodeBase64Utf8(encoded: string): string {
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildCreateVibeUrl", () => {
  it("targets /chat/prompt with a prompt64 param on the builder origin", () => {
    const url = new URL(buildCreateVibeUrl("hello world"));
    expect(url.origin).toBe(new URL(VIBES_DIY_BUILDER_URL).origin);
    expect(url.pathname).toBe("/chat/prompt");
    expect(url.searchParams.get("prompt64")).toBeTruthy();
  });

  it("round-trips through the builder's standard-base64 decoder", () => {
    const prompt = 'Build a pitch deck for Acme — émojis 🚀, unicode ñ, and "quotes".';
    const url = new URL(buildCreateVibeUrl(prompt));
    const encoded = url.searchParams.get("prompt64");
    expect(encoded).not.toBeNull();
    expect(decodeBase64Utf8(encoded as string)).toBe(prompt);
  });

  it("resolves to the prod builder origin in the test (non-preview) context", () => {
    // The vitest browser runner executes inside a non-preview iframe, so the
    // resolver falls back to the public domain rather than leaking the host.
    expect(new URL(buildCreateVibeUrl("x")).origin).toBe(new URL(VIBES_DIY_BUILDER_URL).origin);
  });
});

describe("resolveBuilderOriginFrom", () => {
  it("adopts a PR-preview origin", () => {
    expect(resolveBuilderOriginFrom("https://pr-2694-vibes-diy-v2.jchris.workers.dev")).toBe(
      "https://pr-2694-vibes-diy-v2.jchris.workers.dev"
    );
  });

  it("routes prod, cli, dev, sandbox, stable-entry, third-party, and unknown to vibes.diy", () => {
    for (const origin of [
      "https://vibes.diy",
      "https://cli-v2.vibesdiy.net",
      "https://dev-v2.vibesdiy.net",
      "https://prod-v2.vibesdiy.net",
      "https://app--user.dev-v2.vibesdiy.net", // sandbox subdomain (the iframe's own origin)
      "https://example.com", // third-party embed
      "http://pr-1-vibes-diy-v2.jchris.workers.dev", // not https → not adopted
      undefined,
    ]) {
      expect(resolveBuilderOriginFrom(origin)).toBe(VIBES_DIY_BUILDER_URL);
    }
  });
});

describe("createVibe", () => {
  it("opens the hand-off URL in a new tab and returns the window", () => {
    const fakeWin = {} as Window;
    const openSpy = vi.spyOn(window, "open").mockReturnValue(fakeWin);

    const result = createVibe("make me a thing");

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [openedUrl, target] = openSpy.mock.calls[0];
    expect(target).toBe("_blank");
    expect(String(openedUrl)).toBe(buildCreateVibeUrl("make me a thing"));
    expect(result).toBe(fakeWin);
  });

  it("returns null and warns when the popup is blocked", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = createVibe("blocked");

    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("popup blocked"));
  });

  it("warns when the encoded URL exceeds the safe length threshold", () => {
    vi.spyOn(window, "open").mockReturnValue({} as Window);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    createVibe("a".repeat(CREATE_VIBE_SAFE_URL_LENGTH + 100));

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("safe threshold"));
  });
});
