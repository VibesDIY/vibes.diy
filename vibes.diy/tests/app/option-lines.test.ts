import { describe, it, expect } from "vitest";
import { parseOptionLines } from "../../pkg/app/utils/option-lines.js";

describe("parseOptionLines", () => {
  it("returns prose only when no marker is present", () => {
    const r = parseOptionLines("This is just prose.\nNo options here.");
    expect(r.prose).toBe("This is just prose.\nNo options here.");
    expect(r.options).toEqual([]);
  });

  it("extracts a trailing options group and removes it from the prose", () => {
    const text = ["What's the vibe?", "", "▸ Calm and focused", "▸ Playful and weird", "▸ That's enough — let's build it!"].join("\n");
    const r = parseOptionLines(text);
    expect(r.prose).toBe(["What's the vibe?", ""].join("\n"));
    expect(r.options).toEqual(["Calm and focused", "Playful and weird", "That's enough — let's build it!"]);
  });

  it("ignores partial trailing lines (still streaming)", () => {
    // Last line is a marker but the message isn't terminated by a newline,
    // so we treat it as in-progress and leave it in the prose.
    const r = parseOptionLines("Question?\n\n▸ Option A\n▸ Option B (partia");
    expect(r.options).toEqual(["Option A"]);
    expect(r.prose.endsWith("▸ Option B (partia")).toBe(true);
  });

  it("trims whitespace around markers", () => {
    const r = parseOptionLines("Q?\n\n▸   Spaced answer  ");
    expect(r.options).toEqual(["Spaced answer"]);
  });

  it("extracts an inline ▸ option from the same line as the question", () => {
    // Reproduces the reported bug: the model jammed the escape hatch onto
    // the question line. All four options should render as buttons.
    const text = [
      "What's missing from the notes list experience? ▸ I'm done for now",
      "▸ Timestamps — show when each note was created",
      "▸ Edit in place — click a note to revise it",
      "▸ Priority tags — mark notes as urgent, normal, or low.",
    ].join("\n");
    const r = parseOptionLines(text);
    expect(r.options).toEqual([
      "I'm done for now",
      "Timestamps — show when each note was created",
      "Edit in place — click a note to revise it",
      "Priority tags — mark notes as urgent, normal, or low.",
    ]);
    expect(r.prose).toBe("What's missing from the notes list experience?");
  });

  it("extracts a single inline ▸ option when no other options follow", () => {
    // Model emitted only the escape hatch and put it inline.
    const r = parseOptionLines("Alright, done! ▸ I'm done for now\n");
    expect(r.options).toEqual(["I'm done for now"]);
    expect(r.prose.trim()).toBe("Alright, done!");
  });

  it("does not split an inline marker mid-stream when no trailing newline and no other options", () => {
    // Streaming: the inline option ends in a letter, no trailing newline,
    // no full-line options elsewhere. Defer the split to avoid flicker —
    // the next chunk may complete the word.
    const r = parseOptionLines("Alright, done! ▸ I'm done for no");
    expect(r.options).toEqual([]);
    expect(r.prose).toBe("Alright, done! ▸ I'm done for no");
  });

  it("extracts multiple inline ▸ markers from the same line", () => {
    // Pathological but parseable: model puts every option inline on one line.
    const r = parseOptionLines("Question? ▸ Option A ▸ Option B ▸ I'm done for now\n");
    expect(r.options).toEqual(["Option A", "Option B", "I'm done for now"]);
    expect(r.prose.trim()).toBe("Question?");
  });

  it("extracts the final ▸ option when streaming is false even if the line ends in a letter", () => {
    // Real-world bug: model emits final option without trailing newline, last char is a letter,
    // and the existing streaming guard incorrectly drops it. With streaming: false (message
    // is settled), the parser should include it.
    const text = [
      "What part of the app needs to feel better?",
      "▸ The task list — I want to filter by priority",
      "▸ The completed tasks — I want to hide or archive them",
      "▸ The AI suggestions — show a preview before saving",
      "▸ I'm done for now",
    ].join("\n");
    const r = parseOptionLines(text, { streaming: false });
    expect(r.options).toEqual([
      "The task list — I want to filter by priority",
      "The completed tasks — I want to hide or archive them",
      "The AI suggestions — show a preview before saving",
      "I'm done for now",
    ]);
    expect(r.prose.trim()).toBe("What part of the app needs to feel better?");
  });

  it("still defers the partial final marker when streaming is true (default)", () => {
    // Default streaming=true preserves the existing flicker guard. The mid-word partial marker
    // is held back; the completed earlier marker is extracted.
    const r = parseOptionLines("Question?\n\n▸ Option A\n▸ Option B (partia");
    expect(r.options).toEqual(["Option A"]);
    expect(r.prose.endsWith("▸ Option B (partia")).toBe(true);
  });

  it("extracts options when text has a trailing newline (settled message)", () => {
    // Regression: lines.split("\\n") adds a terminal empty string when text ends
    // with \\n. The backward scan must skip past trailing blanks to reach the
    // marker lines. Reproduces the charliecreates review finding.
    const r = parseOptionLines("Q?\n▸ Option A\n▸ I'm done for now\n", { streaming: false });
    expect(r.options).toEqual(["Option A", "I'm done for now"]);
    expect(r.prose.trim()).toBe("Q?");
  });

  it("extracts options when text has a trailing newline (streaming, last marker is complete)", () => {
    // Same trailing-newline shape but with streaming: true. The final marker
    // line is the actual last line (not the empty trailing one), and since it
    // is terminated by \\n the streaming guard should NOT fire.
    const r = parseOptionLines("Q?\n▸ Option A\n▸ I'm done for now\n");
    expect(r.options).toEqual(["Option A", "I'm done for now"]);
    expect(r.prose.trim()).toBe("Q?");
  });
});
