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
  // Convenience emitters for common message types.
  // Emits a prompt.block-begin message (flips the reducer's running to true).
  emitBlockBegin(streamId?: string): void;
  // Emits a block.code.end message (signals the first code block completed).
  emitCodeEnd(blockId?: string, seq?: number): void;
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

  const result: ControllableLLMChat = {
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
    emitBlockBegin(streamId = "stream-1") {
      result.pushBlocks([
        {
          type: "prompt.block-begin",
          streamId,
          chatId,
          seq: 0,
          timestamp: new Date(),
        } as PromptAndBlockMsgs,
      ]);
    },
    emitCodeEnd(blockId = "b1", seq = 1) {
      result.pushBlocks([
        {
          type: "block.code.end",
          blockId,
          streamId: "stream-1",
          seq,
          blockNr: 1,
          timestamp: new Date(),
          sectionId: "section-1",
          lang: "tsx",
          stats: { lines: 10, bytes: 200 },
        } as PromptAndBlockMsgs,
      ]);
    },
  };
  return result;
}
