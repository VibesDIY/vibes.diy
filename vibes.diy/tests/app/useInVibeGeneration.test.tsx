import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { Result } from "@adviser/cement";
import { useInVibeGeneration } from "~/vibes.diy/app/hooks/useInVibeGeneration.js";
import { makeControllableLLMChat } from "./helpers/makeControllableLLMChat.js";

function setup(overrides: { enabled?: boolean } = {}) {
  const fakeChat = makeControllableLLMChat();
  const openChat = vi.fn(async () => Result.Ok(fakeChat.chat));
  const getAppByFsId = vi.fn(async () => Result.Ok({ fsId: "FS-1" }));
  const ensureAppSettings = vi.fn(async () => Result.Err("no settings"));
  const chatApi = { openChat } as never;
  const sharedApi = { getAppByFsId, ensureAppSettings } as never;
  const pushSource = vi.fn(() => true);
  const srvVibeSandbox = { pushSource } as never;
  const view = renderHook(() =>
    useInVibeGeneration({
      ownerHandle: "owner",
      appSlug: "app",
      fsId: "FS-1",
      chatApi,
      sharedApi,
      srvVibeSandbox,
      ...overrides,
    })
  );
  return { view, fakeChat, openChat, pushSource };
}

describe("useInVibeGeneration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stays inert on mount — no codegen chat until first edit intent (#2761)", async () => {
    const { view, openChat } = setup();
    expect(view.result.current.phase).toBe("idle");
    // Passive browse: give effects a tick; openChat must NOT fire on mount.
    await new Promise((r) => setTimeout(r, 50));
    expect(openChat).not.toHaveBeenCalled();
  });

  it("activate() lazily opens the codegen chat (edit UI opened) (#2761)", async () => {
    const { view, openChat } = setup();
    await new Promise((r) => setTimeout(r, 30));
    expect(openChat).not.toHaveBeenCalled();
    act(() => view.result.current.activate());
    await waitFor(() => expect(openChat).toHaveBeenCalledTimes(1));
    // Idempotent: a second activate must not open a second chat.
    act(() => view.result.current.activate());
    await new Promise((r) => setTimeout(r, 30));
    expect(openChat).toHaveBeenCalledTimes(1);
  });

  it("sendPrompt activates the chat even without an explicit edit-UI open (#2761)", async () => {
    // The fork auto-fire path calls sendPrompt directly; it must still open.
    const { view, openChat, fakeChat } = setup();
    await new Promise((r) => setTimeout(r, 30));
    expect(openChat).not.toHaveBeenCalled();
    act(() => view.result.current.sendPrompt("make it blue"));
    await waitFor(() => expect(openChat).toHaveBeenCalledTimes(1));
    await act(async () => fakeChat.emitBlockBegin());
    await waitFor(() => expect(view.result.current.phase).toBe("streaming"));
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

  it("keeps isGenerating true after the first code.end (phase live) so publish can't ship a partial turn", async () => {
    const { view, fakeChat } = setup();
    await waitFor(() => expect(view.result.current.phase).toBe("idle"));
    expect(view.result.current.isGenerating).toBe(false);
    act(() => view.result.current.sendPrompt("make it blue"));
    await act(async () => fakeChat.emitBlockBegin());
    await waitFor(() => expect(view.result.current.phase).toBe("streaming"));
    expect(view.result.current.isGenerating).toBe(true);
    await act(async () => fakeChat.emitCodeEnd());
    await waitFor(() => expect(view.result.current.phase).toBe("live"));
    // The crux of the publish gate (#2772 D2 / Charlie review): phase flips to "live"
    // at the first code.end, but the turn is still running — isGenerating stays true so
    // `!isGenerating` keeps the Publish control closed until the whole turn settles.
    expect(view.result.current.isGenerating).toBe(true);
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

  it("derives suggestionChips from the latest block's trailing ▸ options (fresh follow-ups)", async () => {
    const { view, fakeChat } = setup();
    await waitFor(() => expect(view.result.current.phase).toBe("idle"));
    expect(view.result.current.suggestionChips).toEqual([]); // none before a turn
    act(() => view.result.current.sendPrompt("make a timer"));
    await act(async () => fakeChat.emitBlockBegin());
    // The model's narration ends with a trailing option group; the terminal
    // "I'm done for now" dismiss chip is dropped and the list caps at three.
    await act(async () =>
      fakeChat.emitToplevelLines([
        "Added a countdown timer.",
        "▸ Add a pause button",
        "▸ Play a sound at zero",
        "▸ I'm done for now",
      ])
    );
    await act(async () => fakeChat.emitCodeEnd());
    await waitFor(() => expect(view.result.current.suggestionChips).toEqual(["Add a pause button", "Play a sound at zero"]));
  });

  it("hasLocalEdit stays false when blocks arrive from replayed history (no local send)", async () => {
    // The Charlie-review case: the server replays prior turns into `blocks` on
    // open. That must NOT count as a local edit, or a versioned view would prefer
    // the latest streamed chips over its fsId-scoped persisted chips.
    const { view, fakeChat, openChat } = setup();
    await waitFor(() => expect(view.result.current.phase).toBe("idle"));
    expect(view.result.current.hasLocalEdit).toBe(false);
    // Opening the edit UI activates the lazy codegen chat (#2761) WITHOUT sending
    // a prompt — this is the path on which the server replays prior turns.
    act(() => view.result.current.activate());
    await waitFor(() => expect(openChat).toHaveBeenCalledTimes(1));
    await act(async () => fakeChat.emitBlockBegin());
    await act(async () => fakeChat.emitToplevelLines(["Loaded.", "▸ History chip"]));
    await act(async () => fakeChat.emitCodeEnd());
    expect(view.result.current.blocks.length).toBeGreaterThan(0);
    expect(view.result.current.hasLocalEdit).toBe(false);
  });

  it("hasLocalEdit flips true on a local sendPrompt and resets when the vibe changes", async () => {
    const fakeChat = makeControllableLLMChat({ chatId: "A" });
    const nextChat = makeControllableLLMChat({ chatId: "B" });
    const opened = [fakeChat.chat, nextChat.chat];
    let openIdx = 0;
    const openChat = vi.fn(async () => Result.Ok(opened[Math.min(openIdx++, opened.length - 1)]));
    const chatApi = { openChat } as never;
    const sharedApi = {
      getAppByFsId: vi.fn(async () => Result.Ok({ fsId: "FS-1" })),
      ensureAppSettings: vi.fn(async () => Result.Err("no settings")),
    } as never;
    const srvVibeSandbox = { pushSource: vi.fn(() => true) } as never;
    const view = renderHook(
      (p: { ownerHandle: string; appSlug: string }) =>
        useInVibeGeneration({ ownerHandle: p.ownerHandle, appSlug: p.appSlug, fsId: "FS-1", chatApi, sharedApi, srvVibeSandbox }),
      { initialProps: { ownerHandle: "owner", appSlug: "appA" } }
    );
    await waitFor(() => expect(view.result.current.phase).toBe("idle"));
    expect(view.result.current.hasLocalEdit).toBe(false);
    act(() => view.result.current.sendPrompt("make it green"));
    await waitFor(() => expect(view.result.current.hasLocalEdit).toBe(true));
    // Navigating to a different vibe resets it.
    view.rerender({ ownerHandle: "owner", appSlug: "appB" });
    await waitFor(() => expect(view.result.current.hasLocalEdit).toBe(false));
  });

  it("does not open a chat when disabled", async () => {
    const { view, openChat } = setup({ enabled: false });
    expect(view.result.current.phase).toBe("idle");
    // give effects a tick; openChat must never fire
    await new Promise((r) => setTimeout(r, 50));
    expect(openChat).not.toHaveBeenCalled();
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

  it("rejects a new prompt while a turn is already in flight", async () => {
    const { view, fakeChat } = setup();
    await waitFor(() => expect(view.result.current.phase).toBe("idle"));
    act(() => view.result.current.sendPrompt("first"));
    await act(async () => fakeChat.emitBlockBegin()); // running = true
    await waitFor(() => expect(view.result.current.phase).toBe("streaming"));
    // A second prompt while the turn is in flight must be ignored — only the
    // first turn's chat.prompt() should have fired.
    act(() => view.result.current.sendPrompt("second"));
    await new Promise((r) => setTimeout(r, 30));
    expect(fakeChat.chat.prompt).toHaveBeenCalledTimes(1);
  });

  it("resets generation state when the vibe (ownerHandle/appSlug) changes", async () => {
    // Distinct chats per open — re-opening for the new vibe must get a fresh
    // stream (the real openChat does); reusing one stream would lock its reader.
    const fakeChat = makeControllableLLMChat({ chatId: "A" });
    const nextChat = makeControllableLLMChat({ chatId: "B" });
    const opened = [fakeChat.chat, nextChat.chat];
    let openIdx = 0;
    const openChat = vi.fn(async () => Result.Ok(opened[Math.min(openIdx++, opened.length - 1)]));
    const chatApi = { openChat } as never;
    const sharedApi = {
      getAppByFsId: vi.fn(async () => Result.Ok({ fsId: "FS-1" })),
      ensureAppSettings: vi.fn(async () => Result.Err("no settings")),
    } as never;
    const srvVibeSandbox = { pushSource: vi.fn(() => true) } as never;
    const view = renderHook(
      (p: { ownerHandle: string; appSlug: string }) =>
        useInVibeGeneration({ ownerHandle: p.ownerHandle, appSlug: p.appSlug, fsId: "FS-1", chatApi, sharedApi, srvVibeSandbox }),
      { initialProps: { ownerHandle: "owner", appSlug: "appA" } }
    );
    await waitFor(() => expect(view.result.current.phase).toBe("idle"));
    act(() => view.result.current.sendPrompt("build it"));
    await act(async () => fakeChat.emitBlockBegin());
    await act(async () => fakeChat.emitCodeEnd());
    await waitFor(() => expect(view.result.current.phase).toBe("live"));
    expect(view.result.current.blocks.length).toBeGreaterThan(0);
    // Navigate to a different vibe — the reducer must reset, not carry appA's blocks.
    view.rerender({ ownerHandle: "owner", appSlug: "appB" });
    await waitFor(() => expect(view.result.current.phase).toBe("idle"));
    expect(view.result.current.blocks).toHaveLength(0);
    expect(view.result.current.counts.messages).toBe(0);
  });

  it("does NOT eagerly re-open codegen when client-navigating between vibes (#2761, Codex P2)", async () => {
    const fakeChat = makeControllableLLMChat({ chatId: "A" });
    const nextChat = makeControllableLLMChat({ chatId: "B" });
    const opened = [fakeChat.chat, nextChat.chat];
    let openIdx = 0;
    const openChat = vi.fn(async () => Result.Ok(opened[Math.min(openIdx++, opened.length - 1)]));
    const chatApi = { openChat } as never;
    const sharedApi = {
      getAppByFsId: vi.fn(async () => Result.Ok({ fsId: "FS-1" })),
      ensureAppSettings: vi.fn(async () => Result.Err("no settings")),
    } as never;
    const srvVibeSandbox = { pushSource: vi.fn(() => true) } as never;
    const view = renderHook(
      (p: { ownerHandle: string; appSlug: string }) =>
        useInVibeGeneration({ ownerHandle: p.ownerHandle, appSlug: p.appSlug, fsId: "FS-1", chatApi, sharedApi, srvVibeSandbox }),
      { initialProps: { ownerHandle: "owner", appSlug: "appA" } }
    );
    // Owner opens the edit UI on vibe A → exactly one openChat.
    act(() => view.result.current.activate());
    await waitFor(() => expect(openChat).toHaveBeenCalledTimes(1));
    // Client-side nav to a DIFFERENT vibe must NOT eagerly re-open codegen: the
    // `active` latch is re-armed synchronously during render, so passive browsing
    // of the new vibe opens no connection. (Without the render-phase reset,
    // useChatSession's open effect would fire once for appB → 2 calls.)
    view.rerender({ ownerHandle: "owner", appSlug: "appB" });
    await new Promise((r) => setTimeout(r, 50));
    expect(openChat).toHaveBeenCalledTimes(1);
    expect(view.result.current.phase).toBe("idle");
    // Opening the edit UI on the new vibe re-activates and opens ITS chat.
    act(() => view.result.current.activate());
    await waitFor(() => expect(openChat).toHaveBeenCalledTimes(2));
  });
});
