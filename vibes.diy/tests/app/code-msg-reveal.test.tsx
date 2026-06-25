import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { CodeMsg } from "../../pkg/app/components/MessageList.js";

const begin = (reveal?: "typewriter") => ({
  type: "block.code.begin" as const,
  sectionId: "s1",
  lang: "jsx",
  path: "/App.jsx",
  blockId: "b1",
  streamId: "p1",
  seq: 0,
  blockNr: 0,
  timestamp: new Date(),
  ...(reveal ? { reveal } : {}),
});
const lines = Array.from({ length: 40 }, (_, i) => ({
  type: "block.code.line" as const,
  sectionId: "s1",
  lang: "jsx",
  line: `line ${i}`,
  lineNr: i,
  blockId: "b1",
  streamId: "p1",
  seq: i + 1,
  blockNr: 0,
  timestamp: new Date(),
}));

describe("CodeMsg typewriter reveal", () => {
  it("reveals a partial subset while a gated card is streaming", async () => {
    render(<CodeMsg begin={begin("typewriter")} lines={lines} isStreaming onClick={() => {}} />);
    // Early in the reveal, far fewer than all 40 lines are visible.
    await waitFor(() => {
      const shown = screen.queryAllByText(/^line \d+$/).length;
      expect(shown).toBeGreaterThan(0);
      expect(shown).toBeLessThan(lines.length);
    });
  });

  it("does NOT animate an ungated card (no reveal marker)", () => {
    render(<CodeMsg begin={begin()} lines={lines} isStreaming onClick={() => {}} />);
    // Ungated cards keep the existing collapsed summary (no expanded line list).
    expect(screen.queryByText("line 39")).toBeNull();
  });
});
