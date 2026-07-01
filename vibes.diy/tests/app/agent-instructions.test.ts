import { describe, expect, it } from "vitest";
import { buildAgentInstructions } from "~/vibes.diy/app/components/vibe-editor/agent-instructions.js";

describe("buildAgentInstructions", () => {
  const md = buildAgentInstructions({ ownerHandle: "jchris", appSlug: "hat-smeller" });

  it("names the vibe in the pull command with handle/app-slug and a matching --dir", () => {
    expect(md).toContain("npx vibes-diy pull jchris/hat-smeller --dir hat-smeller");
    expect(md).toContain("cd hat-smeller");
  });

  it("tells the agent about `npx vibes-diy help` as the entry point", () => {
    expect(md).toContain("npx vibes-diy help");
  });

  it("instructs the agent to run login itself (browser auto-opens; don't ask the user)", () => {
    expect(md).toContain("npx vibes-diy login");
    expect(md.toLowerCase()).toContain("do this yourself");
    expect(md.toLowerCase()).toContain("opens a browser");
    // The whole point: the agent shouldn't hand the login step back to the user.
    expect(md.toLowerCase()).toContain("ask the user to run");
  });

  it("states pull is not owner-only — anyone who can open the vibe can read its source", () => {
    expect(md.toLowerCase()).toContain("anyone who can open this vibe can pull its source");
    // ...but editing/pushing still needs an editor grant.
    expect(md.toLowerCase()).toContain("editor");
  });

  it("carries the push-back step for the same vibe", () => {
    expect(md).toContain("npx vibes-diy push --vibe jchris/hat-smeller");
  });

  it("uses the human title in the heading when provided, else the slug", () => {
    expect(buildAgentInstructions({ ownerHandle: "a", appSlug: "b", title: "My Cool App" })).toContain(
      '# Edit "My Cool App" with your coding agent'
    );
    expect(md).toContain('# Edit "hat-smeller" with your coding agent');
  });
});
