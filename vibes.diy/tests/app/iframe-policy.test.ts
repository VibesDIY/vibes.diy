import { describe, expect, it } from "vitest";
import {
  RUNTIME_PREVIEW_IFRAME_ALLOW,
  RUNTIME_PREVIEW_IFRAME_ALLOW_TOKENS,
  RUNTIME_PREVIEW_IFRAME_SANDBOX,
  RUNTIME_PREVIEW_IFRAME_SANDBOX_TOKENS,
} from "../../pkg/app/lib/iframe-policy.js";

const splitAllowTokens = (value: string): string[] =>
  value
    .split(";")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

const splitSandboxTokens = (value: string): string[] =>
  value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

describe("runtime/preview iframe policy", () => {
  it("includes autoplay/encrypted-media while preserving camera/microphone", () => {
    const allowTokens = splitAllowTokens(RUNTIME_PREVIEW_IFRAME_ALLOW);

    expect(allowTokens).toEqual([
      "autoplay",
      "camera",
      "encrypted-media",
      "microphone",
    ]);
    expect(allowTokens).toEqual([...RUNTIME_PREVIEW_IFRAME_ALLOW_TOKENS]);
  });

  it("retains popup sandbox delegation tokens", () => {
    const sandboxTokens = splitSandboxTokens(RUNTIME_PREVIEW_IFRAME_SANDBOX);

    expect(sandboxTokens).toEqual(
      expect.arrayContaining([
        "allow-popups",
        "allow-popups-to-escape-sandbox",
      ])
    );
    expect(sandboxTokens).toEqual([...RUNTIME_PREVIEW_IFRAME_SANDBOX_TOKENS]);
  });
});
