import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { Result } from "@adviser/cement";
import { useInVibeGeneration } from "~/vibes.diy/app/hooks/useInVibeGeneration.js";
import { makeControllableLLMChat } from "./helpers/makeControllableLLMChat.js";

function setup(overrides: { enabled?: boolean; onSavedFsId?: (fsId: string) => void } = {}) {
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

// A full, valid module so any hot-swap push guard (len>=200, includes
// "export default") would pass — lets a save test also prove hot-swap is
// suppressed during the save.
const SAVE_BUFFER = `export default function App(){return null}\n${"// pad line\n".repeat(40)}`;

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

  it("does NOT hot-swap the iframe from replayed chat history — only from a local edit (#2997)", async () => {
    // Opening the edit card (the "Vibe switch") activates the lazy codegen chat,
    // which replays the persisted chat HEAD into `blocks`. That HEAD can diverge
    // from the live published release (CLI push/publish never append a chat turn),
    // so pushing its code would flip the running preview to a stale version. The
    // hot-swap must stay gated on a real in-session edit (`hasLocalEdit`).
    const { view, fakeChat, openChat, pushSource } = setup();
    await waitFor(() => expect(view.result.current.phase).toBe("idle"));
    // Activate WITHOUT sending a prompt — the replay path opened by the switch.
    act(() => view.result.current.activate());
    await waitFor(() => expect(openChat).toHaveBeenCalledTimes(1));
    expect(view.result.current.hasLocalEdit).toBe(false);
    // A full, valid module so the push guard (len>=200 && includes "export default")
    // WOULD pass if the effect ran — proving the gate, not the guard, suppresses it.
    const historySrc = `export default function App(){return null}\n${"// history line\n".repeat(40)}`;
    await act(async () => fakeChat.emitBlockBegin());
    await act(async () => fakeChat.emitCodeBlock(historySrc, "b-hist"));
    // Give the effect a tick — the replayed code.end must NOT hot-swap the iframe.
    await new Promise((r) => setTimeout(r, 30));
    expect(view.result.current.blocks.length).toBeGreaterThan(0);
    expect(view.result.current.hasLocalEdit).toBe(false);
    expect(pushSource).not.toHaveBeenCalled();

    // Codex P1: the flip must not resurrect the stale HEAD. Settle the replayed
    // turn, then submit the first edit — which flips `hasLocalEdit` and reruns
    // the hot-swap effect while the replayed HEAD is STILL the last block (no new
    // local code.end has streamed yet). The replayed code.end was marked seen on
    // the replay pass, so it must NOT be pushed now.
    await act(async () => fakeChat.emitPromptBlockEnd());
    act(() => view.result.current.sendPrompt("make it blue"));
    await waitFor(() => expect(view.result.current.hasLocalEdit).toBe(true));
    await new Promise((r) => setTimeout(r, 30));
    expect(pushSource).not.toHaveBeenCalled();
    // (The positive path — a genuinely new local code.end DOES hot-swap — is
    // covered by "pushes resolved source to the iframe on a completed code
    // block", which sends a prompt before the code block streams.)
  });

  it("exposes persistedFsRef only once the canonical post-persist block.end (with fsRef) lands", async () => {
    // #2839: the badge re-resolve must key off the DURABLE block.end fsRef, not the
    // early prompt.block-end. persistedFsRef stays undefined through streaming + the
    // first code.end, and only takes the fsRef (with vibe identity) when block.end arrives.
    const { view, fakeChat } = setup();
    await waitFor(() => expect(view.result.current.phase).toBe("idle"));
    expect(view.result.current.persistedFsRef).toBeUndefined();
    act(() => view.result.current.sendPrompt("make it blue"));
    await act(async () => fakeChat.emitBlockBegin());
    await act(async () => fakeChat.emitCodeEnd());
    // code.end ≠ persisted: the in-flight flag may drop here, but no fsRef yet.
    expect(view.result.current.persistedFsRef).toBeUndefined();
    await act(async () => fakeChat.emitBlockEnd("zDRAFT-NEW"));
    // Carries the FULL identity (the emitter stamps ownerHandle "owner" / appSlug "app").
    await waitFor(() =>
      expect(view.result.current.persistedFsRef).toEqual({ ownerHandle: "owner", appSlug: "app", fsId: "zDRAFT-NEW" })
    );
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

  it("clears persistedFsRef when the vibe changes so an fsRef never carries across vibes (#2839)", async () => {
    // The route's skip-repin decision compares the resolved draft against persistedFsRef
    // by full vibe identity; this also confirms the hook doesn't leak a settled fsRef
    // across a client-side nav. After a persisted block.end on vibe A, navigating to B
    // must reset persistedFsRef to undefined.
    const chatA = makeControllableLLMChat({ chatId: "A" });
    const chatB = makeControllableLLMChat({ chatId: "B" });
    const opened = [chatA.chat, chatB.chat];
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
    act(() => view.result.current.sendPrompt("make it green"));
    await act(async () => chatA.emitBlockBegin());
    await act(async () => chatA.emitCodeEnd());
    await act(async () => chatA.emitBlockEnd("zDRAFT-A"));
    await waitFor(() => expect(view.result.current.persistedFsRef?.fsId).toBe("zDRAFT-A"));
    view.rerender({ ownerHandle: "owner", appSlug: "appB" });
    await waitFor(() => expect(view.result.current.persistedFsRef).toBeUndefined());
  });

  it("stop() is a no-op when nothing is generating (no socket teardown)", async () => {
    const { view, fakeChat } = setup();
    await waitFor(() => expect(view.result.current.phase).toBe("idle"));
    act(() => view.result.current.stop());
    await new Promise((r) => setTimeout(r, 20));
    expect(fakeChat.chat.close).not.toHaveBeenCalled();
    expect(view.result.current.isGenerating).toBe(false);
  });

  it("stop() cancels the in-flight turn as if it never started: clears blocks, closes the socket, re-opens clean on the next edit", async () => {
    // Distinct chats per open so the reopened turn gets a fresh stream (a reused
    // stream's reader would be locked) — mirrors the real openChat.
    const chatA = makeControllableLLMChat({ chatId: "A" });
    const chatB = makeControllableLLMChat({ chatId: "B" });
    const opened = [chatA.chat, chatB.chat];
    let openIdx = 0;
    const openChat = vi.fn(async () => Result.Ok(opened[Math.min(openIdx++, opened.length - 1)]));
    const chatApi = { openChat } as never;
    const sharedApi = {
      getAppByFsId: vi.fn(async () => Result.Ok({ fsId: "FS-1" })),
      ensureAppSettings: vi.fn(async () => Result.Err("no settings")),
    } as never;
    const srvVibeSandbox = { pushSource: vi.fn(() => true) } as never;
    const view = renderHook(() =>
      useInVibeGeneration({ ownerHandle: "owner", appSlug: "app", fsId: "FS-1", chatApi, sharedApi, srvVibeSandbox })
    );
    await waitFor(() => expect(view.result.current.phase).toBe("idle"));

    // Start a turn.
    act(() => view.result.current.sendPrompt("make it blue"));
    await waitFor(() => expect(openChat).toHaveBeenCalledTimes(1));
    await act(async () => chatA.emitBlockBegin());
    await waitFor(() => expect(view.result.current.isGenerating).toBe(true));
    expect(view.result.current.phase).toBe("streaming");

    // Stop it: the turn settles as if it never ran, and the socket is closed.
    act(() => view.result.current.stop());
    await waitFor(() => expect(view.result.current.isGenerating).toBe(false));
    expect(view.result.current.phase).toBe("idle");
    expect(view.result.current.blocks).toHaveLength(0);
    expect(chatA.chat.close).toHaveBeenCalled();
    // Lazy: stop does NOT eagerly re-open — the socket stays closed until the next edit.
    await new Promise((r) => setTimeout(r, 30));
    expect(openChat).toHaveBeenCalledTimes(1);

    // The next edit re-opens a FRESH chat and fires on it — no half-open session.
    act(() => view.result.current.sendPrompt("now make it green"));
    await waitFor(() => expect(openChat).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(chatB.chat.prompt).toHaveBeenCalledTimes(1));
    await act(async () => chatB.emitBlockBegin());
    await waitFor(() => expect(view.result.current.phase).toBe("streaming"));
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

  it("queues the first manual save until the lazy chat handle exists, then flushes it (Phase 2, Codex #2)", async () => {
    const { view, fakeChat, openChat } = setup();
    await waitFor(() => expect(view.result.current.phase).toBe("idle"));
    expect(openChat).not.toHaveBeenCalled();
    // Save BEFORE the codegen chat is open. activate() only flips state; the
    // LLMChat opens in a later effect — a naive synchronous chat.promptFS would
    // drop this first save. It must queue instead.
    act(() => view.result.current.saveCode({ buffer: SAVE_BUFFER, filePath: "/App.jsx", lang: "jsx" }));
    expect(view.result.current.isSaving).toBe(true);
    // saveCode activates the lazy chat...
    await waitFor(() => expect(openChat).toHaveBeenCalledTimes(1));
    // ...and once the handle exists the queued save flushes exactly once with the
    // edited buffer (proving it was held, not dropped).
    await waitFor(() => expect(fakeChat.chat.promptFS).toHaveBeenCalledTimes(1));
    expect(fakeChat.chat.promptFS).toHaveBeenCalledWith(
      expect.objectContaining({
        update: [expect.objectContaining({ type: "code-block", filename: "/App.jsx", content: SAVE_BUFFER })],
      })
    );
    await waitFor(() => expect(view.result.current.saveState).toBe("saving"));
  });

  it("a settled save re-pins via onSavedFsId(newFsId) and marks the state rebuilt", async () => {
    const onSavedFsId = vi.fn();
    const { view, fakeChat } = setup({ onSavedFsId });
    await waitFor(() => expect(view.result.current.phase).toBe("idle"));
    act(() => view.result.current.saveCode({ buffer: SAVE_BUFFER, filePath: "/App.jsx", lang: "jsx" }));
    await waitFor(() => expect(view.result.current.saveState).toBe("saving"));
    // The save's stream opens a block, then lands the canonical post-persist
    // block.end carrying the new fsId (a block.end with no open block is dropped
    // by the reducer). The hook resolves the fsId from persistedFsRef and re-pins.
    await act(async () => fakeChat.emitBlockBegin("stream-1"));
    await act(async () => fakeChat.emitBlockEnd("zSAVED-1"));
    await waitFor(() => expect(view.result.current.saveState).toBe("rebuilt"));
    expect(onSavedFsId).toHaveBeenCalledWith("zSAVED-1");
    expect(view.result.current.isSaving).toBe(false);
  });

  it("a failed promptFS surfaces error, keeps the work recoverable, and retry settles (no silent loss)", async () => {
    const onSavedFsId = vi.fn();
    const { view, fakeChat } = setup({ onSavedFsId });
    await waitFor(() => expect(view.result.current.phase).toBe("idle"));
    // First submit fails at the promptFS boundary.
    fakeChat.chat.promptFS.mockResolvedValueOnce(Result.Err("save boom"));
    act(() => view.result.current.saveCode({ buffer: SAVE_BUFFER, filePath: "/App.jsx", lang: "jsx" }));
    await waitFor(() => expect(view.result.current.saveState).toBe("error"));
    expect(view.result.current.isSaving).toBe(false);
    expect(onSavedFsId).not.toHaveBeenCalled();
    // Retry (the edit is still recoverable) — promptFS now succeeds and the save settles.
    act(() => view.result.current.saveCode({ buffer: SAVE_BUFFER, filePath: "/App.jsx", lang: "jsx" }));
    await waitFor(() => expect(view.result.current.saveState).toBe("saving"));
    await act(async () => fakeChat.emitBlockBegin("stream-1"));
    await act(async () => fakeChat.emitBlockEnd("zSAVED-RETRY"));
    await waitFor(() => expect(view.result.current.saveState).toBe("rebuilt"));
    expect(onSavedFsId).toHaveBeenCalledWith("zSAVED-RETRY");
  });

  it("does not mis-attribute a prior turn's late block.end to a save fired in the post-stream window (Codex P1, #2869)", async () => {
    const onSavedFsId = vi.fn();
    const { view, fakeChat } = setup({ onSavedFsId });
    await waitFor(() => expect(view.result.current.phase).toBe("idle"));
    // A codegen turn whose stream id equals its promptId, so the reducer's
    // streamId-matching (setInFlightStreamId <- promptId; block.end clears by
    // streamId) behaves like production.
    fakeChat.chat.prompt.mockResolvedValueOnce(Result.Ok({ promptId: "stream-1" }));
    act(() => view.result.current.sendPrompt("make a gen"));
    await waitFor(() => expect(fakeChat.chat.prompt).toHaveBeenCalledTimes(1));
    await act(async () => {
      await Promise.resolve(); // let prompt().then set inFlightStreamId
    });
    await act(async () => fakeChat.emitBlockBegin("stream-1")); // running -> true
    await act(async () => fakeChat.emitPromptReq("stream-1")); // clear the optimistic bubble
    await act(async () => fakeChat.emitPromptBlockEnd("stream-1")); // EARLY: running -> false
    // The window Codex flagged: generation looks done (isGenerating false) but the
    // turn's canonical block.end (with fsRef) hasn't landed — inFlightStreamId still set.
    await waitFor(() => expect(view.result.current.isGenerating).toBe(false));
    // Save now. It must NOT submit while the prior turn's streamId is still in flight,
    // or it would overwrite the streamId and adopt the gen's late block.end as its own.
    act(() => view.result.current.saveCode({ buffer: SAVE_BUFFER, filePath: "/App.jsx", lang: "jsx" }));
    await new Promise((r) => setTimeout(r, 30));
    expect(fakeChat.chat.promptFS).not.toHaveBeenCalled();
    expect(view.result.current.saveState).toBe("queued");
    // The prior turn's canonical block.end lands -> persistedFsRef becomes the GEN fsId
    // and inFlightStreamId clears. Only now may the save flush — with zGEN as baseline.
    await act(async () => fakeChat.emitBlockEnd("zGEN", { streamId: "stream-1" }));
    await waitFor(() => expect(fakeChat.chat.promptFS).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(view.result.current.saveState).toBe("saving"));
    // The save must never re-pin to the gen fsId.
    expect(onSavedFsId).not.toHaveBeenCalledWith("zGEN");
    // The save's own block.end advances persistedFsRef PAST the baseline -> correct fsId.
    await act(async () => fakeChat.emitBlockEnd("zSAVE", { streamId: "stream-1" }));
    await waitFor(() => expect(view.result.current.saveState).toBe("rebuilt"));
    expect(onSavedFsId).toHaveBeenCalledWith("zSAVE");
    expect(onSavedFsId).not.toHaveBeenCalledWith("zGEN");
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
