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

  it("pushes resolved source to the iframe on a completed code block and ramps blur down", async () => {
    const { view, fakeChat, pushSource } = setup();
    await waitFor(() => expect(view.result.current.phase).toBe("idle"));
    act(() => view.result.current.sendPrompt("make a counter"));
    const before = view.result.current.blurPx; // promptToSend set, hotSwapCount 0 → 25
    expect(before).toBe(25);
    await act(async () => fakeChat.emitBlockBegin());
    // A full, valid module so the push guard (len>=200 && includes "export default") passes.
    const src = `export default function App(){return null}\n${"// pad line\n".repeat(40)}`;
    await act(async () => fakeChat.emitCodeBlock(src));
    await waitFor(() => expect(pushSource).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(view.result.current.blurPx).toBeLessThan(25));
  });

  it("counts.lines reflects the resolved code length after a code block", async () => {
    const { view, fakeChat } = setup();
    await waitFor(() => expect(view.result.current.phase).toBe("idle"));
    expect(view.result.current.counts.lines).toBe(0); // no code yet
    act(() => view.result.current.sendPrompt("a list app"));
    await act(async () => fakeChat.emitBlockBegin());
    const src = `export default function App(){return null}\n${"// pad line\n".repeat(40)}`;
    await act(async () => fakeChat.emitCodeBlock(src));
    await waitFor(() => expect(view.result.current.counts.lines).toBeGreaterThan(0));
  });
});
