# Codegen Stream Disconnect Auto-Converge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the codegen WebSocket stream disconnects mid-generation, the `/chat` editor automatically reconnects and converges to the durably-persisted finished app instead of hanging on "Planning your app…" forever (issue #2334).

**Architecture:** Client-only fix in three layers: (1) `llm-chat.ts` closes the section stream on transport loss so the consumer sees a terminal signal instead of hanging; (2) a `connection` field in the prompt reducer plus a watchdog hook and a reconnect-loop hook drive a re-open/replay convergence cycle against the server's durable chat state (the same replay the page-reload path uses); (3) `ChatInput` shows "Reconnecting…" and, on give-up, a reload affordance. Convergence is detected precisely via the in-flight prompt's `streamId`: when a replayed `prompt.block-end` matches it, the turn is complete.

**Spec:** `docs/superpowers/specs/2026-06-11-codegen-stream-disconnect-design.md`

**Tech Stack:** React 18 (useReducer/hooks), arktype message guards, `@adviser/cement` `processStream`/`Result`/`OnFunc`, vitest + @testing-library/react.

**Key background for the implementer:**

- The section stream is a `TransformStream` filled by a WebSocket message handler in `vibes.diy/api/impl/llm-chat.ts`. Today `conn.onError(unreg)` / `conn.onClose(unreg)` only unregister the listener — the stream is never closed, so the route's `processStream` reader hangs forever. That is the entire bug mechanism.
- `processStream(stream, cb)` (from `@adviser/cement`, see `node_modules/.pnpm/@adviser+cement@*/node_modules/@adviser/cement/esm/utils/consume.js`) resolves when the stream reports `done` and rejects when the reader errors. So closing the writer is enough to give the route a terminal signal.
- The connection layer (`VibesDiyApi.getReadyConnection` in `vibes.diy/api/impl/index.ts:314-354`) already auto-reconnects the raw WebSocket after 1 s and replays doc/grant subscriptions — but NOT open LLM chats. A fresh `chatApi.openChat(...)` after reconnect works and the server replays the chat's persisted blocks from the DB.
- Live mid-stream events for an in-flight prompt are routed to the original connection's `tid` (`outerTid` in `llm-chat.ts`), so a re-opened chat cannot receive them live; it only gets the DB replay. That's why convergence polls by re-opening.
- `ResPromptChatSection` (returned by `chat.prompt()` and `chat.promptFS()`) carries `promptId`, which equals the `streamId` stamped on every `prompt.*` message for that turn (see the existing `pendingSavePromptIdRef` flow at `chat.$ownerHandle.$appSlug.tsx:884-907`).
- `prompt.block-begin` / `prompt.block-end` shapes: `{ type, streamId, chatId, seq, timestamp }` (`vibes.diy/api/types/prompt.ts:43-64`).
- Monorepo conventions: never push to main; `pnpm check` at repo root runs format+build+test+lint; app component tests live in `vibes.diy/tests/app` with the `~/vibes.diy/app/...` import alias; api impl tests are colocated (see `vibes.diy/api/impl/request-validation.test.ts`) and run via root vitest.

---

### Task 1: Extract the prompt reducer into `prompt-state.ts`

The route file `chat.$ownerHandle.$appSlug.tsx` is 1075 lines; the reducer (~240 lines) must be unit-testable without importing the whole route (which drags in Clerk, react-router, Fireproof). Pure move, no behavior change. Re-export from the route so existing importers of `PromptState` keep working.

**Files:**
- Create: `vibes.diy/pkg/app/routes/chat/prompt-state.ts`
- Modify: `vibes.diy/pkg/app/routes/chat/chat.$ownerHandle.$appSlug.tsx`

- [ ] **Step 1: Create `vibes.diy/pkg/app/routes/chat/prompt-state.ts`**

Move lines 88-329 of the route (the `PromptState`/`PromptBlock`/`HydratedCodeViewFile` interfaces, all action types/guards, and `promptReducer`) verbatim into the new file with these imports at the top:

```ts
import { SetURLSearchParams } from "react-router";
import { type } from "arktype";
import { isPromptBlockBegin, isPromptBlockEnd, LLMChatEntry, PromptAndBlockMsgs } from "@vibes.diy/api-types";
import { isCodeBegin } from "@vibes.diy/call-ai-v2";
import type { VibesTheme } from "@vibes.diy/prompts";
```

Export everything the route consumes: `export interface PromptState`, `export interface PromptBlock`, `export interface HydratedCodeViewFile`, `export type PromptAction`, `export function promptReducer`. The action interfaces/guards (`InitChat`, `SetTitle`, `SetIcon`, `SetTheme`, `SetColorTheme`, `SetHydratedSource`, `SetHydratedFileSystem`, `MarkAgentSaved`, `ClearChat` and their `isX` guards) move as-is and stay module-private except where already only used internally.

- [ ] **Step 2: Update the route file**

Delete the moved code from `chat.$ownerHandle.$appSlug.tsx` and add:

```ts
import { promptReducer, PromptAction, PromptState, PromptBlock, HydratedCodeViewFile } from "./prompt-state.js";

// Re-export so existing importers of these types from the route keep compiling.
export type { PromptState, PromptBlock, HydratedCodeViewFile } from "./prompt-state.js";
```

Remove now-unused route imports: `isPromptBlockBegin`, `isPromptBlockEnd` (only used by the reducer), and `PromptAndBlockMsgs`. Keep `isPromptReq`, `isBlockEnd`, `sectionEvent`, `LLMChat`, `LLMChatEntry`, `PromptError` — the route body still uses them. Check which other files import these types before assuming:

Run: `grep -rn "chat.\$ownerHandle.\$appSlug.js" vibes.diy/pkg/app --include="*.ts*" | grep -i "promptstate\|promptblock\|hydrated"`
Expected: any hits keep working via the re-export; no import changes needed elsewhere.

- [ ] **Step 3: Build and run existing app tests**

Run: `pnpm build`
Expected: clean build.

Run: `cd vibes.diy/tests/app && pnpm test`
Expected: same pass/fail profile as before the change (per `agents/flaky-tests.md`, rerun an unexpected failure in isolation before treating it as real).

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/pkg/app/routes/chat/prompt-state.ts vibes.diy/pkg/app/routes/chat/chat.\$ownerHandle.\$appSlug.tsx
git commit -m "refactor(chat): extract prompt reducer into prompt-state.ts (#2334)"
```

---

### Task 2: Connection state + disconnect/replay actions in the reducer

**Files:**
- Modify: `vibes.diy/pkg/app/routes/chat/prompt-state.ts`
- Modify: `vibes.diy/pkg/app/routes/chat/chat.$ownerHandle.$appSlug.tsx` (initial state only)
- Test: `vibes.diy/tests/app/prompt-state-reconnect.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `vibes.diy/tests/app/prompt-state-reconnect.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { promptReducer, PromptState } from "~/vibes.diy/app/routes/chat/prompt-state.js";
import { LLMChatEntry } from "@vibes.diy/api-types";

function baseState(overrides: Partial<PromptState> = {}): PromptState {
  return {
    chat: {} as LLMChatEntry,
    running: false,
    hasCode: false,
    title: "my-app",
    blocks: [],
    searchParams: new URLSearchParams(),
    setSearchParams: (() => undefined) as never,
    agentSavedBlockIds: new Set<string>(),
    connection: "live",
    ...overrides,
  };
}

function blockEnd(streamId: string) {
  return { type: "prompt.block-end" as const, streamId, chatId: "c1", seq: 9, timestamp: new Date() };
}

describe("promptReducer reconnect actions", () => {
  it("streamDisconnected while running enters reconnecting", () => {
    const next = promptReducer(baseState({ running: true }), { type: "streamDisconnected" });
    expect(next.connection).toBe("reconnecting");
  });

  it("streamDisconnected while idle is a no-op", () => {
    const state = baseState();
    expect(promptReducer(state, { type: "streamDisconnected" })).toBe(state);
  });

  it("streamDisconnected after giving up stays failed", () => {
    const state = baseState({ running: true, connection: "failed" });
    expect(promptReducer(state, { type: "streamDisconnected" })).toBe(state);
  });

  it("setInFlightStreamId records the active prompt's streamId", () => {
    const next = promptReducer(baseState(), { type: "setInFlightStreamId", streamId: "p-1" });
    expect(next.inFlightStreamId).toBe("p-1");
  });

  it("replayReset clears stream-derived state but keeps settings and inFlightStreamId", () => {
    const state = baseState({
      running: true,
      hasCode: true,
      blocks: [{ msgs: [] }],
      current: { msgs: [] },
      connection: "reconnecting",
      inFlightStreamId: "p-1",
      title: "kept-title",
    });
    const next = promptReducer(state, { type: "replayReset" });
    expect(next.blocks).toEqual([]);
    expect(next.current).toBeUndefined();
    expect(next.running).toBe(false);
    expect(next.hasCode).toBe(false);
    expect(next.connection).toBe("reconnecting");
    expect(next.inFlightStreamId).toBe("p-1");
    expect(next.title).toBe("kept-title");
  });

  it("block-end matching inFlightStreamId converges: running false, connection live, id cleared", () => {
    const state = baseState({ running: true, connection: "reconnecting", inFlightStreamId: "p-1" });
    const next = promptReducer(state, blockEnd("p-1"));
    expect(next.running).toBe(false);
    expect(next.connection).toBe("live");
    expect(next.inFlightStreamId).toBeUndefined();
  });

  it("historical block-end with a different streamId does not converge", () => {
    const state = baseState({ running: true, connection: "reconnecting", inFlightStreamId: "p-1" });
    const next = promptReducer(state, blockEnd("old-turn"));
    expect(next.running).toBe(false);
    expect(next.connection).toBe("reconnecting");
    expect(next.inFlightStreamId).toBe("p-1");
  });

  it("reconnectFailed enters failed and stops running", () => {
    const state = baseState({ running: true, connection: "reconnecting" });
    const next = promptReducer(state, { type: "reconnectFailed" });
    expect(next.connection).toBe("failed");
    expect(next.running).toBe(false);
  });

  it("clearChat resets connection to live and clears inFlightStreamId", () => {
    const state = baseState({ connection: "failed", inFlightStreamId: "p-1" });
    const next = promptReducer(state, { type: "clearChat", appSlug: "other" });
    expect(next.connection).toBe("live");
    expect(next.inFlightStreamId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd vibes.diy/tests/app && DISABLE_REACT_ROUTER=true pnpm exec vitest run prompt-state-reconnect.test.ts`
Expected: FAIL — type errors / unknown actions (`connection` not on `PromptState`, `streamDisconnected` not in `PromptAction`).

- [ ] **Step 3: Implement in `prompt-state.ts`**

Add to the module:

```ts
export type StreamConnection = "live" | "reconnecting" | "failed";

interface StreamDisconnected {
  type: "streamDisconnected";
}
function isStreamDisconnected(msg: unknown): msg is StreamDisconnected {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "streamDisconnected";
}

// Clears stream-derived state before consuming a re-opened chat's replay so
// replayed blocks don't double up. Settings-derived fields (title/icon/theme)
// and inFlightStreamId survive — the replay/refresh re-deliver or consume them.
interface ReplayReset {
  type: "replayReset";
}
function isReplayReset(msg: unknown): msg is ReplayReset {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "replayReset";
}

interface ReconnectFailed {
  type: "reconnectFailed";
}
function isReconnectFailed(msg: unknown): msg is ReconnectFailed {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "reconnectFailed";
}

interface SetInFlightStreamId {
  type: "setInFlightStreamId";
  streamId: string;
}
function isSetInFlightStreamId(msg: unknown): msg is SetInFlightStreamId {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "setInFlightStreamId";
}
```

Add to `PromptState`:

```ts
  // WebSocket section-stream health. "reconnecting" drives the re-open/replay
  // convergence loop; "failed" surfaces the reload affordance after the loop
  // gives up. The streamId of the turn in flight pins convergence to the right
  // prompt — replayed ends of historical turns must not flip us back to live.
  connection: StreamConnection;
  inFlightStreamId?: string;
```

Extend the `PromptAction` union with `| StreamDisconnected | ReplayReset | ReconnectFailed | SetInFlightStreamId`.

Add reducer cases (before the `isPromptBlockBegin` case) and modify two existing cases:

```ts
    case isStreamDisconnected(block):
      if (!state.running || state.connection !== "live") return state;
      return { ...state, connection: "reconnecting" };

    case isReplayReset(block):
      return { ...state, blocks: [], current: undefined, running: false, hasCode: false };

    case isReconnectFailed(block):
      return { ...state, connection: "failed", running: false };

    case isSetInFlightStreamId(block):
      return { ...state, inFlightStreamId: block.streamId };
```

Modify `isPromptBlockEnd` case:

```ts
    case isPromptBlockEnd(block): {
      const isInFlight = state.inFlightStreamId !== undefined && block.streamId === state.inFlightStreamId;
      return {
        ...state,
        running: false,
        ...(isInFlight ? { connection: "live" as const, inFlightStreamId: undefined } : {}),
      };
    }
```

Modify `isClearChat` case: add `connection: "live", inFlightStreamId: undefined,` to the returned object.

In the route's `useReducer` initial state (around line 443), add `connection: "live",`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd vibes.diy/tests/app && DISABLE_REACT_ROUTER=true pnpm exec vitest run prompt-state-reconnect.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/app/routes/chat/prompt-state.ts vibes.diy/pkg/app/routes/chat/chat.\$ownerHandle.\$appSlug.tsx vibes.diy/tests/app/prompt-state-reconnect.test.ts
git commit -m "feat(chat): connection state + reconnect actions in prompt reducer (#2334)"
```

---

### Task 3: Close the section stream on transport loss (`llm-chat.ts`)

**Files:**
- Modify: `vibes.diy/api/impl/llm-chat.ts:140-141, 250-252`
- Test: `vibes.diy/api/impl/llm-chat-disconnect.test.ts`

- [ ] **Step 1: Write the failing test**

Create `vibes.diy/api/impl/llm-chat-disconnect.test.ts` (mock pattern follows `request-validation.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { OnFunc, Result } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { LLMChatImpl } from "./llm-chat.js";
import { VibeDiyApiConnection } from "./api-connection.js";
import { W3CWebSocketCloseEvent, W3CWebSocketErrorEvent, W3CWebSocketMessageEvent } from "@vibes.diy/api-types";

function createMockConnection() {
  const onMessage = OnFunc<(event: W3CWebSocketMessageEvent) => void>();
  const onClose = OnFunc<(event: W3CWebSocketCloseEvent) => void>();
  const onError = OnFunc<(event: W3CWebSocketErrorEvent) => void>();
  const connection: VibeDiyApiConnection = {
    ctx: {},
    onMessage,
    onClose,
    onError,
    send: () => Result.Ok(undefined),
    close: async () => undefined,
  };
  return { connection, onClose, onError };
}

function stubApi(connection: VibeDiyApiConnection) {
  return {
    cfg: { sthis: ensureSuperThis() },
    getReadyConnection: async () => connection,
    send: async () => Result.Ok({} as never),
    request: async () => Result.Ok({ chatId: "chat-1", ownerHandle: "o", appSlug: "a", mode: "chat" }),
  };
}

async function openChat(connection: VibeDiyApiConnection) {
  const rChat = await LLMChatImpl.open(
    { ownerHandle: "o", appSlug: "a", mode: "chat" } as never,
    stubApi(connection) as never
  );
  expect(rChat.isOk()).toBe(true);
  return rChat.Ok();
}

describe("LLMChat section stream on transport loss", () => {
  it("closes the section stream when the connection closes", async () => {
    const { connection, onClose } = createMockConnection();
    const chat = await openChat(connection);
    const reader = chat.sectionStream.getReader();
    const pendingRead = reader.read();
    onClose.invoke({} as W3CWebSocketCloseEvent);
    const { done } = await pendingRead;
    expect(done).toBe(true);
  });

  it("closes the section stream when the connection errors", async () => {
    const { connection, onError } = createMockConnection();
    const chat = await openChat(connection);
    const reader = chat.sectionStream.getReader();
    const pendingRead = reader.read();
    onError.invoke({} as W3CWebSocketErrorEvent);
    const { done } = await pendingRead;
    expect(done).toBe(true);
  });

  it("explicit close() after transport loss does not throw", async () => {
    const { connection, onClose } = createMockConnection();
    const chat = await openChat(connection);
    onClose.invoke({} as W3CWebSocketCloseEvent);
    await expect(chat.close()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run vibes.diy/api/impl/llm-chat-disconnect.test.ts`
Expected: FAIL — the first two tests time out or hang-then-fail because `reader.read()` never resolves (the stream is never closed today). If vitest's default timeout makes the hang awkward, the failure mode is a test timeout — still a legitimate red.

- [ ] **Step 3: Implement**

In `vibes.diy/api/impl/llm-chat.ts`, replace lines 140-141:

```ts
    conn.onError(unreg);
    conn.onClose(unreg);
```

with:

```ts
    const closeOnTransportLoss = () => {
      unreg();
      // Close (not abort) so the route's processStream resolves cleanly and
      // can converge on the server's durable state. Catch: the writer may
      // already be closed (explicit close()) or aborted (evento error path).
      sectionEventsWriter.close().catch(() => undefined);
    };
    conn.onError(closeOnTransportLoss);
    conn.onClose(closeOnTransportLoss);
```

And make `close()` (line 250-252) tolerant of a writer already closed by transport loss:

```ts
  async close(_force = false) {
    await this.#writer.close().catch(() => undefined);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run vibes.diy/api/impl/llm-chat-disconnect.test.ts`
Expected: PASS (3 tests).

Also run the neighboring suite to catch regressions: `pnpm exec vitest run vibes.diy/api/impl/request-validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/impl/llm-chat.ts vibes.diy/api/impl/llm-chat-disconnect.test.ts
git commit -m "fix(api): close LLM chat section stream on websocket close/error (#2334)"
```

---

### Task 4: `useStreamWatchdog` hook

Catches half-open connections that never fire a close event: if a prompt is running on a live connection and no stream message arrives for 45 s, signal a disconnect. "Activity" is observed via `activityKey` — pass `promptState.blocks`, which gets a fresh array reference on every received message.

**Files:**
- Create: `vibes.diy/pkg/app/hooks/useStreamWatchdog.ts`
- Test: `vibes.diy/tests/app/useStreamWatchdog.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `vibes.diy/tests/app/useStreamWatchdog.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useStreamWatchdog, STREAM_WATCHDOG_TIMEOUT_MS } from "~/vibes.diy/app/hooks/useStreamWatchdog.js";

describe("useStreamWatchdog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires onSilent after the timeout while running on a live connection", () => {
    const onSilent = vi.fn();
    renderHook(() => useStreamWatchdog({ running: true, connection: "live", activityKey: [], onSilent }));
    vi.advanceTimersByTime(STREAM_WATCHDOG_TIMEOUT_MS);
    expect(onSilent).toHaveBeenCalledTimes(1);
  });

  it("does not fire when not running", () => {
    const onSilent = vi.fn();
    renderHook(() => useStreamWatchdog({ running: false, connection: "live", activityKey: [], onSilent }));
    vi.advanceTimersByTime(STREAM_WATCHDOG_TIMEOUT_MS * 2);
    expect(onSilent).not.toHaveBeenCalled();
  });

  it("does not fire while already reconnecting", () => {
    const onSilent = vi.fn();
    renderHook(() => useStreamWatchdog({ running: true, connection: "reconnecting", activityKey: [], onSilent }));
    vi.advanceTimersByTime(STREAM_WATCHDOG_TIMEOUT_MS * 2);
    expect(onSilent).not.toHaveBeenCalled();
  });

  it("resets the timer when activityKey changes", () => {
    const onSilent = vi.fn();
    const { rerender } = renderHook(({ key }) => useStreamWatchdog({ running: true, connection: "live", activityKey: key, onSilent }), {
      initialProps: { key: [1] as unknown },
    });
    vi.advanceTimersByTime(STREAM_WATCHDOG_TIMEOUT_MS - 1000);
    rerender({ key: [2] as unknown });
    vi.advanceTimersByTime(STREAM_WATCHDOG_TIMEOUT_MS - 1000);
    expect(onSilent).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onSilent).toHaveBeenCalledTimes(1);
  });

  it("disarms on unmount", () => {
    const onSilent = vi.fn();
    const { unmount } = renderHook(() => useStreamWatchdog({ running: true, connection: "live", activityKey: [], onSilent }));
    unmount();
    vi.advanceTimersByTime(STREAM_WATCHDOG_TIMEOUT_MS * 2);
    expect(onSilent).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/tests/app && DISABLE_REACT_ROUTER=true pnpm exec vitest run useStreamWatchdog.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `vibes.diy/pkg/app/hooks/useStreamWatchdog.ts`:

```ts
import { useEffect } from "react";
import type { StreamConnection } from "../routes/chat/prompt-state.js";

// LLM turns can have multi-second silent gaps, but the server's delta stream
// emits regularly while generating — 45s of total silence on a running prompt
// means the transport is gone (half-open TCP never fires onclose).
export const STREAM_WATCHDOG_TIMEOUT_MS = 45_000;

export interface StreamWatchdogOpts {
  readonly running: boolean;
  readonly connection: StreamConnection;
  // Any value whose identity changes on every received stream message
  // (promptState.blocks — the reducer replaces the array per message).
  readonly activityKey: unknown;
  readonly onSilent: () => void;
  readonly timeoutMs?: number;
}

export function useStreamWatchdog(opts: StreamWatchdogOpts): void {
  const { running, connection, activityKey, onSilent } = opts;
  const timeoutMs = opts.timeoutMs ?? STREAM_WATCHDOG_TIMEOUT_MS;
  useEffect(() => {
    if (!running || connection !== "live") return;
    const timer = setTimeout(onSilent, timeoutMs);
    return () => clearTimeout(timer);
  }, [running, connection, activityKey, onSilent, timeoutMs]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vibes.diy/tests/app && DISABLE_REACT_ROUTER=true pnpm exec vitest run useStreamWatchdog.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/app/hooks/useStreamWatchdog.ts vibes.diy/tests/app/useStreamWatchdog.test.tsx
git commit -m "feat(chat): stream inactivity watchdog hook (#2334)"
```

---

### Task 5: `useReconnectLoop` hook

While `connection === "reconnecting"`, repeatedly: close the previous attempt's chat handle, re-open the chat, hand it to `onAttempt` (the route resets state and consumes the replay), and wait 5 s. The loop exits when the reducer flips `connection` to `"live"` (a replayed `prompt.block-end` matched `inFlightStreamId`) or calls `onGiveUp` after 2 minutes.

**Files:**
- Create: `vibes.diy/pkg/app/hooks/useReconnectLoop.ts`
- Test: `vibes.diy/tests/app/useReconnectLoop.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `vibes.diy/tests/app/useReconnectLoop.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useReconnectLoop } from "~/vibes.diy/app/hooks/useReconnectLoop.js";
import type { LLMChat } from "@vibes.diy/api-types";
import type { StreamConnection } from "~/vibes.diy/app/routes/chat/prompt-state.js";

function fakeChat(): LLMChat {
  return { close: vi.fn(async () => undefined) } as unknown as LLMChat;
}

describe("useReconnectLoop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing while connection is live", async () => {
    const openChat = vi.fn(async () => fakeChat());
    renderHook(() =>
      useReconnectLoop({ connection: "live", openChat, onAttempt: vi.fn(), onGiveUp: vi.fn() })
    );
    await vi.advanceTimersByTimeAsync(30_000);
    expect(openChat).not.toHaveBeenCalled();
  });

  it("opens a chat and calls onAttempt, then retries on the interval until connection leaves reconnecting", async () => {
    const chats: LLMChat[] = [];
    const openChat = vi.fn(async () => {
      const c = fakeChat();
      chats.push(c);
      return c;
    });
    const onAttempt = vi.fn();
    const { rerender } = renderHook(
      ({ connection }: { connection: StreamConnection }) =>
        useReconnectLoop({ connection, openChat, onAttempt, onGiveUp: vi.fn(), attemptIntervalMs: 1000, maxTotalMs: 60_000 }),
      { initialProps: { connection: "reconnecting" as StreamConnection } }
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(onAttempt).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(onAttempt).toHaveBeenCalledTimes(2);
    // The stale first attempt's handle was closed before re-opening.
    expect(chats[0].close).toHaveBeenCalled();

    // Reducer converged: connection back to live — loop stops, keeps the last chat open.
    rerender({ connection: "live" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(onAttempt).toHaveBeenCalledTimes(2);
    expect(chats[1].close).not.toHaveBeenCalled();
  });

  it("keeps retrying when openChat fails, then gives up after maxTotalMs", async () => {
    const openChat = vi.fn(async () => null);
    const onGiveUp = vi.fn();
    renderHook(() =>
      useReconnectLoop({
        connection: "reconnecting",
        openChat,
        onAttempt: vi.fn(),
        onGiveUp,
        attemptIntervalMs: 1000,
        maxTotalMs: 3500,
      })
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(openChat).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4000);
    expect(onGiveUp).toHaveBeenCalledTimes(1);
    const callsAtGiveUp = openChat.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(openChat).toHaveBeenCalledTimes(callsAtGiveUp);
  });

  it("cancels cleanly on unmount", async () => {
    const openChat = vi.fn(async () => fakeChat());
    const onAttempt = vi.fn();
    const { unmount } = renderHook(() =>
      useReconnectLoop({ connection: "reconnecting", openChat, onAttempt, onGiveUp: vi.fn(), attemptIntervalMs: 1000 })
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(onAttempt).toHaveBeenCalledTimes(1);
    unmount();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(onAttempt).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/tests/app && DISABLE_REACT_ROUTER=true pnpm exec vitest run useReconnectLoop.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `vibes.diy/pkg/app/hooks/useReconnectLoop.ts`:

```ts
import { useEffect, useRef } from "react";
import type { LLMChat } from "@vibes.diy/api-types";
import type { StreamConnection } from "../routes/chat/prompt-state.js";

export const RECONNECT_ATTEMPT_INTERVAL_MS = 5_000;
export const RECONNECT_MAX_TOTAL_MS = 120_000;

export interface ReconnectLoopOpts {
  readonly connection: StreamConnection;
  // Re-open the chat; resolve null when the open itself fails (counts as a retry).
  readonly openChat: () => Promise<LLMChat | null>;
  // Hand a freshly-opened chat to the route: replayReset + initChat + attach
  // the section stream + refresh app settings. The replayed blocks flow
  // through the reducer; a block-end matching inFlightStreamId flips
  // connection back to "live", which ends this loop.
  readonly onAttempt: (chat: LLMChat) => void;
  readonly onGiveUp: () => void;
  readonly attemptIntervalMs?: number;
  readonly maxTotalMs?: number;
}

export function useReconnectLoop(opts: ReconnectLoopOpts): void {
  const { connection } = opts;
  const attemptIntervalMs = opts.attemptIntervalMs ?? RECONNECT_ATTEMPT_INTERVAL_MS;
  const maxTotalMs = opts.maxTotalMs ?? RECONNECT_MAX_TOTAL_MS;
  const connectionRef = useRef(connection);
  connectionRef.current = connection;
  const cbRef = useRef({ openChat: opts.openChat, onAttempt: opts.onAttempt, onGiveUp: opts.onGiveUp });
  cbRef.current = { openChat: opts.openChat, onAttempt: opts.onAttempt, onGiveUp: opts.onGiveUp };

  useEffect(() => {
    if (connection !== "reconnecting") return;
    let cancelled = false;
    let prevAttempt: LLMChat | null = null;
    const startedAt = Date.now();
    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    void (async () => {
      while (!cancelled && connectionRef.current === "reconnecting") {
        if (Date.now() - startedAt >= maxTotalMs) {
          cbRef.current.onGiveUp();
          return;
        }
        // The previous attempt didn't converge — its replay is stale. Drop it
        // before opening a fresh one. Once converged the loop exits without
        // closing, leaving the last attempt as the route's active chat.
        void prevAttempt?.close();
        prevAttempt = null;
        const chat = await cbRef.current.openChat();
        if (cancelled) {
          void chat?.close();
          return;
        }
        if (chat) {
          prevAttempt = chat;
          cbRef.current.onAttempt(chat);
        }
        await sleep(attemptIntervalMs);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connection, attemptIntervalMs, maxTotalMs]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vibes.diy/tests/app && DISABLE_REACT_ROUTER=true pnpm exec vitest run useReconnectLoop.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/app/hooks/useReconnectLoop.ts vibes.diy/tests/app/useReconnectLoop.test.tsx
git commit -m "feat(chat): reconnect convergence loop hook (#2334)"
```

---

### Task 6: ChatInput reconnecting/failed UI

**Files:**
- Modify: `vibes.diy/pkg/app/components/ChatInput.tsx`
- Test: `vibes.diy/tests/app/ChatInput.test.tsx` (extend)

- [ ] **Step 1: Write the failing tests**

Append to the `describe("ChatInput Component", ...)` block in `vibes.diy/tests/app/ChatInput.test.tsx`:

```tsx
  it("shows Reconnecting and keeps send disabled while reconnecting", () => {
    render(
      <MockThemeProvider>
        <ChatInput promptProcessing={false} connectionState="reconnecting" onSubmit={onSubmit} />
      </MockThemeProvider>
    );
    const sendButton = screen.getByLabelText("Processing");
    expect(sendButton).toBeDisabled();
    expect(screen.getByText("Reconnecting...")).toBeDefined();
    fireEvent.click(sendButton);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows a reload affordance when the connection has failed", () => {
    render(
      <MockThemeProvider>
        <ChatInput promptProcessing={false} connectionState="failed" onSubmit={onSubmit} />
      </MockThemeProvider>
    );
    expect(screen.getByText(/Connection lost/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Reload" })).toBeDefined();
    // Send is re-enabled so the user can also just prompt again.
    expect(screen.getByLabelText("Send message")).toBeDefined();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd vibes.diy/tests/app && DISABLE_REACT_ROUTER=true pnpm exec vitest run ChatInput.test.tsx`
Expected: the two new tests FAIL (no `connectionState` prop, no banner); existing tests PASS.

- [ ] **Step 3: Implement in `ChatInput.tsx`**

Add to `ChatInputProps`:

```ts
  // Section-stream health from the chat route. "reconnecting" keeps the
  // submit path gated and swaps the working label; "failed" renders the
  // reload affordance so the UI is never permanently stuck.
  connectionState?: "live" | "reconnecting" | "failed";
```

Destructure `connectionState = "live"` in the component. Then:

1. Define `const busy = promptProcessing || connectionState === "reconnecting";` right after the destructure, and replace `promptProcessing` with `busy` in: the `handleSendPrompt` guard, the `onKeyDown` Enter guard, and ALL button-row usages (the wrapper `padding`/`background`/`animation`, the `disabled`, `aria-label`, `className`, `style`, and label ternaries of the submit `Button`). `promptProcessing` should no longer appear below its destructuring except inside the `busy` definition and the `useCallback` dep arrays (update those to `busy`).

2. Change the working-message memo:

```ts
    const workingMessage = useMemo(
      () => (connectionState === "reconnecting" ? "Reconnecting..." : getWorkingMessage(hasCode, currentMsgCount)),
      [connectionState, hasCode, currentMsgCount]
    );
```

3. Render the failure banner as the first child inside the `space-y-1` div (above the theme/palette row):

```tsx
          {connectionState === "failed" && (
            <div className="flex items-center justify-between gap-2 rounded border border-light-decorative-01 dark:border-dark-decorative-01 px-2 py-1.5 text-xs text-light-secondary dark:text-dark-secondary">
              <span>Connection lost — your app may have finished building.</span>
              <Button type="button" variant="blue" onClick={() => window.location.reload()}>
                Reload
              </Button>
            </div>
          )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd vibes.diy/tests/app && DISABLE_REACT_ROUTER=true pnpm exec vitest run ChatInput.test.tsx`
Expected: PASS, including all pre-existing ChatInput tests.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/app/components/ChatInput.tsx vibes.diy/tests/app/ChatInput.test.tsx
git commit -m "feat(chat): reconnecting + connection-failed states in ChatInput (#2334)"
```

---

### Task 7: Wire it all up in the chat route

**Files:**
- Modify: `vibes.diy/pkg/app/routes/chat/chat.$ownerHandle.$appSlug.tsx`

No new unit test — the pieces are covered by Tasks 2-6; this task is mechanical wiring verified by build + full app suite + the manual QA in Task 8.

- [ ] **Step 1: Extract `attachSectionStream` and `refreshAppSettings`, capture in-flight streamId**

Add above the open-chat effect (after the `promptState`/`dispatch` declaration):

```ts
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
          // Stream ended (transport loss closes it as of #2334). The reducer
          // ignores this while idle; mid-prompt it starts the reconnect loop.
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
```

In the open-chat effect (currently lines 686-727): replace the inline `chatApi.ensureAppSettings(...)` block (lines 693-706) with `refreshAppSettings();` and replace the `void processStream(rChat.Ok().sectionStream, ...)` block (lines 707-716) with `attachSectionStream(rChat.Ok());`.

In the prompt-send `.then` (lines 674-681), record the turn's streamId on success:

```ts
          .then((r) => {
            if (r.isErr()) {
              console.error(`PromptSend failed`, r.Err());
            } else {
              dispatch({ type: "setInFlightStreamId", streamId: r.Ok().promptId });
              notifyRecentVibesChanged();
            }
          });
```

(Note this also fixes the pre-existing `r.Ok()`-on-error logging bug; drop the `console.log("send prompt", ...)` line.)

In `handleOnCodeSave`'s success branch (after `pendingSavePromptIdRef.current = r.Ok().promptId;` around line 884), add:

```ts
          dispatch({ type: "setInFlightStreamId", streamId: r.Ok().promptId });
```

- [ ] **Step 2: Mount the watchdog and reconnect loop**

Add imports:

```ts
import { useStreamWatchdog } from "../../hooks/useStreamWatchdog.js";
import { useReconnectLoop } from "../../hooks/useReconnectLoop.js";
```

Add after the `attachSectionStream`/`refreshAppSettings` callbacks:

```ts
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
```

- [ ] **Step 3: Pass `connectionState` to ChatInput**

In the `<ChatInput ... />` JSX (around line 1028), add:

```tsx
              connectionState={promptState.connection}
```

- [ ] **Step 4: Build and run the full app test suite**

Run: `pnpm build`
Expected: clean build (TypeScript will catch any wiring mistakes — e.g. `LLMChat` import still present, `PromptAction` accepting the new dispatches).

Run: `cd vibes.diy/tests/app && pnpm test`
Expected: same pass profile as main plus the new suites (rerun any unexpected failure in isolation per `agents/flaky-tests.md`).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/app/routes/chat/chat.\$ownerHandle.\$appSlug.tsx
git commit -m "feat(chat): auto-converge codegen UI after stream disconnect (#2334)"
```

---

### Task 8: Full check + manual QA against local dev

- [ ] **Step 1: Run the full repo check**

Run: `pnpm check` (from repo root)
Expected: format, build, test, lint all green. Fix anything it flags; if a test failure looks unrelated, rerun it in isolation before treating it as real (`agents/flaky-tests.md`), and log persistent flakes to VibesDIY/vibes.diy#1515.

- [ ] **Step 2: Manual QA — verify the spec's open item and the end-to-end behavior**

This validates the design's verification item: that the open-chat replay includes the terminal block once the server persists it.

1. Start the dev server: `pnpm dev`.
2. Open `/chat`, submit a generation prompt for a new app.
3. While "Planning your app…" / "Writing code..." is showing, kill the WebSocket with a **real socket close** — devtools Network "Offline" throttling does NOT sever an established WebSocket (long-standing Chromium limitation; verified during the 2026-06-12 qa-pr pass, where a 10 s offline window left the stream streaming). Easiest recipe: before the turn, run in the console `const O = WebSocket; window.__qaSockets = []; WebSocket = class extends O { constructor(...a){ super(...a); __qaSockets.push(this); } }` and reload; then mid-stream run `__qaSockets.filter(s => s.url.includes("/api?shard") && s.readyState === 1).forEach(s => s.close())`. (Alternatively kill the actual network interface — Wi-Fi off — rather than devtools throttling.) The API layer reconnects the socket, and the new loop re-opens the chat.
4. Expected: button label flips to "Reconnecting...", and within ~5-15 s of the backend finishing (watch the dev server log for the icon/screenshot lines), the UI converges: the finished app renders, tabs enable, no page reload.
5. Repeat on an edit turn (submit a follow-up prompt on the same app, kill the network mid-stream) — same convergence expected.
6. Negative path: kill the network and leave it off (a real interface kill — Wi-Fi off — not devtools throttling, per the note in step 3). Expected: after ~2 minutes the banner "Connection lost — your app may have finished building." with a Reload button appears; the UI is not stuck on a working label.

> **QA status (2026-06-12):** steps 1–5 were verified against the PR #2346 preview deploy via the socket-close recipe above — "Reconnecting..." appeared and the UI auto-converged to the finished edit (no reload), with publish/remix working on the converged state ([qa-pr triage](https://gist.github.com/popmechanic/4856808f600c0a5f4e26ff5dbeb20928)). Step 6 (give-up banner) remains covered by unit tests only.

If step 4 does NOT converge (replay missing the terminal block), stop and re-read `vibes.diy/api/svc/public/prompt-chat-section.ts` `handleEndMsg` — the convergence detection may need to key on a different replayed message; report findings before changing the design.

- [ ] **Step 3: Final commit (any QA-driven fixes) and wrap up**

```bash
git add -A && git commit -m "fix(chat): QA follow-ups for stream-disconnect convergence (#2334)"
```

Then use the superpowers:finishing-a-development-branch skill (branch: `popmechanic/issue-2334-stream-disconnect`, PR target: `main`, rebase — never squash, never push to main). PR title per `agents/pr-lifecycle.md`: feature-goal style, e.g. "Codegen UI recovers automatically when the generation stream disconnects". Link issue #2334 and the spec.
