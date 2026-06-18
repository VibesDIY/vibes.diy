import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { Result } from "@adviser/cement";
import { useChatSession } from "~/vibes.diy/app/hooks/useChatSession.js";
import type { PromptState } from "~/vibes.diy/app/routes/chat/prompt-state.js";
import { makeFakeLLMChat } from "./helpers/makeFakeLLMChat.js";

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
