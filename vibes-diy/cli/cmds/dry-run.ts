import { isSectionEvent, isPromptDryRunPayload } from "@vibes.diy/api-types";
import type { ChatMessage } from "@vibes.diy/call-ai-v2";
import type { SectionEvent, PromptDryRunPayload } from "@vibes.diy/api-types";

// Shared dry-run payload helpers used by both `generate --dry-run` and
// `edit --dry-run`. Lives in a neutral module so neither command imports the
// other's production behavior.

export interface DryRunPayload {
  readonly model: string;
  readonly messages: ChatMessage[];
}

// Read the section stream until a prompt.dry-run-payload block for `chatId`
// arrives, or until the stream closes / msg cap is hit. The server emits
// exactly one such block per dryRun:true request (framed by block-begin
// and block-end), so a small msg cap is enough.
export async function readDryRunPayloadFromStream(
  stream: ReadableStream<unknown>,
  chatId: string,
  maxMsgs = 32
): Promise<DryRunPayload | undefined> {
  const reader = stream.getReader();
  let seen = 0;
  try {
    while (seen < maxMsgs) {
      const { value, done } = await reader.read();
      if (done) return undefined;
      seen++;
      if (!isSectionEvent(value)) continue;
      const evt = value as SectionEvent;
      if (evt.chatId !== chatId) continue;
      for (const block of evt.blocks) {
        if (isPromptDryRunPayload(block)) {
          const b = block as PromptDryRunPayload;
          return { model: b.request.model ?? "", messages: b.request.messages as ChatMessage[] };
        }
      }
    }
    return undefined;
  } finally {
    reader.releaseLock();
  }
}

// Human-readable transcript for --transcript mode. Preserves message order;
// concatenates multi-part text content; renders non-text parts as
// [type] placeholders.
export function formatDryRunAsText(payload: DryRunPayload): string {
  const lines: string[] = [];
  lines.push(`# model: ${payload.model}`);
  lines.push("");
  for (const msg of payload.messages) {
    lines.push(`=== ${msg.role.toUpperCase()} ===`);
    const rendered = msg.content.map((part) => (part.type === "text" ? part.text : `[${part.type}]`)).join("");
    lines.push(rendered);
    lines.push("");
  }
  return lines.join("\n");
}
