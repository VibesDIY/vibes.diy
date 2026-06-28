# PR-A: In-place real generation on `/vibe` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the **owner** uses the edit affordance on `/vibe`, generate the code change **in place** — stream the codegen in the card, hot-swap the running `/vibe` iframe, and de-blur the forming app behind the card — instead of hopping to `/chat`.

**Architecture:** Extract the chat route's generation engine (reducer + `useChatSession` + the `isCodeEnd`→`getCode`→`srvVibeSandbox.pushSource` hot-swap loop + the blur ramp) into a headless hook `useInVibeGeneration`, usable on `/vibe`. The `/vibe` route consumes it: the owner branch of `handleEditPrompt` calls `sendPrompt` instead of navigating; the card body shows the stream during generation and chips after the first code block; a `backdropFilter` overlay de-blurs the existing iframe. Non-owners keep the current `/remix` hop (PR-B replaces it). No server changes.

**Tech Stack:** React (hooks, `useReducer`), React Router, `@vibes.diy/call-ai-v2` (`isCodeEnd`/`isCodeBegin`), `@vibes.diy/base` (`UnifiedVibeCard`), the shared `srvVibeSandbox` post-message bridge, Vitest + `@testing-library/react`.

**Spec:** `docs/superpowers/specs/2026-06-28-first-generation-in-place-design.md` (esp. §2 single iframe, §3 the hook, §4 PR-A, §10 risks).

---

## Reference reading (the engineer should skim these before starting)

- `vibes.diy/pkg/app/routes/chat/chat.$ownerHandle.$appSlug.tsx:107-201` — how the chat route wires `useReducer(promptReducer)` + `useState(promptToSend)` + `submitPrompt` + `useChatSession`. The hook reproduces this headlessly.
- `vibes.diy/pkg/app/hooks/useChatSession.ts` — the chat-handle lifecycle the hook composes. Its arg type is the contract.
- `vibes.diy/pkg/app/routes/chat/prompt-state.ts` — `promptReducer`, `PromptState`, `PromptBlock`.
- `vibes.diy/pkg/app/components/ResultPreview/PreviewApp.tsx:71-126` (the `isCodeEnd`→`getCode`→`pushSource` push loop) and `:133-198` (the `hotSwapCount`→`blurPx` ramp + overlay). The hook lifts this logic; the overlay becomes its own component.
- `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx:196-217` (`handleEditPrompt` + `editChips`) and `:846-912` (the `UnifiedVibeCard` render). This is the integration site.
- `vibes.diy/tests/app/ChatSession.test.tsx` and `vibes.diy/tests/app/prompt-state-reconnect.test.ts` — the test patterns: `renderHook`/`waitFor`, the `~/vibes.diy/app/...` import alias, `makeControllableLLMChat`, and reducer message factories.

**Run tests:** `cd vibes.diy/tests && pnpm test -- <file>` (vitest). Full gate before PR: `pnpm check` from repo root.

---

## File Structure

- **Create** `vibes.diy/pkg/app/hooks/useInVibeGeneration.ts` — the headless generation engine. Owns the local reducer, `useChatSession`, the hot-swap push loop, the blur ramp, and the `phase`/`counts` derivations. One responsibility: "drive an in-place codegen and expose its render state."
- **Create** `vibes.diy/pkg/app/components/InVibeBlurOverlay.tsx` — presentational de-blur overlay (the `backdropFilter` layer lifted from `PreviewApp`), driven by `blurPx` + `active`.
- **Create** `vibes.diy/pkg/app/components/GenerationStreamView.tsx` — presentational card-body stream view: renders the latest block's `toplevel.line` narration + a spinner during generation (matches sketch `13-first-gen-streaming`).
- **Modify** `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx` — consume the hook for the owner; render the overlay over the iframe and the stream/chips in the card body; keep the `/remix` hop for non-owners.
- **Create tests:** `vibes.diy/tests/app/useInVibeGeneration.test.tsx`, `vibes.diy/tests/app/InVibeBlurOverlay.test.tsx`, `vibes.diy/tests/app/GenerationStreamView.test.tsx`.

---

## Task 1: `useInVibeGeneration` — reducer + chat-session wiring + `sendPrompt` + `phase`

**Files:**

- Create: `vibes.diy/pkg/app/hooks/useInVibeGeneration.ts`
- Test: `vibes.diy/tests/app/useInVibeGeneration.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// vibes.diy/tests/app/useInVibeGeneration.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { Result } from "@adviser/cement";
import { useInVibeGeneration } from "~/vibes.diy/app/hooks/useInVibeGeneration.js";
import { makeControllableLLMChat } from "./helpers/makeControllableLLMChat.js";

function setup() {
  const fakeChat = makeControllableLLMChat();
  const openChat = vi.fn(async () => Result.Ok(fakeChat));
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

  it("sendPrompt drives phase idle → streaming, then → live on the first code.end", async () => {
    const { view, fakeChat } = setup();
    await waitFor(() => expect(view.result.current.phase).toBe("idle"));
    act(() => view.result.current.sendPrompt("make it blue"));
    await act(async () => fakeChat.emitBlockBegin());
    await waitFor(() => expect(view.result.current.phase).toBe("streaming"));
    await act(async () => fakeChat.emitCodeEnd());
    await waitFor(() => expect(view.result.current.phase).toBe("live"));
  });
});
```

> NB: `makeControllableLLMChat` (`vibes.diy/tests/app/helpers/makeControllableLLMChat.ts`) exposes section-stream control. Read it first; if it lacks `emitBlockBegin`/`emitCodeEnd` convenience emitters, add thin helpers there that push the corresponding `PromptAndBlockMsgs` (a `prompt.block-begin`, then a `block.code.begin`/`block.code.line`/`block.code.end` with a `blockId`+`seq`) through its controllable stream. Match the message shapes in `prompt-state-reconnect.test.ts`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd vibes.diy/tests && pnpm test -- useInVibeGeneration`
Expected: FAIL — `Cannot find module '.../useInVibeGeneration.js'`.

- [ ] **Step 3: Write the minimal hook**

```ts
// vibes.diy/pkg/app/hooks/useInVibeGeneration.ts
import { useCallback, useMemo, useReducer, useState } from "react";
import type { VibesDiyApiIface, LLMChatEntry } from "@vibes.diy/api-types";
import type { vibesDiySrvSandbox } from "@vibes.diy/vibe";
import { promptReducer, type PromptState } from "../routes/chat/prompt-state.js";
import { useChatSession } from "./useChatSession.js";

export type GenerationPhase = "idle" | "streaming" | "live";

export interface InVibeGeneration {
  readonly phase: GenerationPhase;
  readonly blocks: PromptState["blocks"];
  readonly blurPx: number;
  readonly counts: { readonly messages: number; readonly lines: number };
  readonly sendPrompt: (text: string) => void;
}

export interface UseInVibeGenerationOpts {
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly fsId: string | undefined;
  readonly chatApi: VibesDiyApiIface;
  readonly sharedApi: VibesDiyApiIface;
  readonly srvVibeSandbox: vibesDiySrvSandbox | undefined;
}

function initialState(appSlug: string): PromptState {
  return {
    chat: {} as LLMChatEntry,
    running: false,
    hasCode: false,
    title: appSlug,
    blocks: [],
    searchParams: new URLSearchParams(),
    setSearchParams: (() => undefined) as never,
    agentSavedBlockIds: new Set<string>(),
    connection: "live",
  };
}

export function useInVibeGeneration(opts: UseInVibeGenerationOpts): InVibeGeneration {
  const { ownerHandle, appSlug, fsId, chatApi, sharedApi } = opts;
  const [promptState, dispatch] = useReducer(promptReducer, undefined, () => initialState(appSlug));
  const [promptToSend, sendPromptState] = useState<string | null>(null);

  // The /vibe iframe stays pinned to its own fsId and hot-swaps in place, so we
  // do NOT navigate on follow-ups (end-of-stream fsId settle is deferred — spec
  // §10). A no-op keeps useChatSession's contract satisfied.
  const navigateToFsId = useCallback(() => undefined, []);

  useChatSession({
    ownerHandle,
    appSlug,
    fsId,
    inConstruction: false,
    chatApi,
    sharedApi,
    promptState,
    dispatch,
    promptToSend,
    sendPrompt: sendPromptState,
    navigateToFsId,
  });

  // phase: 'streaming' once a turn is running and before any completed code
  // block; 'live' once the first code.end has landed (subsequent edits keep us
  // 'live' and hot-swap in place); else 'idle'.
  const firstCodeDone = useMemo(
    () => promptState.blocks.some((b) => b.msgs.some((m) => (m as { type?: string }).type === "block.code.end")),
    [promptState.blocks]
  );
  const phase: GenerationPhase = firstCodeDone ? "live" : promptState.running || promptToSend !== null ? "streaming" : "idle";

  const sendPrompt = useCallback((text: string) => {
    const trimmed = text.trim();
    if (trimmed) sendPromptState(trimmed);
  }, []);

  return {
    phase,
    blocks: promptState.blocks,
    blurPx: 0, // wired in Task 2
    counts: { messages: promptState.blocks.length, lines: 0 }, // lines wired in Task 3
    sendPrompt,
  };
}
```

> If `@vibes.diy/vibe` does not export `vibesDiySrvSandbox` as a type, import it from its source path the way `vibe.$ownerHandle.$appSlug.tsx` consumes `vctx.srvVibeSandbox`, or type the param as the structural subset the hook uses: `{ pushSource(source: string): boolean }`. Prefer the structural subset — the hook only needs `pushSource`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd vibes.diy/tests && pnpm test -- useInVibeGeneration`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/app/hooks/useInVibeGeneration.ts vibes.diy/tests/app/useInVibeGeneration.test.tsx vibes.diy/tests/app/helpers/makeControllableLLMChat.ts
git commit -m "feat(vibe): headless useInVibeGeneration — reducer + chat session + phase"
```

---

## Task 2: Hot-swap the iframe + blur ramp (`pushSource` on each code.end, `blurPx` from `hotSwapCount`)

**Files:**

- Modify: `vibes.diy/pkg/app/hooks/useInVibeGeneration.ts`
- Test: `vibes.diy/tests/app/useInVibeGeneration.test.tsx`

- [ ] **Step 1: Add the failing test**

```tsx
it("pushes resolved source to the iframe on a completed code block and ramps blur down", async () => {
  const { view, fakeChat, pushSource } = setup();
  const before = view.result.current.blurPx; // 25 at rest pre-stream is fine; assert the decay instead
  act(() => view.result.current.sendPrompt("make a counter"));
  await act(async () => fakeChat.emitBlockBegin());
  // emit a full, valid module so the push guard (len>=200 && includes "export default") passes
  await act(async () => fakeChat.emitCodeBlock(`export default function App(){return null}\n${"// pad\n".repeat(40)}`));
  await waitFor(() => expect(pushSource).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(view.result.current.blurPx).toBeLessThan(25));
  expect(before).toBe(25);
});
```

> Add `emitCodeBlock(source)` to `makeControllableLLMChat` if absent: it pushes `block.code.begin`, one `block.code.line` per line of `source`, then `block.code.end` (same `blockId`, increasing `seq`). The hook resolves code via `getCode(promptState)`, which reassembles from these lines.

- [ ] **Step 2: Run to verify it fails**

Run: `cd vibes.diy/tests && pnpm test -- useInVibeGeneration`
Expected: FAIL — `pushSource` not called / `blurPx` stays 0.

- [ ] **Step 3: Implement the push loop + ramp** (port from `PreviewApp.tsx:71-126,133-198`)

Add to the hook, before the return:

```ts
import { useEffect, useRef } from "react";
import { isCodeEnd } from "@vibes.diy/call-ai-v2";
import { getCode } from "../components/ResultPreview/get-code.js";

// ...inside the hook, after useChatSession:
const [hotSwapCount, setHotSwapCount] = useState(0);
const seenByBlockIdRef = useRef<Map<string, number>>(new Map());
useEffect(() => {
  const sandbox = opts.srvVibeSandbox;
  if (!sandbox) return;
  const last = promptState.blocks[promptState.blocks.length - 1];
  if (!last) return;
  let latestSeq = -1;
  let latestBlockId: string | undefined;
  for (const msg of last.msgs) {
    if (isCodeEnd(msg) && msg.seq > latestSeq) {
      latestSeq = msg.seq;
      latestBlockId = msg.blockId;
    }
  }
  if (latestBlockId === undefined) return;
  const seen = seenByBlockIdRef.current.get(latestBlockId) ?? -1;
  if (latestSeq <= seen) return;
  seenByBlockIdRef.current.set(latestBlockId, latestSeq);
  const resolved = getCode(promptState).code.join("\n");
  // Skip phantom sections — same guard PreviewApp uses.
  if (resolved.length < 200 || !resolved.includes("export default")) return;
  if (sandbox.pushSource(resolved)) setHotSwapCount((c) => c + 1);
}, [promptState.blocks, opts.srvVibeSandbox]);

const blurPx = useMemo(() => {
  let b = 25;
  for (let i = 0; i < hotSwapCount; i++) b *= 2 / 3;
  return promptState.running || promptToSend !== null ? b : 0;
}, [hotSwapCount, promptState.running, promptToSend]);
```

Replace `blurPx: 0` in the return with `blurPx`.

> Note: the blur is only visible while generating (`running || promptToSend`), matching `PreviewApp`'s `showBlur` gate; at rest it's 0 so the overlay (Task 4) hides. The test's "25 at rest" assertion is pre-stream after `sendPrompt` set `promptToSend` — keep the test's `before` capture AFTER `sendPrompt` if you assert 25, or assert `>0`. Adjust the test to read `blurPx` right after `sendPrompt` (when `promptToSend` is set and `hotSwapCount` is 0 → 25).

- [ ] **Step 4: Run to verify it passes**

Run: `cd vibes.diy/tests && pnpm test -- useInVibeGeneration`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/app/hooks/useInVibeGeneration.ts vibes.diy/tests/app/useInVibeGeneration.test.tsx vibes.diy/tests/app/helpers/makeControllableLLMChat.ts
git commit -m "feat(vibe): hot-swap pushSource + blur ramp in useInVibeGeneration"
```

---

## Task 3: History counts (`messages` / `lines`)

**Files:**

- Modify: `vibes.diy/pkg/app/hooks/useInVibeGeneration.ts`
- Test: `vibes.diy/tests/app/useInVibeGeneration.test.tsx`

- [ ] **Step 1: Add the failing test**

```tsx
it("counts: messages = block count, lines = resolved code length", async () => {
  const { view, fakeChat } = setup();
  act(() => view.result.current.sendPrompt("a list app"));
  await act(async () => fakeChat.emitBlockBegin());
  const src = `export default function App(){return null}\n${"// pad\n".repeat(40)}`;
  await act(async () => fakeChat.emitCodeBlock(src));
  await waitFor(() => expect(view.result.current.counts.messages).toBe(1));
  await waitFor(() => expect(view.result.current.counts.lines).toBe(getLineCount(src)));
});

function getLineCount(src: string): number {
  // matches getCode().code.length for a single resolved file
  return src.split("\n").length;
}
```

> If the resolved line count differs from a naive split (the aider resolver may merge/trim), assert `counts.lines` is `> 0` and equals `getCode(promptState).code.length` by computing it the same way the hook does. Prefer asserting `> 0` plus monotonic growth if the resolver's exact count is environment-sensitive.

- [ ] **Step 2: Run to verify it fails**

Run: `cd vibes.diy/tests && pnpm test -- useInVibeGeneration`
Expected: FAIL — `counts.lines` is 0.

- [ ] **Step 3: Implement**

Replace the `counts` in the return with:

```ts
const counts = useMemo(
  () => ({ messages: promptState.blocks.length, lines: getCode(promptState).code.length }),
  [promptState.blocks, promptState]
);
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd vibes.diy/tests && pnpm test -- useInVibeGeneration`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/app/hooks/useInVibeGeneration.ts vibes.diy/tests/app/useInVibeGeneration.test.tsx
git commit -m "feat(vibe): history counts (messages/lines) in useInVibeGeneration"
```

---

## Task 4: `InVibeBlurOverlay` component

**Files:**

- Create: `vibes.diy/pkg/app/components/InVibeBlurOverlay.tsx`
- Test: `vibes.diy/tests/app/InVibeBlurOverlay.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// vibes.diy/tests/app/InVibeBlurOverlay.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { InVibeBlurOverlay } from "~/vibes.diy/app/components/InVibeBlurOverlay.js";

describe("InVibeBlurOverlay", () => {
  it("renders nothing when inactive", () => {
    const { queryByTestId } = render(<InVibeBlurOverlay active={false} blurPx={25} />);
    expect(queryByTestId("in-vibe-blur-overlay")).toBeNull();
  });

  it("applies backdrop blur at the given blurPx when active", () => {
    const { getByTestId } = render(<InVibeBlurOverlay active blurPx={25} />);
    const el = getByTestId("in-vibe-blur-overlay");
    expect(el.style.backdropFilter).toContain("blur(25");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd vibes.diy/tests && pnpm test -- InVibeBlurOverlay`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** (port the overlay from `PreviewApp.tsx:255-276`)

```tsx
// vibes.diy/pkg/app/components/InVibeBlurOverlay.tsx
import React from "react";

/** De-blur overlay layered over the /vibe iframe during an in-place generation.
 *  Lifted from PreviewApp's stream overlay (backdropFilter blur ramp → faint
 *  moving-stripes once the ramp decays). Pointer-events block interaction with a
 *  half-rendered app while it forms. */
export function InVibeBlurOverlay({ active, blurPx }: { readonly active: boolean; readonly blurPx: number }) {
  if (!active) return null;
  const blurStr = blurPx.toPrecision(3);
  const blurred = blurPx >= 0.01;
  return (
    <div
      aria-hidden="true"
      data-testid="in-vibe-blur-overlay"
      className="pointer-events-auto absolute inset-0"
      style={
        blurred
          ? { backdropFilter: `blur(${blurStr}px)`, WebkitBackdropFilter: `blur(${blurStr}px)` }
          : {
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 12px, transparent 12px, transparent 24px)",
              backgroundSize: "40px 40px",
              animation: "moving-stripes 1s linear infinite",
            }
      }
    />
  );
}

export default InVibeBlurOverlay;
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd vibes.diy/tests && pnpm test -- InVibeBlurOverlay`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/app/components/InVibeBlurOverlay.tsx vibes.diy/tests/app/InVibeBlurOverlay.test.tsx
git commit -m "feat(vibe): InVibeBlurOverlay (de-blur layer for in-place gen)"
```

---

## Task 5: `GenerationStreamView` (the card-body stream)

**Files:**

- Create: `vibes.diy/pkg/app/components/GenerationStreamView.tsx`
- Test: `vibes.diy/tests/app/GenerationStreamView.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// vibes.diy/tests/app/GenerationStreamView.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { GenerationStreamView } from "~/vibes.diy/app/components/GenerationStreamView.js";

const block = {
  msgs: [
    { type: "block.toplevel.line", line: "laying out a 4x4 grid", blockId: "b1", streamId: "s", seq: 1 },
    { type: "block.toplevel.line", line: "wiring the sound", blockId: "b1", streamId: "s", seq: 2 },
  ],
} as never;

describe("GenerationStreamView", () => {
  it("renders the latest block's toplevel narration lines", () => {
    const { getByText } = render(<GenerationStreamView blocks={[block]} messages={1} lines={48} />);
    expect(getByText(/laying out a 4x4 grid/)).toBeTruthy();
    expect(getByText(/wiring the sound/)).toBeTruthy();
  });

  it("renders the count summary", () => {
    const { getByText } = render(<GenerationStreamView blocks={[block]} messages={1} lines={48} />);
    expect(getByText(/1 msgs · ~48 lines/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd vibes.diy/tests && pnpm test -- GenerationStreamView`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** (mirror sketch `13-first-gen-streaming`; use `isToplevelLine` from `@vibes.diy/call-ai-v2`)

```tsx
// vibes.diy/pkg/app/components/GenerationStreamView.tsx
import React from "react";
import { isToplevelLine } from "@vibes.diy/call-ai-v2";
import type { PromptBlock } from "../routes/chat/prompt-state.js";

export function GenerationStreamView({
  blocks,
  messages,
  lines,
}: {
  readonly blocks: readonly PromptBlock[];
  readonly messages: number;
  readonly lines: number;
}) {
  const last = blocks[blocks.length - 1];
  const narration = (last?.msgs ?? []).filter((m): m is { line: string } & object => isToplevelLine(m)).map((m) => m.line);
  return (
    <div className="text-sm" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        className="text-light-secondary dark:text-dark-secondary"
        style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
      >
        <span aria-hidden className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <span>
          building your app… · {messages} msgs · ~{lines} lines
        </span>
      </div>
      {narration.map((line, i) => (
        <span key={`${i}-${line}`} className="text-light-secondary dark:text-dark-secondary">
          ▸ {line}
        </span>
      ))}
    </div>
  );
}

export default GenerationStreamView;
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd vibes.diy/tests && pnpm test -- GenerationStreamView`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/app/components/GenerationStreamView.tsx vibes.diy/tests/app/GenerationStreamView.test.tsx
git commit -m "feat(vibe): GenerationStreamView (card-body stream)"
```

---

## Task 6: Wire into the `/vibe` route (owner generates in place; non-owner keeps `/remix`)

**Files:**

- Modify: `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx`

- [ ] **Step 1: Instantiate the hook**

After the existing `editChips` block (`:211-217`), add:

```tsx
import { useInVibeGeneration } from "../hooks/useInVibeGeneration.js";
import { InVibeBlurOverlay } from "../components/InVibeBlurOverlay.js";
import { GenerationStreamView } from "../components/GenerationStreamView.js";

const generation = useInVibeGeneration({
  ownerHandle: ownerHandle ?? "",
  appSlug: appSlug ?? "",
  fsId,
  chatApi: vctx.chatApi,
  sharedApi: vctx.sharedApi,
  srvVibeSandbox: vctx.srvVibeSandbox,
});
```

- [ ] **Step 2: Branch `handleEditPrompt` — owner generates in place, non-owner keeps the hop**

Replace the body of `handleEditPrompt` (`:196-205`) with:

```tsx
const handleEditPrompt = useCallback(
  (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !ownerHandle || !appSlug) return;
    if (isOwner) {
      // Generate in place — no hop. The hook streams into the card and hot-swaps
      // the running iframe. (Non-owner fork is PR-B; keep the /remix hop for now.)
      generation.sendPrompt(trimmed);
      return;
    }
    const qs = new URLSearchParams({ prompt64: vctx.sthis.txt.base64.encode(trimmed) }).toString();
    void navigate(`/remix/${ownerHandle}/${appSlug}?${qs}`);
  },
  [isOwner, ownerHandle, appSlug, navigate, vctx.sthis, generation]
);
```

- [ ] **Step 3: Render the blur overlay over the iframe**

In the iframe wrapper (`:717-734`), add the overlay as a sibling after the `<iframe>` (inside the same `fixed inset-0` div), so it layers over the running app and below the card portal:

```tsx
<InVibeBlurOverlay
  active={generation.phase === "streaming" || generation.phase === "live" ? generation.blurPx > 0 : false}
  blurPx={generation.blurPx}
/>
```

> The overlay's `absolute inset-0` resolves against the `fixed inset-0` iframe container. Confirm the container establishes a positioning context (it's `fixed`, so yes).

- [ ] **Step 4: Swap the card body during generation**

In the `UnifiedVibeCard` render (`:858-902`), pass a `body` that shows the stream while generating and falls back to chips otherwise. Add before the `<UnifiedVibeCard`:

```tsx
const genActive = generation.phase === "streaming" || (generation.phase === "live" && generation.blurPx > 0);
```

Then set the card's `body` (when not in Share view) to:

```tsx
body={
  shareViewOpen ? (
    /* existing SharePanelView */
  ) : genActive ? (
    <GenerationStreamView blocks={generation.blocks} messages={generation.counts.messages} lines={generation.counts.lines} />
  ) : undefined
}
```

> Leaving `body` `undefined` when not generating preserves the card's default chips + Other render (`UnifiedVibeCard.tsx:234-252`). Keep `chips={editChips}` and `onSelectChip`/`onSubmitOther={handleEditPrompt}` as-is — they now route owners into in-place generation.

- [ ] **Step 5: Typecheck + run the affected suites**

Run: `cd vibes.diy/tests && pnpm test -- vibe-route` (and any route SSR test under `vibes.diy/tests/app/ssr/`)
Run: `cd vibes.diy/stories && npx tsc --noEmit -p tsconfig.json` is NOT needed; instead from repo root: `pnpm -C vibes.diy/pkg exec tsc --noEmit` (or the package's typecheck script) to confirm the route compiles.
Expected: PASS / no type errors. Fix any type mismatches on `vctx.srvVibeSandbox` (it may be `vibesDiySrvSandbox | undefined` — the hook accepts `undefined`).

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx
git commit -m "feat(vibe): owner generates in place on /vibe (chips/Other → in-card codegen)"
```

---

## Task 7: Manual verification + full gate + PR

- [ ] **Step 1: Build + run the app, exercise the owner flow**

Use the `run` skill (or the project's dev command) to launch the app. As the **owner** of a vibe, open the card, type a change in "Other" (or click a chip), and confirm: the card body shows the streaming narration, the app behind de-blurs as code lands, the first code block swaps the body back to chips, and the running app reflects the change. Confirm a **non-owner** still routes to `/remix` (unchanged).

- [ ] **Step 2: Full gate**

Run: `pnpm check` (from repo root — format + build + test + lint).
Expected: PASS. If a flaky test trips, rerun per `agents/flaky-tests.md` before treating it as real.

- [ ] **Step 3: Blog seed**

Create `notes/blog-seeds/2026-06-28-in-vibe-generation.md` with the hook-extraction story: the headless `useInVibeGeneration` lifting the chat route's engine, the single-iframe hot-swap, and the de-blur reuse. (Hook + source + the trade-off/gotcha.)

- [ ] **Step 4: Push + PR**

```bash
git push -u origin claude/in-vibe-generation-pra
```

Open a PR (ready, not draft) titled "Owner in-place generation on /vibe (#2677 PR-A)", body summarizing the hook extraction + single-iframe hot-swap, linking the spec. Label `agent-created`; comment @-mentioning `@CharlieHelps`; subscribe; apply feedback autonomously; `ready-to-merge` when CI is green. (Per `agents/pr-lifecycle.md`.)

---

## Self-review notes (coverage)

- **Spec §3 (headless hook):** Tasks 1-3. **§2 single-iframe hot-swap:** Task 2 (reuses the already-registered `pushSource`). **§4 PR-A owner branch:** Task 6. **De-blur (§1b):** Tasks 4 + 6. **History counts (§6):** Task 3 + 5. **Non-owner keeps `/remix` (PR-B boundary):** Task 6 Step 2.
- **Out of scope here (later PRs):** the seamless non-owner fork (PR-B), the cached-read lane (PR-C), the history _reopen_ toggle + land-on read (needs `getChatResponse`/#2755), end-of-stream fsId settle (spec §10 — deliberately deferred; the iframe keeps the hot-swapped DOM).
- **Risk to watch (spec §10):** confirm the deployed `/vibe` iframe's `runtime.ready` is captured by the singleton sandbox so `pushSource` lands (Charlie confirmed the wiring; verify in Task 7 Step 1). If the app doesn't visibly hot-swap, check that `vctx.srvVibeSandbox` is the same singleton the iframe posted `runtime.ready` to.
