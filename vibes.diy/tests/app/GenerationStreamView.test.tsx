import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { GenerationStreamView } from "~/vibes.diy/app/components/GenerationStreamView.js";

const block = {
  msgs: [
    {
      type: "block.toplevel.line",
      line: "laying out a 4x4 grid",
      blockId: "b1",
      streamId: "s",
      seq: 1,
      sectionId: "sec1",
      lineNr: 0,
      blockNr: 0,
      timestamp: new Date(),
    },
    {
      type: "block.toplevel.line",
      line: "wiring the sound",
      blockId: "b1",
      streamId: "s",
      seq: 2,
      sectionId: "sec1",
      lineNr: 1,
      blockNr: 0,
      timestamp: new Date(),
    },
  ],
} as never;

describe("GenerationStreamView", () => {
  it("renders the latest block's toplevel narration lines", () => {
    const { getByText } = render(<GenerationStreamView blocks={[block]} messages={1} lines={48} />);
    expect(getByText(/laying out a 4x4 grid/)).toBeTruthy();
    expect(getByText(/wiring the sound/)).toBeTruthy();
  });

  it("renders the count summary", () => {
    const { getAllByText } = render(<GenerationStreamView blocks={[block]} messages={1} lines={48} />);
    expect(getAllByText(/1 msgs · ~48 lines/)).toBeTruthy();
  });
});
