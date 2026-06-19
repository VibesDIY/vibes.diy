import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { Result } from "@adviser/cement";
import { useChatSession } from "~/vibes.diy/app/hooks/useChatSession.js";
import type { PromptState } from "~/vibes.diy/app/routes/chat/prompt-state.js";
import type { PromptAndBlockMsgs } from "@vibes.diy/api-types";
import { makeFakeLLMChat } from "./helpers/makeFakeLLMChat.js";
import { makeControllableLLMChat } from "./helpers/makeControllableLLMChat.js";

function baseState(over: Partial<PromptState> = {}): PromptState {
  return { running: false, connection: "live", blocks: [], ...over } as unknown as PromptState;
}

interface Props {
  ownerHandle?: string;
  appSlug?: string;
  fsId?: string;
  promptToSend?: string | null;
  promptState?: PromptState;
}

function setup(over: Props & { promptErr?: boolean } = {}) {
  const fakeChat = makeFakeLLMChat({ promptErr: over.promptErr ? "boom" : undefined });
  const openChat = vi.fn(async () => Result.Ok(fakeChat));
  const getAppByFsId = vi.fn(async () => Result.Ok({ fsId: "FS-cli" }));
  const ensureAppSettings = vi.fn(async () => Result.Err("no settings"));
  const chatApi = { openChat, getAppByFsId, ensureAppSettings } as unknown as Parameters<typeof useChatSession>[0]["chatApi"];
  const dispatch = vi.fn();
  const sendPrompt = vi.fn();
  const navigateToFsId = vi.fn();

  const initialProps: Props = { ownerHandle: "owner", appSlug: "app", promptToSend: null, ...over };
  const view = renderHook(
    (p: Props) =>
      useChatSession({
        ownerHandle: p.ownerHandle ?? "owner",
        appSlug: p.appSlug ?? "app",
        fsId: p.fsId,
        inConstruction: false,
        chatApi,
        promptState: p.promptState ?? baseState(),
        dispatch,
        promptToSend: p.promptToSend ?? null,
        sendPrompt,
        navigateToFsId,
      }),
    { initialProps }
  );
  return { view, openChat, getAppByFsId, fakeChat, dispatch, sendPrompt, navigateToFsId };
}

describe("useChatSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens the chat once per slug pair and dispatches initChat", async () => {
    const { openChat, dispatch } = setup();
    await waitFor(() => expect(openChat).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "initChat" })));
  });

  it("invariant 2: re-opens after a slug-pair change", async () => {
    const { view, openChat } = setup();
    await waitFor(() => expect(openChat).toHaveBeenCalledTimes(1));
    view.rerender({ ownerHandle: "owner", appSlug: "other-app", promptToSend: null });
    await waitFor(() => expect(openChat).toHaveBeenCalledTimes(2));
  });

  it("invariant 5: CLI-pushed app with no fsId navigates to the looked-up fsId", async () => {
    const { getAppByFsId, navigateToFsId } = setup({ fsId: undefined });
    await waitFor(() => expect(getAppByFsId).toHaveBeenCalled());
    await waitFor(() => expect(navigateToFsId).toHaveBeenCalledWith("FS-cli"));
  });

  it("invariant 3: fire path clears promptToSend (null) before calling chat.prompt", async () => {
    const { view, fakeChat, sendPrompt } = setup();
    // First render opens; once chat is set the next render takes the fire path.
    view.rerender({ ownerHandle: "owner", appSlug: "app", promptToSend: "hello" });
    await waitFor(() => expect(fakeChat.prompt).toHaveBeenCalledTimes(1));
    expect(sendPrompt).toHaveBeenCalledWith(null);
    const sendOrder = sendPrompt.mock.invocationCallOrder[0];
    const promptOrder = fakeChat.prompt.mock.invocationCallOrder[0];
    expect(sendOrder).toBeLessThan(promptOrder);
  });

  it("invariant 4: a failed chat.prompt clears the optimistic bubble", async () => {
    const { view, fakeChat, dispatch } = setup({ promptErr: true });
    view.rerender({ ownerHandle: "owner", appSlug: "app", promptToSend: "hello" });
    await waitFor(() => expect(fakeChat.prompt).toHaveBeenCalled());
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith({ type: "setOptimisticPrompt", text: undefined }));
  });

  it("invariant 1: fire path does not re-fire on an fsId-only change", async () => {
    const { view, fakeChat } = setup();
    view.rerender({ ownerHandle: "owner", appSlug: "app", promptToSend: "hello" });
    await waitFor(() => expect(fakeChat.prompt).toHaveBeenCalledTimes(1));
    // promptToSend is now null (cleared); changing only fsId must not re-fire.
    view.rerender({ ownerHandle: "owner", appSlug: "app", fsId: "FS-new", promptToSend: null });
    await new Promise((r) => setTimeout(r, 50));
    expect(fakeChat.prompt).toHaveBeenCalledTimes(1);
  });

  it("invariant 6: does NOT close the live chat handle on unmount (current behavior)", async () => {
    const { view, openChat, fakeChat } = setup();
    await waitFor(() => expect(openChat).toHaveBeenCalled());
    view.unmount();
    await new Promise((r) => setTimeout(r, 50));
    expect(fakeChat.close).not.toHaveBeenCalled();
  });
});

// Regression: a laggy/half-open connection makes the watchdog flip the chat to
// "reconnecting" while the original section stream is still alive. The reconnect
// loop attaches a fresh stream — but the original must be (a) closed and (b)
// fenced out of the reducer, or its late-flushed bytes interleave with the new
// stream's and duplicate prompts, code lines, and option chips (the two-stream
// gremlin). These tests pin both halves of the fix.
describe("useChatSession reconnect stream isolation", () => {
  beforeEach(() => vi.clearAllMocks());

  function blockBegin(streamId: string): PromptAndBlockMsgs {
    return { type: "prompt.block-begin", streamId, chatId: "c1", seq: 1, timestamp: new Date() } as unknown as PromptAndBlockMsgs;
  }

  function setupReconnect() {
    const original = makeControllableLLMChat({ chatId: "chat-original" });
    const reconnected = makeControllableLLMChat({ chatId: "chat-reconnected" });
    const chats = [original, reconnected];
    let opened = 0;
    const openChat = vi.fn(async () => Result.Ok(chats[Math.min(opened++, chats.length - 1)].chat));
    const ensureAppSettings = vi.fn(async () => Result.Err("no settings"));
    const chatApi = { openChat, ensureAppSettings } as unknown as Parameters<typeof useChatSession>[0]["chatApi"];
    const dispatch = vi.fn();

    function props(connection: PromptState["connection"]): { promptState: PromptState } {
      return { promptState: { running: true, connection, blocks: [] } as unknown as PromptState };
    }

    const view = renderHook(
      ({ promptState }: { promptState: PromptState }) =>
        useChatSession({
          ownerHandle: "owner",
          appSlug: "app",
          fsId: "FS-1",
          inConstruction: false,
          chatApi,
          promptState,
          dispatch,
          promptToSend: null,
          sendPrompt: vi.fn(),
          navigateToFsId: vi.fn(),
        }),
      { initialProps: props("live") }
    );
    return { view, props, openChat, dispatch, original, reconnected };
  }

  it("closes the superseded chat when the reconnect loop takes over", async () => {
    const { view, props, openChat, original } = setupReconnect();
    // Mount opens the original chat and attaches its stream.
    await waitFor(() => expect(openChat).toHaveBeenCalledTimes(1));
    expect(original.chat.close).not.toHaveBeenCalled();

    // Watchdog/transport loss flips to reconnecting → loop opens a new chat.
    view.rerender(props("reconnecting"));
    await waitFor(() => expect(openChat).toHaveBeenCalledTimes(2));
    // The original handle is torn down rather than leaked.
    await waitFor(() => expect(original.chat.close).toHaveBeenCalled());
  });

  it("fences the superseded stream out of the reducer (no double-dispatch)", async () => {
    const { view, props, openChat, dispatch, original, reconnected } = setupReconnect();
    await waitFor(() => expect(openChat).toHaveBeenCalledTimes(1));

    view.rerender(props("reconnecting"));
    await waitFor(() => expect(openChat).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(original.chat.close).toHaveBeenCalled());

    // The original stream is still alive (close() is a logical no-op on the
    // in-memory stream, exactly like a half-open socket that hasn't torn down
    // delivery yet). Its late blocks must be dropped; the new stream's flow.
    original.pushBlocks([blockBegin("from-original")]);
    reconnected.pushBlocks([blockBegin("from-reconnected")]);

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "prompt.block-begin", streamId: "from-reconnected" }))
    );
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ streamId: "from-original" }));
  });
});
