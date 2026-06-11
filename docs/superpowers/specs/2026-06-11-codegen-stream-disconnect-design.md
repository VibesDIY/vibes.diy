# Codegen stream disconnect: auto-converge to durable completion state

**Issue:** [#2334](https://github.com/VibesDIY/vibes.diy/issues/2334)
**Date:** 2026-06-11
**Status:** Approved design

## Problem

When the browser's codegen stream disconnects mid-generation, the `/chat` editor stays on "Planning your app…" forever, even though the backend finishes generation and persists everything (chat sections, `app_settings`, icon, screenshot). Only a manual page reload reveals the finished app.

### Root cause

The section stream rides on a WebSocket. In `LLMChatImpl.open` (`vibes.diy/api/impl/llm-chat.ts:140-141`), the connection's `onError`/`onClose` handlers only unregister the message listener — they never close or error the `sectionEvents` TransformStream. The route's `processStream` reader (`vibes.diy/pkg/app/routes/chat/chat.$ownerHandle.$appSlug.tsx:693`, invoked with `void` and no catch) waits forever on a stream that will never produce another message. The reducer's `running` flag never resets, `hasCode` never flips, and `getWorkingMessage()` (`vibes.diy/pkg/app/components/ChatInput.tsx`) keeps returning "Planning your app…".

### Affected paths

First generation and edit turns (`chat.prompt()` and `chat.promptFS()`) share the identical `processStream` consumption path — **all prompt paths are affected**, plus plain reconnects after a transient network blip. (Answers the repro-scope question on the issue.)

### Why reload works

Mount re-opens the chat (the server replays persisted blocks from the DB), fetches the `app_settings` document, and hydrates the file-system snapshot. That replay path is the durable source of truth this design converges on without a page reload.

## Design

Client-only change; no server protocol changes.

### 1. Make the disconnect observable (`llm-chat.ts`)

On connection `onClose`/`onError`, in addition to unregistering the message listener, write a synthetic `stream-disconnected` event into `sectionEventsWriter` and close it. The route's stream consumer then sees a terminal signal instead of hanging. Also wrap the route's `processStream` call with `catch`/`finally` so a stream error itself dispatches the same disconnect action instead of being swallowed.

### 2. Inactivity watchdog (route)

While a prompt is `running`, if no stream message arrives for **45 seconds**, dispatch the same disconnect action. This catches half-open connections that never fire a close event. The timer resets on every received block and is disarmed when not running.

### 3. Auto-converge on durable state (route)

On disconnect-while-running, the route enters a `reconnecting` state and loops with backoff:

1. Re-open the chat via the same `LLMChat.open` call used on mount.
2. Reset section/block state, then consume the re-opened chat's replay stream through the existing reducer (mirroring mount hydration, including `ensureAppSettings` and file-system hydration from the latest `fsRef`).
3. If the replay contains the terminal block for the in-flight prompt, state converges: `running` resets, the finished app renders. Done.
4. If generation is still in flight server-side (no terminal block yet — the server persists at block end), close that chat handle and retry after **5 seconds**.

Subsequent prompts use the new chat handle. A single in-flight convergence loop is enforced (guard flag) so repeated disconnect signals don't stack loops.

Live mid-stream resume was considered and rejected: the server streams to the original connection's `outerTid`, so a reconnected client cannot rejoin a live stream without server protocol changes. Poll-via-reopen reaches the same end state seconds later with client-only changes.

### 4. UI states (`ChatInput.tsx` / route)

- While converging: show **"Reconnecting…"** instead of the frozen working message.
- If convergence has not succeeded after **2 minutes**: show an error message with a **reload button** — the UI is never permanently stuck.

### 5. Verification item (during implementation)

Confirm the open-chat replay includes the terminal block once `handleEndMsg` persists it (`vibes.diy/api/svc/public/prompt-chat-section.ts`). Strongly indicated by the reload behavior; verify with a deliberate mid-generation disconnect against the local dev server before building the convergence loop on top of it.

## Error handling

- Re-open attempt itself fails (network still down): counts as a retry; loop continues with the 5 s backoff until the 2-minute cap.
- Duplicate block dispatch on replay: prevented by resetting section state before consuming the replay (same as mount).
- Disconnect while *not* running: close/cleanup only; no convergence loop, no UI change beyond normal reconnect of the API connection.
- User submits a new prompt while reconnecting: input stays disabled until convergence or the 2-minute failure state (matches existing `promptProcessing` gating).

## Testing

- **Unit:** reducer actions for `disconnected`, `reconnecting`, `converged`; watchdog arm/reset/disarm; `getWorkingMessage` shows "Reconnecting…".
- **Integration:** sever the mocked connection mid-stream; assert a disconnect event reaches the consumer, the convergence loop re-opens the chat, and replayed blocks (including the terminal block) drive the UI to the finished state. Second case: replay without terminal block → retry → terminal block on second replay.
- **Manual QA:** kill the network in devtools mid-generation against local dev; confirm the UI converges to the finished app without reload; repeat on an edit turn.
