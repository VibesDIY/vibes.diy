# Chat Stream-Lifecycle Extraction — Design

**Date:** 2026-06-18
**Scope:** `vibes.diy/pkg/app/routes/chat/chat.$ownerHandle.$appSlug.tsx` — the open-chat / fire-prompt effect and its surrounding stream-lifecycle state.
**Status:** Draft — open questions for review (see "Questions for review"). Not yet ready for an implementation plan.
**Parent:** #2015 (chat god-component decomposition). Follow-up to PR #2420, which extracted `useChatNavigation` / `useChatOwnership` / `useChatHydration` / `useMobilePreviewFlip` and deliberately left this cluster for a dedicated PR.

## Problem

PR #2420 took `Chat` from 848→702 lines by extracting four low/medium-risk effect clusters. The single highest-risk cluster was intentionally left behind: the **open-chat / fire-prompt** effect (`chat.$ownerHandle.$appSlug.tsx:366–436`) and the mutable guard refs that protect it from nav/prompt loops. It is the last big thing standing between `Chat` and "param parsing + hooks + JSX".

This effect is hard to reason about and untested because it does several things at once and is wired to state it also mutates:

- It is **two effects in one body**, switched on `openingRef.current`: the *open* path (first run) and the *fire* path (subsequent runs once a prompt is queued).
- Its dependency array is **self-referential**: `[ownerHandle, appSlug, chat, openingRef, chatApi, promptToSend]` — it calls `setChat(...)` in the open path and depends on `chat` to take the fire path on the next render.
- It owns three guard refs whose entire reason for existing is to break loops: `openingRef` (open-once latch, reset inline in the render body at `:93–96` when the slug pair changes), `prevSlugsRef` (the slug-change detector for that reset), and `fsIdRef` (read so autosave-driven `fsId` changes don't re-fire the same prompt — the classic loop documented at `:117–119`).
- It enforces a **`sendPrompt(null)`-before-fire ordering** (`:381–383`) so a re-render mid-fire sees `null` and skips the branch.
- It is **entangled with the already-extracted reconnect/watchdog hooks**: `attachSectionStream` (`:151`), `refreshAppSettings` (`:175`), and `setChat` are all shared between this effect and `useReconnectLoop` (`:222`) / `handleReconnectAttempt` (`:209`).

There is no component-level test for `Chat` and no test exercising these guards, so the nav-flash bug (#1972) and the "edit turns enqueue but app unchanged" symptom (#1842) — both of which live on this surface — can't be reproduced or fixed under test.

## Goals

- Move the open-chat / fire-prompt effect and its three guard refs (`openingRef`, `prevSlugsRef`, `fsIdRef`) out of the `Chat` body into a single named hook.
- Land it as a **behavior-preserving** refactor on its own commit (no nav-timing, no guard-semantics, no markup change) — exactly the contract PR #2420 honored.
- Add characterization tests **first** (separate prior commit) that pin the loop-guard behavior, mirroring `ChatNavigation.test.tsx`.
- Leave `Chat` as: param parsing → reducer → hook calls → presentation callbacks → JSX.

## Non-goals

- Fixing #1972 / #1842. Those are the *next* PR, built on top once this surface is testable. Bundling them would make the refactor unprovable.
- Re-architecting the reconnect/watchdog hooks or the reducer.
- Splitting the single open/fire effect into two genuinely separate effects (tempting, but that is a behavior change — see Q3).

## Current entanglement map

The "stream lifecycle" surface, as it stands on `main` today:

| Piece | Location | Read by | Written by |
|---|---|---|---|
| `chat` / `setChat` | `:90` | `handleOnCodeSave`, open/fire effect, cleanup | open effect, `handleReconnectAttempt` |
| `promptToSend` / `sendPrompt` | `:108` | open/fire effect | `handleSelectOption`, `handleRetry`, `ChatInput.onSubmit` |
| `openingRef` + inline reset | `:91`, `:93–96` | open/fire effect | render body, open effect |
| `prevSlugsRef` | `:92` | render body | render body |
| `fsIdRef` | `:120–121` | open/fire effect | every render |
| `attachSectionStream` | `:151–173` | open effect, `handleReconnectAttempt` | — |
| `refreshAppSettings` | `:175–190` | open effect, `handleReconnectAttempt` | — |
| open/fire effect | `:366–436` | — | `chat`, `promptToSend`, optimistic prompt, navigation |
| `useStreamWatchdog` | `:193–198` | — | — |
| `useReconnectLoop` + callbacks | `:200–227` | — | `chat` |

The key observation: **`chat`, `setChat`, `attachSectionStream`, and `refreshAppSettings` are shared between the open/fire effect and the reconnect path.** Any extraction has to decide where that shared core lives.

## Proposed design

Introduce **`useChatSession`** (`pkg/app/hooks/useChatSession.ts`) as the single owner of the chat handle and its lifecycle. It absorbs the open/fire effect, the three guard refs, and the shared `attachSectionStream` / `refreshAppSettings` / reconnect callbacks (which already only exist to serve open + reconnect).

```ts
export interface ChatSessionOpts {
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly fsId: string | undefined;
  readonly inConstruction: boolean;
  readonly chatApi: VibesDiyApiIface;
  readonly promptState: PromptState;          // for connection (reconnect) + running
  readonly dispatch: Dispatch<PromptAction>;
  readonly promptToSend: string | null;
  readonly sendPrompt: (v: string | null) => void;
  readonly navigateToFsId: ChatNavigation["navigateToFsId"];
}

export interface ChatSession {
  readonly chat: LLMChat | null;              // consumed by handleOnCodeSave
}

export function useChatSession(opts: ChatSessionOpts): ChatSession;
```

Inside the hook, **verbatim** moves of: `attachSectionStream`, `refreshAppSettings`, `openChatForReconnect`, `handleReconnectAttempt`, `handleReconnectGiveUp`, `handleStreamSilent`, `useStreamWatchdog(...)`, `useReconnectLoop(...)`, the `openingRef`/`prevSlugsRef` reset, `fsIdRef`, and the open/fire effect with its **exact** dep array. `chat`/`setChat` become hook-internal; the hook returns `chat` for `handleOnCodeSave`.

`promptToSend`/`sendPrompt` **stay in the component** (three other call sites use them) and are passed in — this is the one piece of shared state that genuinely can't migrate cleanly.

Expected result: `Chat` loses ~120 lines and ends with no bare `useEffect` related to streaming.

## Invariants that MUST be preserved (test targets)

1. The fire path does **not** re-fire when only `fsId` changes (reads `fsIdRef.current`, `fsId` not in deps).
2. The open path runs **once per slug pair**; `openingRef` resets on slug change so a cross-vibe navigation re-opens.
3. `sendPrompt(null)` happens **before** `chat.prompt(...)` so a mid-fire re-render skips the branch.
4. A failed `chat.prompt()` clears the optimistic bubble (`setOptimisticPrompt(undefined)`); a success sets `inFlightStreamId` + `notifyRecentVibesChanged()`.
5. CLI-pushed app with no `fsId` and no history → `getAppByFsId` lookup → `navigateToFsId`.
6. **Cleanup quirk — preserve, do not "fix".** The effect's cleanup (`return () => chat?.close()`) is registered **only on the open-path render**, when `chat` is still `null`; the render after `setChat(...)` re-runs the effect, takes the `openingRef.current` early `return`, and registers **no** cleanup. So under current code the **active chat handle is never closed on unmount** — the only cleanup ever installed captured `chat === null` and is a no-op. The extraction must reproduce this exactly; the hook must **not** start closing the live handle, or it changes lifecycle semantics and is no longer behavior-preserving. The characterization test should therefore assert that unmount **does not** call `chat.close()` (pinning current behavior). Closing the handle on unmount is a real latent leak, but fixing it is a candidate follow-up (see Q5), not part of this PR.

## Test strategy

Add `pkg/app/.../useChatSession.test.tsx` (or `tests/app/ChatSession.test.tsx`) **before** the refactor commit, using `renderHook` with:
- a fake `LLMChat` (`{ prompt, promptFS, close, sectionStream }`) — **Q4: is there an existing chat test double, or do we hand-roll one?**
- a mocked `chatApi` (`openChat`, `getAppByFsId`, `ensureAppSettings`) returning `Result`s,
- spies for `navigateToFsId`, `sendPrompt`, `dispatch`.

Assert invariants 1–6. Mirror the mutation-testing discipline used on `ChatNavigation` (break a guard → confirm a red test) before declaring green.

## Questions for review

1. **Hook boundary.** One consolidated `useChatSession` that also absorbs `useReconnectLoop`/`useStreamWatchdog` and the shared `attachSectionStream`/`refreshAppSettings` (cleaner, bigger blast radius) — **or** a narrow `useChatStreamLifecycle` that takes only the open/fire effect and leaves reconnect/watchdog and those two callbacks in the component (smaller diff, but the shared core stays split)? I lean consolidated.
2. **Ownership of `chat`.** OK for `chat`/`setChat` to become hook-internal and be returned for `handleOnCodeSave`? Or keep `chat` in the component and pass `setChat` into the hook?
3. **The self-referential effect.** Preserve the single open-or-fire effect with its exact `[…, chat, …, promptToSend]` dep array verbatim (lowest risk) — confirming we do **not** split it into separate open/fire effects in this PR? (Splitting is cleaner but a behavior change; I'd defer it.)
4. **Chat test double.** Is there an existing fake/mocked `LLMChat` in the test suite to reuse, or should this PR introduce one (and where should it live so future chat-route tests share it)?
5. **Sequencing vs. #1972/#1842 (and the cleanup leak).** Confirm this PR stays strictly behavior-preserving and the nav-flash fix lands as the immediately-following PR on top of these tests? And the unmount cleanup leak (invariant 6) — fold it into that follow-up, give it its own tiny PR, or leave it as documented known-behavior for now?

## Risk & rollout

- **High** behavior-change risk if the dep array, ref read/write ordering, or `sendPrompt(null)`-before-fire sequence shifts. Preserve verbatim.
- Per `agents/code-quality.md`: tests as a separate **prior** commit; extraction as a single "no behavior change" commit; never bundled with the #1972/#1842 fix so the suite can prove behavior preservation and the history stays bisectable.
- Gate with `pnpm check` (touches tested paths), not `fast-check`.
