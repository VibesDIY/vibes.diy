import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { Result } from "@adviser/cement";
import { useInVibeGeneration } from "~/vibes.diy/app/hooks/useInVibeGeneration.js";
import { makeControllableLLMChat } from "./helpers/makeControllableLLMChat.js";

function setup() {
  const fakeChat = makeControllableLLMChat();
  const openChat = vi.fn(async () => Result.Ok(fakeChat.chat));
  const getAppByFsId = vi.fn(async () => Result.Ok({ fsId: "FS-1" }));
  const ensureAppSettings = vi.fn(async () => Result.Err("no settings"));
  const chatApi = { openChat } as never;
  const sharedApi = { getAppByFsId, ensureAppSettings } as never;
  const pushSource = vi.fn(() => true);
  const srvVibeSandbox = { pushSource } as never;
  const view = renderHook(() =>
    useInVibeGeneration({ ownerHandle: "owner", appSlug: "app", fsId: "FS-1", chatApi, sharedApi, srvVibeSandbox })
  );
  return { view, fakeChat, openChat, pushSource };
}

describe("useInVibeGeneration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts idle and opens the chat", async () => {
    const { view, openChat } = setup();
    expect(view.result.current.phase).toBe("idle");
    await waitFor(() => expect(openChat).toHaveBeenCalledTimes(1));
  });

  it("sendPrompt drives phase idle -> streaming, then -> live on the first code.end", async () => {
    const { view, fakeChat } = setup();
    await waitFor(() => expect(view.result.current.phase).toBe("idle"));
    act(() => view.result.current.sendPrompt("make it blue"));
    await act(async () => fakeChat.emitBlockBegin());
    await waitFor(() => expect(view.result.current.phase).toBe("streaming"));
    await act(async () => fakeChat.emitCodeEnd());
    await waitFor(() => expect(view.result.current.phase).toBe("live"));
    // counts.messages tracks the block count; blocks is passed through from the reducer.
    expect(view.result.current.counts.messages).toBe(1);
    expect(view.result.current.blocks).toHaveLength(1);
  });
});
