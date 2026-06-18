import { vi, type Mock } from "vitest";
import { Result } from "@adviser/cement";
import type { LLMChat } from "@vibes.diy/api-types";

// Intersection (not `extends`) so the spy types compose with LLMChat's real
// method signatures instead of incompatibly redeclaring them — the fake stays
// assignable to LLMChat while exposing `.mock` for assertions.
export type FakeLLMChat = LLMChat & {
  prompt: Mock;
  promptFS: Mock;
  close: Mock;
};

export interface FakeLLMChatOpts {
  readonly chatId?: string;
  readonly ownerHandle?: string;
  readonly appSlug?: string;
  // Default: prompt() resolves Ok with this promptId. Set `promptErr` to force an error.
  readonly promptId?: string;
  readonly promptErr?: string;
}

// An empty, immediately-closing section stream so processStream resolves and
// the hook's `.finally` dispatches `streamDisconnected` without test setup.
function emptySectionStream(): LLMChat["sectionStream"] {
  return new ReadableStream({
    start(controller) {
      controller.close();
    },
  });
}

export function makeFakeLLMChat(opts: FakeLLMChatOpts = {}): FakeLLMChat {
  const prompt = vi.fn(async () =>
    opts.promptErr ? Result.Err(opts.promptErr) : Result.Ok({ promptId: opts.promptId ?? "prompt-1" })
  );
  const promptFS = vi.fn(async () => Result.Ok({ promptId: opts.promptId ?? "promptfs-1" }));
  const close = vi.fn(async () => undefined);
  return {
    tid: "t-1",
    chatId: opts.chatId ?? "chat-1",
    ownerHandle: opts.ownerHandle ?? "owner",
    appSlug: opts.appSlug ?? "app",
    // Getter so each attach (e.g. reconnect / re-open) gets a fresh, unlocked
    // stream — a single shared ReadableStream throws "already locked" on the
    // second processStream read.
    get sectionStream() {
      return emptySectionStream();
    },
    prompt,
    promptFS,
    close,
  } as unknown as FakeLLMChat;
}
