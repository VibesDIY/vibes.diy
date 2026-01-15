import { LineEvent } from "@vibes.diy/call-ai-base";
import { LineStreamParser, LineStreamState } from "@vibes.diy/call-ai-base";
import { expect, it } from "vitest";

it("Bracket-Test", async () => {
  const so = new LineStreamParser(LineStreamState.WaitForOpeningCurlyBracket);
  const lines = new ReadableStream<string>({
    async start(controller) {
      for (let i = 0; i < 2; i++) {
        controller.enqueue("{ Begin " + i);
        controller.enqueue("  Middle " + i);
        controller.enqueue("  End " + i + " }");
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
  expect(events).toEqual([
    { type: "line.bracket.open" },
    { type: "line.content", block: 0, content: " Begin 0", seq: 0, seqStyle: "first" },
    { type: "line.content", block: 0, content: "  Middle 0", seq: 1, seqStyle: "middle" },
    { type: "line.content", block: 0, content: "  End 0 ", seq: 2, seqStyle: "last" },
    { type: "line.bracket.close" },
    { type: "line.bracket.open" },
    { type: "line.content", block: 1, content: " Begin 1", seq: 0, seqStyle: "first" },
    { type: "line.content", block: 1, content: "  Middle 1", seq: 1, seqStyle: "middle" },
    { type: "line.content", block: 1, content: "  End 1 ", seq: 2, seqStyle: "last" },
    { type: "line.bracket.close" },
  ]);
});

it("Empty-Content-Test - should emit empty middle events", async () => {
  const so = new LineStreamParser(LineStreamState.WaitForOpeningCurlyBracket);
  const lines = new ReadableStream<string>({
    async start(controller) {
      // Simple case: { content } where we send chunks that create empty middle
      controller.enqueue("{ a"); // open + first with "a"
      controller.enqueue(""); // empty chunk - should emit empty middle with seq 1
      controller.enqueue(" b }"); // last with " b"
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
  // Empty middle events should NOT be filtered out
  // Expected: open, first(" a"), middle(""), last(" b "), close
  expect(events).toEqual([
    { type: "line.bracket.open" },
    { type: "line.content", seqStyle: "first", block: 0, seq: 0, content: " a" },
    { type: "line.content", seqStyle: "middle", block: 0, seq: 1, content: "" },
    { type: "line.content", seqStyle: "last", block: 0, seq: 2, content: " b " },
    { type: "line.bracket.close" },
  ]);
});
