import { describe, it, expect } from "vitest";
import { Result } from "@adviser/cement";
import { createPromptAssetFetch, promptsPkgBaseUrl } from "@vibes.diy/api-svc";

// Post-refactor contract: prompts.ts (via `pkgBaseUrl`) hands `fetch` URLs
// that are already in the right shape — `${workspace}/@vibes.diy/prompts/<subpath>`.
// The worker's job is just to delegate to fetchAsset; no URL surgery.
const WORKSPACE = "https://test.local/vibe-pkg/";
const BASE = promptsPkgBaseUrl(WORKSPACE);

const REGISTRY: Record<string, string> = {
  [`${BASE}llms/fireproof.md`]: "FAKE-FIREPROOF",
  [`${BASE}llms/callai.md`]: "FAKE-CALLAI",
  [`${BASE}system-prompt.md`]: "FAKE-SYSTEM-PROMPT",
};

function makeFetchAsset(): (url: string) => Promise<Result<ReadableStream<Uint8Array>>> {
  return async (url) => {
    const content = REGISTRY[url];
    if (content === undefined) return Result.Err(new Error(`not found: ${url}`));
    const bytes = new TextEncoder().encode(content);
    return Result.Ok(
      new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(bytes);
          c.close();
        },
      })
    );
  };
}

describe("createPromptAssetFetch (post-pkgBaseUrl refactor)", () => {
  it("loads an llms/*.md asset by delegating to fetchAsset", async () => {
    const f = createPromptAssetFetch({ fetchAsset: makeFetchAsset() });
    const res = await f(`${BASE}llms/fireproof.md`);
    expect(res.ok).toBe(true);
    expect(await res.text()).toBe("FAKE-FIREPROOF");
  });

  it("loads system-prompt.md at the package root", async () => {
    const f = createPromptAssetFetch({ fetchAsset: makeFetchAsset() });
    const res = await f(`${BASE}system-prompt.md`);
    expect(res.ok).toBe(true);
    expect(await res.text()).toBe("FAKE-SYSTEM-PROMPT");
  });

  it("returns 500 when the asset isn't found in the workspace", async () => {
    const f = createPromptAssetFetch({ fetchAsset: makeFetchAsset() });
    const res = await f(`${BASE}does-not-exist.md`);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(500);
  });
});

describe("promptsPkgBaseUrl", () => {
  it("appends the prompts package path to the workspace URL", () => {
    expect(promptsPkgBaseUrl("https://example.test/vibe-pkg/")).toContain("@vibes.diy/prompts");
  });
});
