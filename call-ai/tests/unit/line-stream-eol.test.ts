import { LineEvent, LineFragment } from "@vibes.diy/call-ai-base";
import { LineStreamParser, LineStreamState } from "@vibes.diy/call-ai-base";
import { expect, it } from "vitest";

it("EOL-Test", async () => {
  const so = new LineStreamParser(LineStreamState.WaitingForEOL);
  const lines = new ReadableStream<string>({
    async start(controller) {
      for (let i = 0; i < 10; i++) {
        controller.enqueue("Line " + i);
      }
      controller.enqueue("FragmentLine 1\nFragmentLine 2");
      controller.close();
    },
  });
  const reader = lines.getReader();
  const events: LineEvent[] = [];
  so.onEvent((evt) => events.push(evt));
  while (true) {
    const { done, value: chunk } = await reader.read();
    if (done) {
      break;
    }
    so.processChunk(chunk);
  }

  const fragmentEvents = events.filter((e) => e.type === "line.fragment") as LineFragment[];

  const incompleteFragments = fragmentEvents.filter((evt) => !evt.lineComplete).map((evt) => evt.fragment);
  expect(incompleteFragments).toEqual([
    "Line 0",
    "Line 1",
    "Line 2",
    "Line 3",
    "Line 4",
    "Line 5",
    "Line 6",
    "Line 7",
    "Line 8",
    "Line 9",
    "FragmentLine 2",
  ]);

  // Non-accumulating: complete fragment contains only the portion of the
  // final chunk before the newline, NOT the accumulated line
  const completeFragments = fragmentEvents.filter((evt) => evt.lineComplete).map((evt) => evt.fragment);
  expect(completeFragments).toEqual([
    "FragmentLine 1", // Only the chunk portion before \n, not accumulated
  ]);

  // Consumer accumulation example: if you need full lines, accumulate yourself
  let buffer = "";
  const fullLines: string[] = [];
  fragmentEvents.forEach((evt) => {
    buffer += evt.fragment;
    if (evt.lineComplete) {
      fullLines.push(buffer);
      buffer = "";
    }
  });
  expect(fullLines).toEqual(["Line 0Line 1Line 2Line 3Line 4Line 5Line 6Line 7Line 8Line 9FragmentLine 1"]);
});
