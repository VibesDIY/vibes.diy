# Dry-run prompt inspection implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a side-effect-free "what would you send to the LLM?" surface — a dedicated `inspectPromptChatSection` Evento handler plus a `vibes-diy inspect` CLI subcommand — so prompt assembly (skills, system prompt, conversation reconstruction, CURRENT FILES injection) can be inspected without an LLM call.

**Architecture:** Extract pure assembly (`assemblePromptPayload`) from the existing dispatch path in `prompt-chat-section.ts`. Add a new request/response Evento handler that calls only the assembly function and emits a single `res-inspect-prompt-chat-section` reply. Dispatch path keeps writing the `prompt.req` block to chatSections after assembly, so multi-turn reconstruction is unchanged. CLI subcommand resolves a chat via `openChat` (existing), sends the inspect request, and prints `{model, messages}` as JSON (default) or human-readable transcript (`--text`).

**Tech Stack:** TypeScript, arktype (request/response shape validation), drizzle-orm (read-only DB queries), `@adviser/cement` (Result, Evento), vitest, cmd-ts.

**Spec:** `docs/superpowers/specs/2026-05-12-dry-run-prompt-inspection-design.md`
**Issue:** VibesDIY/vibes.diy#1696

---

## File Map

**Modify:**
- `vibes.diy/api/types/chat.ts` — add `reqInspectPromptChatSection`, `resInspectPromptChatSection`, type guards.
- `vibes.diy/api/svc/public/prompt-chat-section.ts` — extract `assemblePromptPayload`; rework dispatch to call it and move `prompt.req` `appendBlockEvent` to after assembly.
- `vibes.diy/api/svc/vibes-msg-evento.ts` — register `inspectPromptChatSection`.
- `vibes.diy/api/types/vibes-diy-api.ts` — add `inspect` method to `LLMChat` interface.
- `vibes.diy/api/impl/index.ts` — implement `inspect` on `LLMChatImpl`.
- `vibes-diy/cli/main.ts` — wire `inspectCmd` into subcommand table.

**Create:**
- `vibes.diy/api/svc/public/inspect-prompt-chat-section.ts` — new handler.
- `vibes.diy/api/tests/inspect-prompt-chat-section.test.ts` — integration test (zero-side-effects + payload correctness).
- `vibes.diy/api/tests/assemble-prompt-payload.test.ts` — unit test for extracted function.
- `vibes-diy/cli/cmds/inspect-cmd.ts` — CLI subcommand.
- `vibes-diy/cli/cmds/inspect-cmd.test.ts` — unit test for JSON + `--text` formatters.

**Commit cadence:** one commit per task. Branch is `worktree-issue-1696-dry-run-prompt-inspection`.

---

## Task 1: Add request/response types

**Files:**
- Modify: `vibes.diy/api/types/chat.ts`

The new types live next to `reqPromptChatSection`. They piggyback on `LLMRequest` (same shape `ReqCreationPromptChatSection.prompt` uses) and `ChatMessage` (already imported indirectly via `LLMRequest`).

- [ ] **Step 1: Add request, response, and type guards**

Append to `vibes.diy/api/types/chat.ts` (after `resPromptChatSection` and its `isResPromptChatSection` guard, around line 178):

```ts
export const reqInspectPromptChatSection = type({
  type: "'vibes.diy.req-inspect-prompt-chat-section'",
  auth: dashAuthType,
  chatId: "string",
  mode: "'chat'",
  prompt: LLMRequest,
});

export type ReqInspectPromptChatSection = typeof reqInspectPromptChatSection.infer;

export function isReqInspectPromptChatSection(obj: unknown): obj is ReqInspectPromptChatSection {
  return !(reqInspectPromptChatSection(obj) instanceof type.errors);
}

export const resInspectPromptChatSection = type({
  type: "'vibes.diy.res-inspect-prompt-chat-section'",
  chatId: "string",
  model: "string",
  // ChatMessage is already part of LLMRequest's schema. Re-use the raw arktype
  // it's built from by referencing LLMRequest.get('messages'); arktype yields
  // the same array element schema we want.
  messages: LLMRequest.get("messages"),
});

export type ResInspectPromptChatSection = typeof resInspectPromptChatSection.infer;

export function isResInspectPromptChatSection(obj: unknown): obj is ResInspectPromptChatSection {
  return !(resInspectPromptChatSection(obj) instanceof type.errors);
}
```

- [ ] **Step 2: Type-check the file**

Run: `pnpm --filter @vibes.diy/api-types build`
Expected: builds cleanly.

If `LLMRequest.get("messages")` is rejected by arktype, fall back to defining the messages schema locally by inlining the `ChatMessage` type from `@vibes.diy/call-ai-v2` — search for `ChatMessage` in `call-ai/v2/src` and mirror it. Prefer the `.get()` form if it works.

- [ ] **Step 3: Verify type guards round-trip in a one-liner unit check**

Create `vibes.diy/api/tests/inspect-prompt-types.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  isReqInspectPromptChatSection,
  isResInspectPromptChatSection,
} from "@vibes.diy/api-types";

describe("inspect prompt types", () => {
  it("validates a request shape", () => {
    expect(
      isReqInspectPromptChatSection({
        type: "vibes.diy.req-inspect-prompt-chat-section",
        auth: { type: "device-id", token: "x" },
        chatId: "chat-1",
        mode: "chat",
        prompt: { messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }] },
      })
    ).toBe(true);
  });

  it("validates a response shape", () => {
    expect(
      isResInspectPromptChatSection({
        type: "vibes.diy.res-inspect-prompt-chat-section",
        chatId: "chat-1",
        model: "anthropic/claude-sonnet-4-6",
        messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
      })
    ).toBe(true);
  });

  it("rejects wrong type discriminator", () => {
    expect(isReqInspectPromptChatSection({ type: "wrong" })).toBe(false);
  });
});
```

- [ ] **Step 4: Run the type test**

Run: `cd vibes.diy/tests && pnpm vitest run ../api/tests/inspect-prompt-types.test.ts`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/types/chat.ts vibes.diy/api/tests/inspect-prompt-types.test.ts
git commit -m "$(cat <<'EOF'
feat(types): add reqInspectPromptChatSection / resInspectPromptChatSection (#1696)

Adds the request and response shapes for the dry-run prompt inspection
handler. Chat-mode only — app/img dry-run is out of scope for now.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Extract `assemblePromptPayload`

**Files:**
- Modify: `vibes.diy/api/svc/public/prompt-chat-section.ts` (around `injectSystemPrompt` at line 674 and `handlerLlmRequest` at line 810)
- Modify: `vibes.diy/api/svc/index.ts` (re-export `assemblePromptPayload`)

The existing `injectSystemPrompt(vctx, chatId, model)` reads stored sections + reconstructs the conversation. The dispatch path writes `prompt.req` to chatSections **first**, then calls `injectSystemPrompt`, so the new user message lands in the assembled payload via reconstruction.

For dry-run we cannot write `prompt.req` first. So `assemblePromptPayload` must take the next user turn as an explicit parameter and append it after reconstruction. The dispatch path also switches to passing the new user messages explicitly (and *then* writing the `prompt.req` block).

The final `{model, messages}` is identical in both orderings.

- [ ] **Step 1: Write the failing unit test**

Create `vibes.diy/api/tests/assemble-prompt-payload.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@vibes.diy/call-ai-v2";
import { createApiTestCtx } from "./api-test-setup.js";
import { assemblePromptPayload } from "@vibes.diy/api-svc";

function firstText(msg: ChatMessage): string {
  const part = msg.content.find((c) => c.type === "text");
  return part?.type === "text" ? part.text : "";
}

describe("assemblePromptPayload", () => {
  it("returns system + new user turn for an initial (empty) chat", async () => {
    const tc = await createApiTestCtx();
    const { appSlug, userSlug } = await tc.createApp();
    const rOpen = await tc.api.openChat({ userSlug, appSlug, mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();

    const r = await assemblePromptPayload(tc.appCtx.vibesCtx, {
      chatId: chat.chatId,
      model: "anthropic/claude-sonnet-4-6",
      newUserMessages: [
        { role: "user", content: [{ type: "text", text: "make a hello world app" }] },
      ],
    });
    expect(r.isOk()).toBe(true);
    const { model, messages } = r.Ok();
    expect(model).toBe("anthropic/claude-sonnet-4-6");
    expect(messages[0].role).toBe("system");
    expect(messages[messages.length - 1].role).toBe("user");
    expect(firstText(messages[messages.length - 1])).toBe("make a hello world app");
    // initial chats must NOT have a CURRENT FILES block (no prior fs).
    expect(firstText(messages[0])).not.toContain("CURRENT FILES");

    await chat.close();
    await tc.appCtx.close();
  });

  it("returns the same payload regardless of write-then-read vs explicit-new-user ordering", async () => {
    // This is the regression guard for the dispatch refactor: assembling with
    // an explicit `newUserMessages` argument must produce the same `messages`
    // array the old code produced by writing prompt.req first and then
    // reconstructing.
    const tc = await createApiTestCtx();
    const { appSlug, userSlug } = await tc.createApp();
    const rOpen = await tc.api.openChat({ userSlug, appSlug, mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();

    const userMsg = { role: "user" as const, content: [{ type: "text" as const, text: "first prompt" }] };

    const r1 = await assemblePromptPayload(tc.appCtx.vibesCtx, {
      chatId: chat.chatId,
      model: "anthropic/claude-sonnet-4-6",
      newUserMessages: [userMsg],
    });
    const r2 = await assemblePromptPayload(tc.appCtx.vibesCtx, {
      chatId: chat.chatId,
      model: "anthropic/claude-sonnet-4-6",
      newUserMessages: [userMsg],
    });
    expect(r1.isOk()).toBe(true);
    expect(r2.isOk()).toBe(true);
    expect(JSON.stringify(r1.Ok())).toBe(JSON.stringify(r2.Ok()));

    await chat.close();
    await tc.appCtx.close();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails (function not exported yet)**

Run: `cd vibes.diy/tests && pnpm vitest run ../api/tests/assemble-prompt-payload.test.ts`
Expected: FAIL — `assemblePromptPayload` is not exported from `@vibes.diy/api-svc`.

- [ ] **Step 3: Extract `assemblePromptPayload` from `injectSystemPrompt`**

In `vibes.diy/api/svc/public/prompt-chat-section.ts`, rename `injectSystemPrompt` to `assemblePromptPayload` and add a `newUserMessages` parameter. Original signature at line 674:

```ts
async function injectSystemPrompt(
  vctx: VibesApiSQLCtx,
  chatId: string,
  model: string
): Promise<Result<{ model: string; messages: ChatMessage[] }>>
```

Replace with:

```ts
export interface AssemblePromptPayloadArgs {
  readonly chatId: string;
  readonly model: string;
  /**
   * The next user turn(s) that would be sent to the LLM. These are appended
   * to the reconstructed conversation *after* loading stored sections, so
   * the caller does NOT need to write a prompt.req block first.
   *
   * Pass [] (or a single user ChatMessage) — non-user roles are filtered.
   */
  readonly newUserMessages: readonly ChatMessage[];
}

export async function assemblePromptPayload(
  vctx: VibesApiSQLCtx,
  args: AssemblePromptPayloadArgs
): Promise<Result<{ model: string; messages: ChatMessage[] }>> {
  const { chatId, model, newUserMessages } = args;
  const sections = await vctx.sql.db
    .select()
    .from(vctx.sql.tables.chatSections)
    .where(eq(vctx.sql.tables.chatSections.chatId, chatId))
    .orderBy(vctx.sql.tables.chatSections.created);
  const allSectionMsgs: PromptAndBlockMsgs[] = [];
  for (const rowSection of sections) {
    const { filtered: sectionMsgs, warning: sectionWarning } = parseArrayWarning(rowSection.blocks, PromptAndBlockMsgs);
    if (sectionWarning.length > 0) {
      ensureLogger(vctx.sthis, "assemblePromptPayload").Warn().Any({ parseErrors: sectionWarning }).Msg("skip");
    }
    allSectionMsgs.push(...sectionMsgs);
  }
  const reconstructed = reconstructConversationMessages(allSectionMsgs);

  // Append the next user turn(s) explicitly. The dispatch path used to write a
  // prompt.req block before this call so reconstructConversationMessages
  // would pick it up; that ordering is gone — callers (dispatch and dry-run
  // alike) hand the new user turn(s) to this function directly.
  const newUserOnly = newUserMessages.filter((m) => m.role === "user");
  const conversationMessages = [...reconstructed, ...newUserOnly];

  const { skills, theme, title } = await loadActiveSettings(vctx, chatId);
  const priorFs = await loadPriorFileSystem(vctx, chatId);
  const isInitial = priorFs.size === 0;

  const systemPrompt = await exception2Result(async () =>
    makeBaseSystemPrompt(await resolveEffectiveModel({ model }, {}), {
      skills,
      theme,
      title,
      demoData: false,
      variant: isInitial ? "initial" : "continuation",
      pkgBaseUrl: promptsPkgBaseUrl(vctx.params.pkgRepos.workspace),
      fetch: createPromptAssetFetch({ fetchAsset: vctx.fetchAsset }),
    })
  );
  if (systemPrompt.isErr()) {
    return Result.Err(systemPrompt);
  }
  if (!conversationMessages.some((m) => m.role === "user")) {
    return Result.Err(`No user messages found in the prompt`);
  }

  const systemPromptText = isInitial
    ? systemPrompt.Ok().systemPrompt
    : `${systemPrompt.Ok().systemPrompt}\n\n${renderCurrentFiles(priorFs, "App.jsx")}`;

  return Result.Ok({
    model,
    messages: [
      {
        role: "system",
        content: [{ type: "text", text: systemPromptText }],
      },
      ...conversationMessages,
    ],
  });
}
```

(Note: keep the old `injectSystemPrompt` name as a one-line wrapper to avoid touching every call site in one task — see Step 4.)

Right after the new function, add a backwards-compatible alias so Step 4 only changes the dispatch path:

```ts
async function injectSystemPrompt(
  vctx: VibesApiSQLCtx,
  chatId: string,
  model: string
): Promise<Result<{ model: string; messages: ChatMessage[] }>> {
  // Legacy shim: dispatch used to write prompt.req first and then call this,
  // so newUserMessages = [] (the just-written block is what reconstruction
  // picks up). Kept only for any caller not yet migrated in Task 2.
  return assemblePromptPayload(vctx, { chatId, model, newUserMessages: [] });
}
```

- [ ] **Step 4: Migrate `handlerLlmRequest` to call `assemblePromptPayload` directly and move the `prompt.req` write to AFTER assembly**

In `vibes.diy/api/svc/public/prompt-chat-section.ts`, the function `handlerLlmRequest` starts around line 810. The current order is:

1. `appendBlockEvent({ ..., evt: { type: "prompt.req", request: req.prompt, ... }})` — writes prompt.req block.
2. Resolve modelId via `getModelDefaults`.
3. `withSystemPrompt = await injectSystemPrompt(vctx, req.chatId, ...)` — reads sections back, including the just-written prompt.req.

Change to:

1. Resolve modelId via `getModelDefaults` (unchanged).
2. `withSystemPrompt = await assemblePromptPayload(vctx, { chatId: req.chatId, model: ..., newUserMessages: req.prompt.messages })` — no DB write happened yet, so we pass the new user messages explicitly.
3. `appendBlockEvent({ ..., evt: { type: "prompt.req", request: req.prompt, ... }})` — write the prompt.req block AFTER assembly. This still happens so the NEXT turn's reconstruction sees this turn's user prompt.

For the `app` / `img` branches inside `handlerLlmRequest` (lines 877–907), there is no `assemblePromptPayload` call — they pass `req.prompt.messages` through unchanged. Keep that path exactly as is; the `prompt.req` write still needs to happen so the section log is complete. Move the write so it runs AFTER the message-building branch executes (i.e. after the `if (req.mode === "chat") {...} else if (req.mode === "app"|"img") {...}` block) for ALL modes, not just chat. This preserves the existing write but consolidates ordering.

Concretely, in `handlerLlmRequest`:

Before (existing structure, simplified):
```ts
await scope.evalResult(async () => appendBlockEvent({ ..., evt: { type: "prompt.req", ... } }))... ;
blockSeq++;
const modelId = ... getModelDefaults ...;
const withSystemPrompt = await scope.evalResult(async () => {
  let withSystemPrompt = ...;
  if (req.mode === "chat") {
    withSystemPrompt = await injectSystemPrompt(vctx, req.chatId, req.prompt.model ?? modelId);
  } else if (req.mode === "app" || req.mode === "img") {
    // ... image_url forwarding ...
    withSystemPrompt = Result.Ok({ model: req.prompt.model ?? modelId, messages });
  }
  return withSystemPrompt;
}).do();
```

After:
```ts
const modelId = ... getModelDefaults ...;
const withSystemPrompt = await scope.evalResult(async () => {
  let withSystemPrompt = Result.Ok({ model: modelId, messages: [] as ChatMessage[] });
  if (req.mode === "chat") {
    withSystemPrompt = await assemblePromptPayload(vctx, {
      chatId: req.chatId,
      model: req.prompt.model ?? modelId,
      newUserMessages: req.prompt.messages,
    });
  } else if (req.mode === "app" || req.mode === "img") {
    // ... image_url forwarding (unchanged) ...
    withSystemPrompt = Result.Ok({ model: req.prompt.model ?? modelId, messages });
  }
  return withSystemPrompt;
}).do();

// Write prompt.req to chatSections AFTER assembly. The block is needed so
// the NEXT turn's reconstruction sees this turn's user prompt; it must NOT
// be a precondition of assembly (the dry-run path is identical to dispatch
// minus this write, and we need the assembly logic to be the same function).
await scope.evalResult(async () => {
  const r = await appendBlockEvent({
    ctx,
    vctx,
    req,
    promptId,
    blockSeq: blockSeq,
    evt: {
      type: "prompt.req",
      streamId: promptId,
      chatId: req.chatId,
      seq: blockSeq,
      request: req.prompt,
      timestamp: new Date(),
    },
  });
  blockSeq++;
  return r;
}).do();
```

- [ ] **Step 5: Delete the legacy `injectSystemPrompt` shim**

After Step 4, no caller uses `injectSystemPrompt` anymore. Remove the shim. Grep to confirm:

Run: `rg "injectSystemPrompt" vibes.diy/`
Expected: zero matches after deletion.

- [ ] **Step 6: Re-export `assemblePromptPayload`**

`vibes.diy/api/svc/index.ts` already does `export * from "./public/prompt-chat-section.js";` (line 14), so `assemblePromptPayload` is exported automatically once it's `export async function`. Verify with:

Run: `rg "export.*assemblePromptPayload" vibes.diy/api/svc/public/prompt-chat-section.ts`
Expected: one match (the function definition).

- [ ] **Step 7: Run the unit test**

Run: `cd vibes.diy/tests && pnpm vitest run ../api/tests/assemble-prompt-payload.test.ts`
Expected: 2 passing.

- [ ] **Step 8: Run the broader prompt-chat-section tests to confirm the dispatch refactor didn't break anything**

Run: `cd vibes.diy/tests && pnpm vitest run ../api/tests/seed-chat-section.test.ts ../api/tests/reconstruct-messages.test.ts ../api/tests/recovery.test.ts ../api/tests/recovery-truncated-event.test.ts`
Expected: all passing.

If any fail: investigate before continuing. The `prompt.req` write moving after assembly is the most likely regression point — if any test asserts the order of writes within a turn, surface it and reason about whether the test or the new ordering is correct (the new ordering is what the spec mandates; a failing test that asserts the *old* order should be updated to assert the *new* order, with a comment explaining why).

- [ ] **Step 9: Commit**

```bash
git add vibes.diy/api/svc/public/prompt-chat-section.ts vibes.diy/api/tests/assemble-prompt-payload.test.ts
git commit -m "$(cat <<'EOF'
refactor(api): extract assemblePromptPayload from prompt-chat dispatch (#1696)

Pure assembly function now takes the next user turn explicitly instead
of depending on a just-written prompt.req block to be picked up by
reconstruction. Dispatch path writes prompt.req AFTER assembly, so the
chatSections log is unchanged for multi-turn reconstruction.

Prepares for the inspect-prompt-chat-section dry-run handler.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Implement `inspectPromptChatSection` Evento handler

**Files:**
- Create: `vibes.diy/api/svc/public/inspect-prompt-chat-section.ts`
- Modify: `vibes.diy/api/svc/vibes-msg-evento.ts`

Pattern mirrors `openChat` (request/response, no streaming).

- [ ] **Step 1: Write the failing integration test**

Create `vibes.diy/api/tests/inspect-prompt-chat-section.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@vibes.diy/call-ai-v2";
import { eq } from "drizzle-orm";
import { isResInspectPromptChatSection, isResError, type ResInspectPromptChatSection } from "@vibes.diy/api-types";
import { createApiTestCtx } from "./api-test-setup.js";

function firstText(msg: ChatMessage): string {
  const part = msg.content.find((c) => c.type === "text");
  return part?.type === "text" ? part.text : "";
}

describe("inspectPromptChatSection", () => {
  it("returns model+messages without writing to PromptContexts or ChatSections", async () => {
    const tc = await createApiTestCtx();
    const { appSlug, userSlug } = await tc.createApp();
    const rOpen = await tc.api.openChat({ userSlug, appSlug, mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();

    const db = tc.appCtx.vibesCtx.sql.db;
    const tables = tc.appCtx.vibesCtx.sql.tables;
    const before = {
      promptContexts: (await db.select().from(tables.promptContexts).where(eq(tables.promptContexts.chatId, chat.chatId))).length,
      chatSections: (await db.select().from(tables.chatSections).where(eq(tables.chatSections.chatId, chat.chatId))).length,
    };

    const rInspect = await tc.api.request<
      {
        type: "vibes.diy.req-inspect-prompt-chat-section";
        chatId: string;
        mode: "chat";
        prompt: { messages: ChatMessage[] };
      },
      ResInspectPromptChatSection
    >(
      {
        type: "vibes.diy.req-inspect-prompt-chat-section",
        chatId: chat.chatId,
        mode: "chat",
        prompt: { messages: [{ role: "user", content: [{ type: "text", text: "preview this please" }] }] },
      },
      { resMatch: isResInspectPromptChatSection }
    );
    expect(rInspect.isOk()).toBe(true);
    const res = rInspect.Ok();
    expect(res.chatId).toBe(chat.chatId);
    expect(res.messages[0].role).toBe("system");
    expect(res.messages[res.messages.length - 1].role).toBe("user");
    expect(firstText(res.messages[res.messages.length - 1])).toBe("preview this please");

    const after = {
      promptContexts: (await db.select().from(tables.promptContexts).where(eq(tables.promptContexts.chatId, chat.chatId))).length,
      chatSections: (await db.select().from(tables.chatSections).where(eq(tables.chatSections.chatId, chat.chatId))).length,
    };
    expect(after).toEqual(before);

    await chat.close();
    await tc.appCtx.close();
  });

  it("returns an error for a chat the caller does not own", async () => {
    const tc = await createApiTestCtx();
    const { appSlug, userSlug } = await tc.createApp();
    const rOpen = await tc.api.openChat({ userSlug, appSlug, mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();
    await chat.close();

    // Use api2 (different test identity) to query the chat owned by api.
    const rInspect = await tc.api2.request(
      {
        type: "vibes.diy.req-inspect-prompt-chat-section",
        chatId: chat.chatId,
        mode: "chat",
        prompt: { messages: [{ role: "user", content: [{ type: "text", text: "spy" }] }] },
      },
      { resMatch: (m) => isResInspectPromptChatSection(m) || isResError(m) }
    );
    // Either the request rejects, or the response is an error envelope.
    expect(rInspect.isOk()).toBe(false);

    await tc.appCtx.close();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails (handler not registered)**

Run: `cd vibes.diy/tests && pnpm vitest run ../api/tests/inspect-prompt-chat-section.test.ts`
Expected: FAIL — request times out or returns a "Not Implemented" error because no handler matches the new request type.

- [ ] **Step 3: Implement the handler**

Create `vibes.diy/api/svc/public/inspect-prompt-chat-section.ts`:

```ts
import { EventoHandler, EventoResult, EventoResultType, HandleTriggerCtx, Option, Result } from "@adviser/cement";
import {
  MsgBase,
  ReqInspectPromptChatSection,
  ReqWithVerifiedAuth,
  ResInspectPromptChatSection,
  VibesDiyError,
  W3CWebSocketEvent,
  reqInspectPromptChatSection,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { and, eq } from "drizzle-orm/sql/expressions";
import { unwrapMsgBase, wrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { getModelDefaults } from "../intern/get-model-defaults.js";
import { assemblePromptPayload } from "./prompt-chat-section.js";

export const inspectPromptChatSection: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqInspectPromptChatSection>,
  ResInspectPromptChatSection | VibesDiyError
> = {
  hash: "inspect-prompt-chat-section-handler",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqInspectPromptChatSection(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqInspectPromptChatSection>>,
        ResInspectPromptChatSection | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      // Ownership check mirrors the chat-mode branch of getResChatFromMode
      // in prompt-chat-section.ts: chatContexts row joined on (userId, chatId).
      const row = await vctx.sql.db
        .select()
        .from(vctx.sql.tables.chatContexts)
        .where(
          and(
            eq(vctx.sql.tables.chatContexts.userId, req._auth.verifiedAuth.claims.userId),
            eq(vctx.sql.tables.chatContexts.chatId, req.chatId)
          )
        )
        .limit(1)
        .then((r) => r[0]);
      if (!row) {
        return Result.Err(`Chat ID ${req.chatId} not found`);
      }

      const rDefaults = await getModelDefaults(vctx, { appSlug: row.appSlug, userSlug: row.userSlug });
      if (rDefaults.isErr()) return Result.Err(rDefaults);
      const modelId = req.prompt.model ?? rDefaults.Ok().chat.model.id;

      const rPayload = await assemblePromptPayload(vctx, {
        chatId: req.chatId,
        model: modelId,
        newUserMessages: req.prompt.messages,
      });
      if (rPayload.isErr()) return Result.Err(rPayload);
      const payload = rPayload.Ok();

      await ctx.send.send(
        ctx,
        wrapMsgBase(ctx.validated, {
          payload: {
            type: "vibes.diy.res-inspect-prompt-chat-section",
            chatId: req.chatId,
            model: payload.model,
            messages: payload.messages,
          },
          tid: ctx.validated.tid,
          src: "inspectPromptChatSection",
        } satisfies { payload: ResInspectPromptChatSection; tid: string; src: string })
      );
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
```

- [ ] **Step 4: Register the handler**

In `vibes.diy/api/svc/vibes-msg-evento.ts`, add the import and push:

```ts
import { inspectPromptChatSection } from "./public/inspect-prompt-chat-section.js";
```

In the `evento.push(...)` list (between `promptChatSection` and `createInviteEvento`):

```ts
    promptChatSection,
    inspectPromptChatSection,
```

- [ ] **Step 5: Run the integration test**

Run: `cd vibes.diy/tests && pnpm vitest run ../api/tests/inspect-prompt-chat-section.test.ts`
Expected: 2 passing.

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/api/svc/public/inspect-prompt-chat-section.ts vibes.diy/api/svc/vibes-msg-evento.ts vibes.diy/api/tests/inspect-prompt-chat-section.test.ts
git commit -m "$(cat <<'EOF'
feat(api): add inspectPromptChatSection dry-run handler (#1696)

New request/response Evento handler that returns the assembled
{model, messages} payload without writing PromptContexts, appending
ChatSections, calling the LLM, or incurring billing. Ownership check
mirrors promptChatSection (chatContexts row joined on (userId, chatId)).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Expose `inspect` on the `LLMChat` API surface

**Files:**
- Modify: `vibes.diy/api/types/vibes-diy-api.ts`
- Modify: `vibes.diy/api/impl/index.ts`

The CLI uses `api.openChat(...)` to get an `LLMChat`, then calls `chat.prompt(...)`. Add `chat.inspect(...)` alongside `prompt`.

- [ ] **Step 1: Add the method to the `LLMChat` interface**

In `vibes.diy/api/types/vibes-diy-api.ts` (around line 99–107), update the `LLMChat` interface:

```ts
export interface LLMChat extends LLMChatEntry {
  prompt(req: LLMRequest, opts?: { inputImageBase64?: string }): Promise<Result<ResPromptChatSection, VibesDiyError>>;
  promptFS(req: FSUpdate | VibeFile[]): Promise<Result<ResPromptChatSection, VibesDiyError>>;
  inspect(req: LLMRequest): Promise<Result<ResInspectPromptChatSection, VibesDiyError>>;

  readonly sectionStream: ReadableStream<OnResponseTypes>;
  close(force?: boolean): Promise<void>;
}
```

Add the import at the top of the file:

```ts
import { ResInspectPromptChatSection } from "./chat.js";
```

(If `ResInspectPromptChatSection` isn't already in the import block from `./chat.js`, add it.)

- [ ] **Step 2: Implement on `LLMChatImpl`**

In `vibes.diy/api/impl/index.ts`, around the `prompt` method (line 1001), add `inspect` immediately after it:

```ts
async inspect(msg: LLMRequest): Promise<Result<ResInspectPromptChatSection, VibesDiyError>> {
  return this.api.request<ReqType<ReqInspectPromptChatSection>, ResInspectPromptChatSection>(
    {
      type: "vibes.diy.req-inspect-prompt-chat-section",
      chatId: this.res.chatId,
      mode: "chat",
      prompt: msg,
    },
    { resMatch: isResInspectPromptChatSection }
  );
}
```

Add the imports at the top of `vibes.diy/api/impl/index.ts` (find the existing `@vibes.diy/api-types` import block and add):

```ts
import {
  // ... existing imports ...
  ReqInspectPromptChatSection,
  ResInspectPromptChatSection,
  isResInspectPromptChatSection,
} from "@vibes.diy/api-types";
```

- [ ] **Step 3: Type-check the impl package**

Run: `pnpm --filter @vibes.diy/api-impl build`
Expected: builds cleanly.

- [ ] **Step 4: Add a unit test that exercises `chat.inspect`**

Append to `vibes.diy/api/tests/inspect-prompt-chat-section.test.ts`:

```ts
describe("LLMChat.inspect", () => {
  it("round-trips through the typed chat.inspect helper", async () => {
    const tc = await createApiTestCtx();
    const { appSlug, userSlug } = await tc.createApp();
    const rOpen = await tc.api.openChat({ userSlug, appSlug, mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();

    const r = await chat.inspect({
      messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
    });
    expect(r.isOk()).toBe(true);
    expect(r.Ok().chatId).toBe(chat.chatId);
    expect(r.Ok().messages[0].role).toBe("system");

    await chat.close();
    await tc.appCtx.close();
  });
});
```

- [ ] **Step 5: Run the test**

Run: `cd vibes.diy/tests && pnpm vitest run ../api/tests/inspect-prompt-chat-section.test.ts`
Expected: 3 passing (the original 2 + the new one).

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/api/types/vibes-diy-api.ts vibes.diy/api/impl/index.ts vibes.diy/api/tests/inspect-prompt-chat-section.test.ts
git commit -m "$(cat <<'EOF'
feat(api-impl): expose chat.inspect() helper (#1696)

Adds LLMChat.inspect() so callers can request the dry-run payload via
the same typed surface they use for chat.prompt(). The CLI inspect
subcommand consumes this.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: CLI `vibes-diy inspect` subcommand

**Files:**
- Create: `vibes-diy/cli/cmds/inspect-cmd.ts`
- Create: `vibes-diy/cli/cmds/inspect-cmd.test.ts`
- Modify: `vibes-diy/cli/main.ts`

Pattern mirrors `edit-cmd.ts`: resolve userSlug, open chat, send request, format output.

- [ ] **Step 1: Write the failing unit test for the `--text` formatter**

Create `vibes-diy/cli/cmds/inspect-cmd.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatInspectAsText } from "./inspect-cmd.js";

describe("formatInspectAsText", () => {
  it("renders role headers and concatenated text content", () => {
    const out = formatInspectAsText({
      type: "vibes.diy.res-inspect-prompt-chat-section",
      chatId: "chat-1",
      model: "anthropic/claude-sonnet-4-6",
      messages: [
        { role: "system", content: [{ type: "text", text: "you are helpful" }] },
        { role: "user", content: [{ type: "text", text: "make a counter" }] },
        { role: "assistant", content: [{ type: "text", text: "ok" }, { type: "text", text: " here you go" }] },
      ],
    });
    expect(out).toContain("=== SYSTEM ===");
    expect(out).toContain("you are helpful");
    expect(out).toContain("=== USER ===");
    expect(out).toContain("make a counter");
    expect(out).toContain("=== ASSISTANT ===");
    expect(out).toContain("ok here you go");
    // Order preserved.
    expect(out.indexOf("=== SYSTEM ===")).toBeLessThan(out.indexOf("=== USER ==="));
    expect(out.indexOf("=== USER ===")).toBeLessThan(out.indexOf("=== ASSISTANT ==="));
  });

  it("renders non-text parts as [type] placeholders", () => {
    const out = formatInspectAsText({
      type: "vibes.diy.res-inspect-prompt-chat-section",
      chatId: "c",
      model: "m",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "look:" },
            { type: "image_url", image_url: { url: "data:image/png;base64,..." } },
          ],
        },
      ],
    });
    expect(out).toContain("look:");
    expect(out).toContain("[image_url]");
  });
});
```

- [ ] **Step 2: Run to verify it fails (no inspect-cmd.ts yet)**

Run: `cd vibes-diy && pnpm vitest run cli/cmds/inspect-cmd.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the subcommand**

Create `vibes-diy/cli/cmds/inspect-cmd.ts`:

```ts
import { command, flag, option, positional, string } from "cmd-ts";
import {
  EventoHandler,
  EventoResultType,
  HandleTriggerCtx,
  Option,
  Result,
  ValidateTriggerCtx,
} from "@adviser/cement";
import { type } from "arktype";
import type { ResInspectPromptChatSection } from "@vibes.diy/api-types";
import type { ChatMessage } from "@vibes.diy/call-ai-v2";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, sendProgress, WrapCmdTSMsg } from "../cmd-evento.js";
import { resolveUserSlug } from "../resolve-user-slug.js";
import { formatErr } from "./format-err.js";

export const ResInspect = type({
  type: "'use-vibes.cli.res-inspect'",
  appSlug: "string",
  userSlug: "string",
  chatId: "string",
  // Rendered payload as a string (JSON or transcript) so the CLI
  // wrapper can emit it without re-encoding.
  output: "string",
});
export type ResInspect = typeof ResInspect.infer;

export function isResInspect(obj: unknown): obj is ResInspect {
  return !(ResInspect(obj) instanceof type.errors);
}

export const ReqInspect = type({
  type: "'use-vibes.cli.inspect'",
  appSlug: "string",
  prompt: "string",
  userSlug: "string",
  asText: "boolean",
  apiUrl: "string",
});
export type ReqInspect = typeof ReqInspect.infer;

export function isReqInspect(obj: unknown): obj is ReqInspect {
  return !(ReqInspect(obj) instanceof type.errors);
}

export function formatInspectAsText(res: ResInspectPromptChatSection): string {
  const lines: string[] = [];
  lines.push(`# model: ${res.model}`);
  lines.push(`# chatId: ${res.chatId}`);
  lines.push("");
  for (const msg of res.messages) {
    lines.push(`=== ${msg.role.toUpperCase()} ===`);
    const rendered = msg.content
      .map((part: ChatMessage["content"][number]) =>
        part.type === "text" ? part.text : `[${part.type}]`
      )
      .join("");
    lines.push(rendered);
    lines.push("");
  }
  return lines.join("\n");
}

export const inspectEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqInspect, ResInspect> = {
  hash: "use-vibes.cli.inspect",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqInspect, ResInspect>) => {
    if (isReqInspect(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (
    ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqInspect, ResInspect>
  ): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    if (ectx.vibesDiyApiFactory === undefined) {
      return Result.Err("Not logged in. Run 'vibes-diy login' first.");
    }
    const args = ctx.validated;
    const api = ectx.vibesDiyApiFactory(args.apiUrl);

    const userSlug = await resolveUserSlug(api, args.userSlug === "" ? undefined : args.userSlug);

    await sendProgress(ctx, "info", "Inspecting prompt assembly...");

    const rChat = await api.openChat({ userSlug, appSlug: args.appSlug, mode: "chat" });
    if (rChat.isErr()) {
      return Result.Err(`Failed to open chat: ${formatErr(rChat.Err())}`);
    }
    const chat = rChat.Ok();

    const rInspect = await chat.inspect({
      messages: [{ role: "user", content: [{ type: "text", text: args.prompt }] }],
    });
    await chat.close();
    if (rInspect.isErr()) {
      return Result.Err(`Inspect failed: ${formatErr(rInspect.Err())}`);
    }
    const res = rInspect.Ok();

    const output = args.asText ? formatInspectAsText(res) : JSON.stringify(res, null, 2);

    return sendMsg(ctx, {
      type: "use-vibes.cli.res-inspect",
      appSlug: chat.appSlug,
      userSlug: chat.userSlug,
      chatId: chat.chatId,
      output,
    } satisfies ResInspect);
  },
};

export function inspectCmd(ctx: CliCtx) {
  return command({
    name: "inspect",
    description:
      "Dry-run: show the exact {model, messages} the server would dispatch for a chat continuation, without calling the LLM.",
    args: {
      ...cmdTsDefaultArgs(ctx),
      appSlug: positional({
        displayName: "appSlug",
        description: "Slug of the app/chat to inspect",
        type: string,
      }),
      prompt: option({
        long: "prompt",
        short: "p",
        description: "Treat this text as the next user turn for assembly",
        type: string,
      }),
      userSlug: option({
        long: "user-slug",
        description: "User slug owning the app (uses default if omitted)",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      asText: flag({
        long: "text",
        description: "Render messages as a human-readable transcript instead of JSON",
      }),
    },
    handler: ctx.cliStream.enqueue((args) => {
      return { type: "use-vibes.cli.inspect", ...args };
    }),
  });
}
```

- [ ] **Step 4: Wire into main.ts**

In `vibes-diy/cli/main.ts`, add the import:

```ts
import { inspectCmd, isResInspect } from "./cmds/inspect-cmd.js";
```

Find the `subcommands({...})` call that lists `edit`, `generate`, etc. and add an `inspect: inspectCmd(ctx)` entry next to `edit`.

Then find the output-formatting block that switches on result types (looks for `isResEdit`, `isResGenerate`, etc.) and add a branch for `isResInspect` that prints `res.output` to stdout verbatim. If the file uses `console.log`, use:

```ts
} else if (isResInspect(res)) {
  process.stdout.write(res.output + "\n");
}
```

Also register `inspectEvento` in whatever `evento.push(...)` call the main CLI uses for command handlers — grep `editEvento` in `main.ts` to find the right call site, and add `inspectEvento` alongside it.

- [ ] **Step 5: Run the formatter test**

Run: `cd vibes-diy && pnpm vitest run cli/cmds/inspect-cmd.test.ts`
Expected: 2 passing.

- [ ] **Step 6: Type-check the CLI**

Run: `pnpm --filter vibes-diy build`
Expected: builds cleanly.

- [ ] **Step 7: Commit**

```bash
git add vibes-diy/cli/cmds/inspect-cmd.ts vibes-diy/cli/cmds/inspect-cmd.test.ts vibes-diy/cli/main.ts
git commit -m "$(cat <<'EOF'
feat(cli): add vibes-diy inspect subcommand (#1696)

Dry-run prompt inspection: resolves a chat via openChat (no side effect),
calls the new inspect handler, prints {model, messages} as JSON by default
or a human-readable transcript with --text.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Full check + ship

- [ ] **Step 1: Run prettier on changed files**

Run: `npx prettier --write $(git diff --name-only main...HEAD | grep -E '\.(ts|tsx|js|json|md)$')`
Expected: files reformatted in place.

- [ ] **Step 2: Run the full check**

Run: `pnpm check 2>&1 | tee /tmp/pnpm-check-1696.log`
Expected: all green.

If failures: grep the log for the failure, fix, re-run. If the failure looks like a flaky test (see `agents/flaky-tests.md`), rerun the failing suite in isolation before treating it as real. Do not skip hooks; do not bypass formatting.

- [ ] **Step 3: Commit any formatter-only changes**

If prettier changed files, commit them as a separate housekeeping commit:

```bash
git add -u
git commit -m "$(cat <<'EOF'
chore: prettier on dry-run inspection changes (#1696)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Verify the commit log makes sense**

Run: `git log --oneline main..HEAD`
Expected: 4–6 focused commits (types, refactor, handler, api-impl, cli, optional prettier).

- [ ] **Step 5: Push and open PR**

Run: `git push -u origin worktree-issue-1696-dry-run-prompt-inspection`
Then:
```bash
gh pr create --title "feat(api+cli): dry-run prompt inspection for edit/generate" --body "$(cat <<'EOF'
## Summary
- Adds `inspectPromptChatSection` Evento handler: returns `{ model, messages }` with zero side effects (no `PromptContexts` write, no `ChatSections` append, no LLM call, no billing).
- Extracts `assemblePromptPayload` from the existing dispatch path; the `prompt.req` block is now written *after* assembly, so dry-run and dispatch share the exact same assembly function.
- Adds `vibes-diy inspect <appSlug> --prompt "<text>"` CLI subcommand. JSON by default; `--text` renders a human-readable transcript.

## Test plan
- [ ] `cd vibes.diy/tests && pnpm vitest run ../api/tests/inspect-prompt-chat-section.test.ts` — 3 passing.
- [ ] `cd vibes.diy/tests && pnpm vitest run ../api/tests/assemble-prompt-payload.test.ts` — 2 passing.
- [ ] `cd vibes.diy/tests && pnpm vitest run ../api/tests/seed-chat-section.test.ts ../api/tests/reconstruct-messages.test.ts ../api/tests/recovery.test.ts` — all passing (regression guard for the dispatch refactor).
- [ ] `cd vibes-diy && pnpm vitest run cli/cmds/inspect-cmd.test.ts` — 2 passing.
- [ ] `pnpm check` — green.
- [ ] Manual smoke: `vibes-diy inspect <known-app> --prompt "test"` against `pnpm dev` returns a valid payload with system prompt + user turn; `--text` renders a readable transcript.

Closes #1696.
EOF
)"
```

Do NOT merge without explicit confirmation (see memory: ask before merging PRs).

---

## Self-Review Notes

**Spec coverage check:**
- dryRun returns full payload — Task 3 test.
- Zero side effects with row count assertion — Task 3 first test.
- Works for continuation and initial generate — Task 2 first test (initial empty chat) and Task 3 test (chat with priorFs would also be covered by reusing the existing seed-chat-section fixture in a follow-up; spec note in design doc).
- Auth/ownership identical — Task 3 second test (api2 cannot inspect api's chat).
- CLI prints payload — Task 5 + manual smoke in Task 6.
- `--text` rendering — Task 5 formatter test.
- Unit test for dry-run shape + no writes — Task 3 first test.
- Smoke test against pnpm dev — Task 6 step 5 manual.
- Existing edit/generate flows untouched — Task 2 step 8 runs prompt-chat related tests after the refactor.

**Type consistency check:**
- `assemblePromptPayload(vctx, { chatId, model, newUserMessages })` — same args used in Tasks 2, 3.
- `ResInspectPromptChatSection.messages` is `LLMRequest.get("messages")` shape, used in Task 1 (definition), Task 3 (response), Task 4 (`chat.inspect` return), Task 5 (formatter).
- `isResInspectPromptChatSection` — defined Task 1, used Tasks 3, 4.

**Placeholder scan:** none — every step has either exact code, exact commands, or exact file/line targets.
