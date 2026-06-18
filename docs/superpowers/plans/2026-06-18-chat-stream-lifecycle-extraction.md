# Chat Stream-Lifecycle Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the chat route's open-chat / fire-prompt effect, its loop-guard refs, and the reconnect/watchdog wiring into a single `useChatSession` hook — behavior-preserving — so the surface becomes testable.

**Architecture:** A consolidated `useChatSession` hook owns the `chat` handle, the `openingRef`/`prevSlugsRef`/`fsIdRef` guards, `attachSectionStream`/`refreshAppSettings`, the reconnect/watchdog hooks, and the single open-or-fire effect (preserved verbatim, same dep array). `Chat` calls it and consumes the returned `chat`. Characterization tests (renderHook + a shared `makeFakeLLMChat` double) land first; extraction is a separate no-behavior-change commit. The #1972/#1842 nav-flash fix and the unmount cleanup-leak fix are a follow-up PR.

**Tech Stack:** React 19, TypeScript, Vitest (browser/chromium provider), `@testing-library/react` (`renderHook`), `@adviser/cement` (`Result`, `processStream`), arktype.

**Source spec:** `docs/superpowers/specs/2026-06-18-chat-stream-lifecycle-extraction-design.md` (Status: Approved). Decisions locked there match this plan.

---

## File Structure

- **Create** `vibes.diy/tests/app/helpers/makeFakeLLMChat.ts` — shared fake `LLMChat` test double (Charlie Q4).
- **Create** `vibes.diy/tests/app/ChatSession.test.tsx` — characterization tests for the 6 invariants.
- **Create** `vibes.diy/pkg/app/hooks/useChatSession.ts` — the consolidated lifecycle hook.
- **Modify** `vibes.diy/pkg/app/routes/chat/chat.$ownerHandle.$appSlug.tsx` — call the hook, delete the moved code.

Commit gating (Charlie): **(a)** helper + tests + hook green (Tasks 1–3) → **(b)** route integration, no behavior change (Task 4) → **(c)** follow-up bugfix PR (out of scope here).

---

## Task 1: Shared fake `LLMChat` test double

**Files:**

- Create: `vibes.diy/tests/app/helpers/makeFakeLLMChat.ts`

`LLMChat` (see `vibes.diy/api/types/vibes-diy-api.ts:131-151`) is `LLMChatEntry` (`{ tid, chatId, ownerHandle, appSlug }`) plus `prompt()`, `promptFS()`, `sectionStream: ReadableStream<OnResponseTypes>`, `close()`. The hook reads `sectionStream` (handed to `processStream`), calls `prompt()` on the fire path, and `close()` in cleanup.

- [ ] **Step 1: Create the helper**

```ts
import { vi } from "vitest";
import { Result } from "@adviser/cement";
import type { LLMChat } from "@vibes.diy/api-types";

export interface FakeLLMChat extends LLMChat {
  readonly prompt: ReturnType<typeof vi.fn>;
  readonly promptFS: ReturnType<typeof vi.fn>;
  readonly close: ReturnType<typeof vi.fn>;
}

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
    sectionStream: emptySectionStream(),
    prompt,
    promptFS,
    close,
  } as unknown as FakeLLMChat;
}
```

- [ ] **Step 2: Typecheck the test project**

Run: `cd vibes.diy/tests/app && npx tsc --noEmit -p tsconfig.test.json`
Expected: no errors referencing `makeFakeLLMChat.ts`. (The `as unknown as` cast absorbs the `prompt` overload signature mismatch — intentional for a test double.)

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/tests/app/helpers/makeFakeLLMChat.ts
git commit -m "test(chat): add shared fake LLMChat double"
```

---

## Task 2: Characterization tests for the 6 invariants

**Files:**

- Create: `vibes.diy/tests/app/ChatSession.test.tsx`
- Depends on: `vibes.diy/pkg/app/hooks/useChatSession.ts` (created in Task 3 — tests are written first and will fail to import until then).

The hook signature this test targets (implemented in Task 3):

```ts
useChatSession({
  ownerHandle, appSlug, fsId, inConstruction, chatApi, promptState,
  dispatch, promptToSend, sendPrompt, navigateToFsId,
}): { chat: LLMChat | null }
```

- [ ] **Step 1: Write the failing test file**

```tsx
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

function setup(over: Props = {}) {
  const fakeChat = makeFakeLLMChat({ promptErr: over.promptToSend === "FAIL" ? "boom" : undefined });
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
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "initChat" }));
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
    const { view, fakeChat, dispatch } = setup();
    view.rerender({ ownerHandle: "owner", appSlug: "app", promptToSend: "FAIL" });
    await waitFor(() => expect(fakeChat.prompt).toHaveBeenCalled());
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith({ type: "setOptimisticPrompt", text: undefined })
    );
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
```

- [ ] **Step 2: Run to confirm it fails (hook missing)**

Run: `cd vibes.diy/tests/app && npx vitest run ChatSession`
Expected: FAIL — cannot resolve `~/vibes.diy/app/hooks/useChatSession.js` (module not found).

---

## Task 3: Create `useChatSession` (logic moved, not yet wired)

**Files:**

- Create: `vibes.diy/pkg/app/hooks/useChatSession.ts`
- Test: `vibes.diy/tests/app/ChatSession.test.tsx` (from Task 2)

This is a verbatim move of the lifecycle logic currently in `chat.$ownerHandle.$appSlug.tsx`. The route is left untouched in this task so the tests prove the hook in isolation before integration.

- [ ] **Step 1: Create the hook**

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch } from "react";
import { processStream } from "@adviser/cement";
import { type } from "arktype";
import { sectionEvent } from "@vibes.diy/api-types";
import type { LLMChat, VibesDiyApiIface } from "@vibes.diy/api-types";
import { getThemeBySlug } from "@vibes.diy/prompts";
import { useStreamWatchdog } from "./useStreamWatchdog.js";
import { useReconnectLoop } from "./useReconnectLoop.js";
import { notifyRecentVibesChanged } from "./useRecentVibes.js";
import type { PromptState, PromptAction } from "../routes/chat/prompt-state.js";
import type { ChatNavigation } from "./useChatNavigation.js";

export interface ChatSessionOpts {
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly fsId: string | undefined;
  readonly inConstruction: boolean;
  readonly chatApi: VibesDiyApiIface;
  readonly promptState: PromptState;
  readonly dispatch: Dispatch<PromptAction>;
  readonly promptToSend: string | null;
  readonly sendPrompt: (value: string | null) => void;
  readonly navigateToFsId: ChatNavigation["navigateToFsId"];
}

export interface ChatSession {
  readonly chat: LLMChat | null;
}

/**
 * Single owner of the chat handle and its lifecycle: opening the chat, firing
 * queued prompts, the section-stream attach, app-settings refresh, the
 * reconnect/watchdog loops, and the loop-guard refs (openingRef/prevSlugsRef/
 * fsIdRef). Behavior-preserving extraction from the Chat component
 * (VibesDIY/vibes.diy#2015). See the design spec for the invariants and the
 * known unmount cleanup quirk (the live handle is intentionally NOT closed on
 * unmount — a latent leak preserved here and fixed in a follow-up).
 */
export function useChatSession(opts: ChatSessionOpts): ChatSession {
  const { ownerHandle, appSlug, fsId, inConstruction, chatApi, promptState, dispatch, promptToSend, sendPrompt, navigateToFsId } =
    opts;

  const [chat, setChat] = useState<LLMChat | null>(null);

  const openingRef = useRef(false);
  const prevSlugsRef = useRef(`${ownerHandle}/${appSlug}`);
  if (`${ownerHandle}/${appSlug}` !== prevSlugsRef.current) {
    openingRef.current = false;
    prevSlugsRef.current = `${ownerHandle}/${appSlug}`;
  }

  // Hold latest fsId in a ref so the prompt-firing effect can preserve it in
  // the navigation URL without retriggering on every autosave fsId change
  // (which would re-fire the same prompt — classic loop).
  const fsIdRef = useRef<string | undefined>(fsId);
  fsIdRef.current = fsId;

  const attachSectionStream = useCallback(
    (chatHandle: LLMChat) => {
      processStream(chatHandle.sectionStream, (msg) => {
        const se = sectionEvent(msg);
        if (se instanceof type.errors) {
          console.error(se.summary);
          return;
        }
        for (const block of se.blocks) {
          dispatch(block);
        }
      })
        .catch((err: unknown) => {
          console.error("section stream errored", err);
        })
        .finally(() => {
          dispatch({ type: "streamDisconnected" });
        });
    },
    [dispatch]
  );

  const refreshAppSettings = useCallback(() => {
    chatApi.ensureAppSettings({ ownerHandle, appSlug }).then((rS) => {
      if (rS.isOk()) {
        const s = rS.Ok().settings.entry.settings;
        if (s.title) dispatch({ type: "setTitle", title: s.title });
        if (s.icon) dispatch({ type: "setIcon", icon: s.icon });
        if (s.theme) {
          const t = getThemeBySlug(s.theme);
          if (t) dispatch({ type: "setTheme", theme: t });
        }
        if (s.colorTheme) {
          dispatch({ type: "setColorTheme", colorTheme: s.colorTheme });
        }
      }
    });
  }, [chatApi, ownerHandle, appSlug, dispatch]);

  const handleStreamSilent = useCallback(() => dispatch({ type: "streamDisconnected" }), [dispatch]);
  useStreamWatchdog({
    running: promptState.running,
    connection: promptState.connection,
    activityKey: promptState.blocks,
    onSilent: handleStreamSilent,
  });

  const openChatForReconnect = useCallback(async () => {
    const r = await chatApi.openChat({ ownerHandle, appSlug, mode: "chat" });
    if (r.isErr()) {
      console.error("reconnect openChat failed", r.Err());
      return null;
    }
    return r.Ok();
  }, [chatApi, ownerHandle, appSlug]);

  const handleReconnectAttempt = useCallback(
    (newChat: LLMChat) => {
      dispatch({ type: "replayReset" });
      setChat(newChat);
      dispatch({ type: "initChat", chat: newChat });
      attachSectionStream(newChat);
      refreshAppSettings();
    },
    [attachSectionStream, refreshAppSettings, dispatch]
  );

  const handleReconnectGiveUp = useCallback(() => dispatch({ type: "reconnectFailed" }), [dispatch]);

  useReconnectLoop({
    connection: promptState.connection,
    openChat: openChatForReconnect,
    onAttempt: handleReconnectAttempt,
    onGiveUp: handleReconnectGiveUp,
  });

  useEffect(() => {
    if (inConstruction) return;
    if (openingRef.current) {
      if (chat && promptToSend?.trim().length) {
        // Read fsId from the ref so future autosave-driven fsId changes don't
        // re-trigger this effect with the same promptToSend (loop bug).
        navigateToFsId(fsIdRef.current);
        const sentPrompt = promptToSend;
        // Clear promptToSend BEFORE firing so any re-render of this effect sees
        // null and skips the branch.
        sendPrompt(null);
        dispatch({ type: "setOptimisticPrompt", text: sentPrompt });
        chat
          .prompt({
            messages: [
              {
                role: "user",
                content: [{ type: "text", text: sentPrompt }],
              },
            ],
          })
          .then((r) => {
            if (r.isErr()) {
              console.error(`PromptSend failed`, r.Err());
              dispatch({ type: "setOptimisticPrompt", text: undefined });
            } else {
              dispatch({ type: "setInFlightStreamId", streamId: r.Ok().promptId });
              notifyRecentVibesChanged();
            }
          });
      }
      return; // Already opened or opening
    }
    openingRef.current = true;
    chatApi.openChat({ ownerHandle, appSlug, mode: "chat" }).then((rChat) => {
      if (rChat.isErr()) {
        console.error("CHAT-Error", rChat.Err(), ownerHandle, appSlug);
        return;
      }
      setChat(rChat.Ok());
      dispatch({ type: "initChat", chat: rChat.Ok() });
      refreshAppSettings();
      attachSectionStream(rChat.Ok());
      // For CLI-pushed apps with no chat history, look up the latest fsId
      if (!fsId) {
        chatApi.getAppByFsId({ appSlug, ownerHandle }).then((rApp) => {
          if (rApp.isOk() && rApp.Ok().fsId) {
            navigateToFsId(rApp.Ok().fsId);
          }
        });
      }
    });
    return () => {
      if (chat) {
        (chat as LLMChat).close();
      }
    };
    // Dep array preserved verbatim from the route — the self-referential `chat`
    // dependency is what flips this effect from the open path to the fire path.
  }, [ownerHandle, appSlug, chat, openingRef, chatApi, promptToSend]);

  return { chat };
}
```

- [ ] **Step 2: Run the characterization tests — expect green**

Run: `cd vibes.diy/tests/app && npx vitest run ChatSession`
Expected: PASS (7 tests). If invariant 3's ordering assertion flakes, keep the `invocationCallOrder` check; do not add timers to the hook.

- [ ] **Step 3: Mutation-check the tests are not vacuous**

Temporarily change `sendPrompt(null);` to `sendPrompt("x");` → rerun → invariant-3 test FAILS. Revert. Temporarily change the cleanup to always `chat?.close()` unconditionally by hoisting it out of the `chat` guard → invariant-6 still passes (proves it pins "no close"); instead delete the early `return;` so the fire path falls through to register the cleanup → invariant-6 FAILS. Revert all mutations.

- [ ] **Step 4: Typecheck**

Run: `cd vibes.diy/pkg && pnpm run typecheck`
Expected: clean.

- [ ] **Step 5: Commit (gate (a))**

```bash
git add vibes.diy/pkg/app/hooks/useChatSession.ts vibes.diy/tests/app/ChatSession.test.tsx
git commit -m "test(chat): characterize chat session lifecycle in useChatSession"
```

---

## Task 4: Wire `useChatSession` into `Chat` and delete the moved code

**Files:**

- Modify: `vibes.diy/pkg/app/routes/chat/chat.$ownerHandle.$appSlug.tsx`

Line numbers below are against `main` as of this plan; re-confirm with a read before editing.

- [ ] **Step 1: Delete the now-duplicated lifecycle code from the route**

Remove these regions (each now lives in the hook):
- `:90` — `const [chat, setChat] = useState<LLMChat | null>(null);`
- `:91-96` — the `openingRef` / `prevSlugsRef` declarations + inline reset.
- `:117-121` — the `fsIdRef` comment + `useRef` + `fsIdRef.current = fsId;`.
- `:151-227` — `attachSectionStream`, `refreshAppSettings`, `handleStreamSilent`, `useStreamWatchdog(...)`, `openChatForReconnect`, `handleReconnectAttempt`, `handleReconnectGiveUp`, `useReconnectLoop(...)`. (Stop before `:229` — the `subscribeRecentVibesChanged` effect stays.)
- `:366-436` — the entire open-or-fire `useEffect`.

- [ ] **Step 2: Add the hook call**

Immediately after the `useChatHydration({ ... })` call (`:149`), insert:

```tsx
  // Chat handle + open/fire lifecycle + reconnect/watchdog (see useChatSession).
  const { chat } = useChatSession({
    ownerHandle,
    appSlug,
    fsId,
    inConstruction,
    chatApi,
    promptState,
    dispatch,
    promptToSend,
    sendPrompt,
    navigateToFsId,
  });
```

- [ ] **Step 3: Remove now-unused imports from the route**

After deletion, these are no longer referenced in the route — remove each only if a `grep` confirms zero remaining uses:
- `processStream` and `sectionEvent` (used only by `attachSectionStream`).
- `useStreamWatchdog`, `useReconnectLoop` hook imports.
- `getThemeBySlug` **only if** no other route code uses it (it is also used by `handleThemeSelect`/`handlePaletteSelect` — likely **keep**).
- `notifyRecentVibesChanged` **only if** unused elsewhere (`handleOnCodeSave` also calls it — likely **keep**).
- `type` from arktype **only if** unused elsewhere (verify).

Verify with: `for s in processStream sectionEvent useStreamWatchdog useReconnectLoop; do echo -n "$s "; grep -c "\b$s\b" 'vibes.diy/pkg/app/routes/chat/chat.$ownerHandle.$appSlug.tsx'; done` — each should print `1` (the import line only) → safe to remove that import.

- [ ] **Step 4: Confirm `chat` is still consumed**

`handleOnCodeSave` uses `chat` (`if (!chat) return;` and `chat.promptFS(...)`). It now reads the `chat` returned by `useChatSession` — no change needed beyond the destructure in Step 2. Confirm with `grep -n "\bchat\b" ...` that the only producers are the hook destructure.

- [ ] **Step 5: Typecheck**

Run: `cd vibes.diy/pkg && pnpm run typecheck`
Expected: clean. If TS reports `chat` used before declaration, move the `useChatSession` call above the first `chat` consumer (it is already above `handleOnCodeSave`).

- [ ] **Step 6: Lint the route + hook**

Run: `npx eslint "vibes.diy/pkg/app/routes/chat/chat.\$ownerHandle.\$appSlug.tsx" vibes.diy/pkg/app/hooks/useChatSession.ts`
Expected: 0 problems. (Watch for `import/no-duplicates` and unused-import errors.)

- [ ] **Step 7: Run the full relevant test set**

Run: `cd vibes.diy/tests/app && npx vitest run ChatSession ChatNavigation NavigationFix ViewControls`
Expected: all green (ChatSession 7 + ChatNavigation 9 + NavigationFix 3 + ViewControls 6 = 25).

- [ ] **Step 8: Commit (gate (b))**

```bash
git add "vibes.diy/pkg/app/routes/chat/chat.\$ownerHandle.\$appSlug.tsx"
git commit -m "refactor(chat): move stream lifecycle into useChatSession (no behavior change)"
```

---

## Task 5: Final gate

- [ ] **Step 1: Run `pnpm check`** (per spec — touches tested paths).

Run: `pnpm check`
Expected: format + build + test + lint pass. The pre-existing unrelated failures (network-activity, viewer-tag, img-gen, firefly-database, etc. — see PR #2420 notes) may still appear; confirm the chat suites are green and no **new** failures were introduced (compare against a `main` baseline run if unsure).

- [ ] **Step 2: Push and open the PR**

Open the PR with body noting: behavior-preserving, the 6 invariants under test, the deferred unmount-leak + #1972/#1842 fix as the next PR. Label `agent-created` + `technical-debt`, @-mention `@CharlieHelps` in a comment, subscribe.

---

## Self-Review notes

- **Spec coverage:** Goals (move open/fire effect + guard refs → hook; behavior-preserving; tests first; slim `Chat`) → Tasks 3, 4. Resolved decisions 1–5 → consolidated hook (Task 3), `chat` returned (Task 3 `ChatSession` interface + Task 4 Step 4), verbatim effect (Task 3 Step 1 dep-array comment), shared fake (Task 1), sequencing/leak deferred (this plan excludes (c)). Invariants 1–6 → Task 2 tests.
- **Not covered here (by design):** the #1972/#1842 nav-flash fix and the unmount cleanup-leak fix — separate follow-up PR, as locked in the spec's Resolved decisions.
