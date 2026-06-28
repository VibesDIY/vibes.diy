import React from "react";
import { isToplevelLine, type ToplevelLineMsg } from "@vibes.diy/call-ai-v2";
import type { PromptBlock } from "../routes/chat/prompt-state.js";

/** Card-body view shown while an in-place generation streams (pre/at first code
 *  block): a spinner + count summary, then the latest block's toplevel narration
 *  lines. Presentational — driven entirely by props from useInVibeGeneration. */
export function GenerationStreamView({
  blocks,
  messages,
  lines,
}: {
  readonly blocks: readonly PromptBlock[];
  readonly messages: number;
  readonly lines: number;
}) {
  const last = blocks[blocks.length - 1];
  const narration = (last?.msgs ?? []).filter((m): m is ToplevelLineMsg => isToplevelLine(m)).map((m) => m.line);
  return (
    <div className="text-sm" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        className="text-light-secondary dark:text-dark-secondary"
        style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
      >
        <span aria-hidden className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <span>
          building your app… · {messages} msgs · ~{lines} lines
        </span>
      </div>
      {narration.map((line, i) => (
        <span key={`${i}-${line}`} className="text-light-secondary dark:text-dark-secondary">
          ▸ {line}
        </span>
      ))}
    </div>
  );
}

export default GenerationStreamView;
