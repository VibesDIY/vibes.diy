import { vi, type Mock } from "vitest";
import { Result } from "@adviser/cement";
import type { LLMChat, OnResponseTypes, PromptAndBlockMsgs } from "@vibes.diy/api-types";

// A fake chat whose section stream the test drives by hand: enqueue blocks (or
// close the stream) on demand. Unlike makeFakeLLMChat's auto-closing empty
// stream, this stays open so a test can exercise the reconnect path where a
// superseded-but-still-alive stream flushes late events.
export interface ControllableLLMChat {
  readonly chat: LLMChat & { close: Mock; prompt: Mock; promptFS: Mock };
  // Enqueue a section-event wrapping the given blocks onto this chat's stream.
  pushBlocks(blocks: PromptAndBlockMsgs[]): void;
  // Close the readable so the route's processStream resolves.
  closeStream(): void;
}

export function makeControllableLLMChat(opts: { chatId?: string } = {}): ControllableLLMChat {
  const chatId = opts.chatId ?? "chat-1";
  let controller!: ReadableStreamDefaultController<OnResponseTypes>;
  let closed = false;
  const stream = new ReadableStream<OnResponseTypes>({
    start(c) {
      controller = c;
    },
  });
  const close = vi.fn(async () => undefined);
  const prompt = vi.fn(async () => Result.Ok({ promptId: "prompt-1" }));
  const promptFS = vi.fn(async () => Result.Ok({ promptId: "promptfs-1" }));
  const chat = {
    tid: `t-${chatId}`,
    chatId,
    ownerHandle: "owner",
    appSlug: "app",
    get sectionStream() {
      return stream;
    },
    prompt,
    promptFS,
    close,
  } as unknown as ControllableLLMChat["chat"];

  return {
    chat,
    pushBlocks(blocks) {
      if (closed) return;
      controller.enqueue({
        type: "vibes.diy.section-event",
        chatId,
        promptId: "prompt-1",
        blockSeq: 0,
        timestamp: new Date(),
        blocks,
      } as unknown as OnResponseTypes);
    },
    closeStream() {
      if (closed) return;
      closed = true;
      controller.close();
    },
  };
}
