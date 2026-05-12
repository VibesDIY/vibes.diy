import { describe, expect, it } from "vitest";
import { formatDryRunAsText } from "./edit-cmd.js";

describe("formatDryRunAsText", () => {
  it("renders role headers and concatenated text content", () => {
    const out = formatDryRunAsText({
      model: "anthropic/claude-sonnet-4-6",
      messages: [
        { role: "system", content: [{ type: "text", text: "you are helpful" }] },
        { role: "user", content: [{ type: "text", text: "make a counter" }] },
        {
          role: "assistant",
          content: [
            { type: "text", text: "ok" },
            { type: "text", text: " here you go" },
          ],
        },
      ],
    });
    expect(out).toContain("=== SYSTEM ===");
    expect(out).toContain("you are helpful");
    expect(out).toContain("=== USER ===");
    expect(out).toContain("make a counter");
    expect(out).toContain("=== ASSISTANT ===");
    expect(out).toContain("ok here you go");
    expect(out.indexOf("=== SYSTEM ===")).toBeLessThan(out.indexOf("=== USER ==="));
    expect(out.indexOf("=== USER ===")).toBeLessThan(out.indexOf("=== ASSISTANT ==="));
  });

  it("renders non-text parts as [type] placeholders", () => {
    const out = formatDryRunAsText({
      model: "m",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "look:" },
            { type: "image_url", image_url: { url: "data:image/png;base64,..." } },
          ],
        },
      ],
    });
    expect(out).toContain("look:");
    expect(out).toContain("[image_url]");
  });
});
