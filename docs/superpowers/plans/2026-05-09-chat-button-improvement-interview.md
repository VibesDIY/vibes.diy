# Chat Button — Improvement Interview Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a **Chat** submit button next to **Code** in the chat input that runs an improvement-only interview using a dedicated, lean system prompt, then auto-hands off to a regular code-gen pass when the LLM produces a `<vibes-brief>`.

**Architecture:** New `'brainstorm'` mode end-to-end (request type, system-prompt asset, builder, server branch). Existing chat session is reused via a `mode` override on `LLMChat.prompt()`. Frontend renders a second button in `ChatInput`, parses `▸ ` lines in assistant narration into clickable option buttons inside the message bubble, and detects a closing `</vibes-brief>` tag at turn-end to fire a follow-up `mode: 'app'` prompt automatically.

**Tech Stack:** TypeScript, React, vitest, arktype, @adviser/cement (Result type), Tailwind, drizzle-orm. Asset bundling via prompts-pkg `loadAsset` (esm.sh + worker `/vibe-pkg/` fallback). Chat over WebSocket via `LLMChat`.

**Spec reference:** [docs/superpowers/specs/2026-05-09-chat-button-improvement-interview-design.md](../specs/2026-05-09-chat-button-improvement-interview-design.md)

**Important deviation from spec:** The spec said brainstorm should resolve via the `applicationChats` branch in `getResChatFromMode`. The chat editor route ([chat.$userHandle.$appSlug.tsx:389](../../vibes.diy/pkg/app/routes/chat/chat.$userHandle.$appSlug.tsx)) opens its session with `mode: "chat"`, which only ensures a `chatContexts` row — `applicationChats` is not guaranteed to exist for these chats. Brainstorm therefore joins the **chatContexts** branch (alongside `'chat'` creation mode) so the existing session's chat row is found. The system-prompt selection still diverges per-mode; only the table lookup is shared.

---

## File Structure

**Create:**

- `prompts/pkg/system-prompt-brainstorm.md` — interview prompt template with `{{TITLE_SECTION}}`, `{{THEME_DESIGN}}`, `{{CURRENT_VFS}}` placeholders.
- `prompts/tests/brainstorm-prompt.test.ts` — unit tests for `makeBrainstormSystemPrompt`.
- `vibes.diy/pkg/app/utils/option-lines.ts` — pure parser for splitting prose vs `▸ ` option lines.
- `vibes.diy/tests/app/option-lines.test.ts` — unit tests for the parser.
- `vibes.diy/pkg/app/components/OptionButtons.tsx` — visual component for clickable option buttons.

**Modify:**

- `vibes.diy/api/types/chat.ts` — extend `PromptLLMStyle`; add `reqPromptBrainstormChatSection`.
- `prompts/pkg/prompts.ts` — add `makeBrainstormSystemPrompt`.
- `prompts/pkg/index.ts` — re-export.
- `prompts/tests/helpers/load-mock-data.ts` — serve the new asset in tests.
- `vibes.diy/api/svc/public/prompt-chat-section.ts` — branch system-prompt selection; extend `getResChatFromMode`; skip recovery for brainstorm.
- `vibes.diy/api/types/vibes-diy-api.ts` — extend `LLMChat.prompt()` opts with optional `mode`.
- `vibes.diy/api/impl/index.ts` — `LLMChatImpl.prompt()` honors mode override.
- `vibes.diy/pkg/app/components/ChatInput.tsx` — render Chat button next to Code; `onSubmit` accepts mode.
- `vibes.diy/pkg/app/routes/chat/chat.$userHandle.$appSlug.tsx` — `sendPrompt` carries mode; brainstorm dispatches via `chat.prompt(msg, { mode: "brainstorm" })`; auto-handoff on turn-end.
- `vibes.diy/pkg/app/components/MessageList.tsx` — pass `onSelectOption` + `isLast` to `TopLevelMsg`; `TopLevelMsg` runs the parser and renders `<OptionButtons>` below the prose.
- `vibes.diy/pkg/app/components/ChatInterface.tsx` — accept `onSelectOption` and forward to `MessageList`.

---

## Setup: branch and worktree

- [ ] **Step 1: Create a feature branch off the current branch.**

The user is on `fix/dev-asset-session-port-and-cors`. Branch off it (the spec was committed there).

```bash
git checkout -b feat/chat-button-improvement-interview
git status
```

Expected: clean working tree on the new branch.

---

## Task 1: Add `'brainstorm'` mode types

**Files:**

- Modify: `vibes.diy/api/types/chat.ts`

- [ ] **Step 1: Open `vibes.diy/api/types/chat.ts` and extend `PromptLLMStyle`.**

Replace:

```ts
export const PromptLLMStyle = type("'chat' | 'app' | 'img'");
```

with:

```ts
export const PromptLLMStyle = type("'chat' | 'app' | 'img' | 'brainstorm'");
```

- [ ] **Step 2: Add `reqPromptBrainstormChatSection` after `reqPromptImageChatSection`.**

Insert directly below the `reqPromptImageChatSection` block (around line 96 of the file as it is today):

```ts
export const reqPromptBrainstormChatSection = type({
  type: "'vibes.diy.req-prompt-chat-section'",
  mode: "'brainstorm'",
  auth: dashAuthType,
  chatId: "string",
  outerTid: "string", // this is used to emit events to the current chat session
  prompt: LLMRequest,
});

export function isReqPromptBrainstormChatSection(obj: unknown): obj is typeof reqPromptBrainstormChatSection.infer {
  return !(reqPromptBrainstormChatSection(obj) instanceof type.errors);
}
```

- [ ] **Step 3: Extend `reqPromptLLMChatSection` to include the new request.**

Replace:

```ts
export const reqPromptLLMChatSection = reqCreationPromptChatSection
  .or(reqPromptApplicationChatSection)
  .or(reqPromptImageChatSection);
```

with:

```ts
export const reqPromptLLMChatSection = reqCreationPromptChatSection
  .or(reqPromptApplicationChatSection)
  .or(reqPromptImageChatSection)
  .or(reqPromptBrainstormChatSection);
```

- [ ] **Step 4: Build the api-types package to surface any type errors.**

```bash
cd /Users/marcusestes/Websites/vibes.diy/vibes.diy/api && pnpm tsc --noEmit
```

Expected: no errors. If anything in the package references an exhaustive switch on `PromptLLMStyle` or `PromptStyle`, the new value is now available — the build will flag missing branches.

- [ ] **Step 5: Commit.**

```bash
git add vibes.diy/api/types/chat.ts
git commit -m "feat(api-types): add 'brainstorm' to PromptLLMStyle and request type"
```

---

## Task 2: Create the brainstorm system-prompt asset

**Files:**

- Create: `prompts/pkg/system-prompt-brainstorm.md`

- [ ] **Step 1: Write `prompts/pkg/system-prompt-brainstorm.md` with the full interview content.**

Use the contents below verbatim. Keep markdown formatting; the loader emits this string into the system message as-is.

````markdown
You are an interview assistant that helps a user identify and specify improvements to an existing Vibes app. You ask short, friendly, multiple-choice questions, never use technical jargon, and never write code. Your only output is conversational markdown plus a final `<vibes-brief>` block when the user is ready.

The user is non-technical. Avoid words like "schema", "rows", "tables", "state management", "CRDT", "sync", "endpoint", or "database". Talk about features, saving, sharing, and how the app feels.

## How it works

You ALREADY have an app. The user wants to change something about it. Your job is to clarify _what_ should change and _why_, then emit a brief that the build pass can act on.

You have access to the current app state in the `<current-vfs>...</current-vfs>` block below — read it to ask sharp, specific questions about what is actually there. Do not ask about features that already exist as if they don't.

Ask ONE question at a time with 2–4 concrete options. The user can also type a custom answer. Keep asking as long as each question meaningfully sharpens the change request — there is no hard limit. Stop when:

- The user picks the escape hatch.
- You can't think of another question that would change the resulting build.
- The original request was specific enough that 0 questions are needed — go straight to the brief.

Every question after the first MUST end with the escape hatch as the last option:

▸ That's enough — let's build it!

## Formatting

Each option goes on its own line, prefixed with `▸ ` (the `▸` character followed by a space). The chat UI parses these into clickable buttons. Always put the question text ABOVE the options, separated by a blank line. Example:

```
What part of the app needs to feel better?

▸ The way notes are organized
▸ How the form looks when I'm typing
▸ The empty state when I open the app
▸ That's enough — let's build it!
```

The `▸` marker is required — without it the option will not become a button. Do not number options. Do not use bullets, dashes, or other list markers.

## Question categories (improvement-only)

Draw from these categories. Skip what is already settled or what doesn't apply. **Invent answer choices fresh from the current app** — do not reuse generic options. The choices should reference what the user actually has.

- **Opener — what needs to feel better?** Always lead with this. Options reference parts of the actual app from `<current-vfs>`.

- **Main interaction.** What part of using the app should change? Options drawn from the actual interactions visible in the code.

- **What's the friction?** What is annoying or confusing about how it works today?

- **What's missing?** What should be there that isn't?

- **What's the vibe?** Should the personality or tone shift, or is it staying the same? Mood, not visuals.

- **What gets saved?** Are we adding a new piece of information that should still be there tomorrow, or just changing how an existing piece looks?

- **Sharing changes.** Only ask if the existing app has any sharing — does the proposed change affect what other people see?

- **Scope of this change.** A quick polish, a new feature, or a bigger rework?

- **Special features.** Anything unique to this change that would shape how it's built (a timer, a vote, an AI suggestion, a drag interaction, etc.).

## Translation Layer (Claude reasoning only — never show this to users)

Map user answers to data architecture for the build pass:

- "Just me" — all persistent data in a single Fireproof database (`useFireproof("vibe-…")`), no user attribution needed; Fireproof sync handles cross-device access.
- "Shared with a group" — same Fireproof database for everyone in the group, with `createdBy: user?.email || 'anonymous'` on user-owned docs.
- "Real-time with others" — shared Fireproof database with `createdBy` on every doc; ephemeral interaction (drag position, cursor, hover) stays in `useState` and is never written to Fireproof.
- "Personal views" — every doc tagged `createdBy`, filtered on read via `useLiveQuery` keyed on the current user.
- "Same view for everyone" — no filtering; `useLiveQuery` returns all docs to all clients.

Map vibe to personality:

- "Serious and buttoned-up" — formal labels, no emoji, concise copy.
- "Casual and friendly" — conversational microcopy, gentle humor.
- "Playful and a little weird" — fun empty states, personality in error messages.
- "Calm and focused" — minimal UI chrome, generous whitespace.

Map scope to architecture:

- "Quick polish" — small targeted edits, no new components.
- "New feature" — new section or component, possibly new persisted field.
- "Bigger rework" — restructure how features compose; multiple components touched.

## The brief

When you have enough context, present a 2–3 sentence summary in plain language, then emit the structured brief tag. The brief is the final assistant message of the interview — the build pass will pick it up automatically.

```
Here's what I'll change:

[2-3 sentence description of the change]

- [key piece of the change]
- [another piece]
- [persistence/sharing implications in plain language]
```

Then immediately emit the structured block:

```
<vibes-brief>
Change: [what's being added/changed/removed]
Affects: [which existing parts of the app are touched]
Scope: [quick polish / new feature / bigger rework]
Vibe shift: [if the personality is changing — otherwise "no change"]
Saves: [any new persistent fields]
Sharing: [any change to who sees what — otherwise "no change"]
Notes: [anything else the build pass needs to know]
</vibes-brief>
```

Do not include code, fenced blocks, or `<file>` tags in the brief. The build pass receives the brief as plain context and chooses how to apply it.

{{TITLE_SECTION}}
{{THEME_DESIGN}}
{{CURRENT_VFS}}
````

- [ ] **Step 2: Verify the file is on disk.**

```bash
ls -la /Users/marcusestes/Websites/vibes.diy/prompts/pkg/system-prompt-brainstorm.md
head -5 /Users/marcusestes/Websites/vibes.diy/prompts/pkg/system-prompt-brainstorm.md
```

Expected: file exists; first line begins with "You are an interview assistant…".

- [ ] **Step 3: Commit.**

```bash
git add prompts/pkg/system-prompt-brainstorm.md
git commit -m "feat(prompts): add brainstorm system-prompt asset"
```

---

## Task 3: Write failing test for `makeBrainstormSystemPrompt`

**Files:**

- Modify: `prompts/tests/helpers/load-mock-data.ts` (add brainstorm asset to mock fetcher)
- Create: `prompts/tests/brainstorm-prompt.test.ts`

- [ ] **Step 1: Add the brainstorm asset to the mock fetcher.**

Edit `prompts/tests/helpers/load-mock-data.ts`. Add an import at the top of the imports section:

```ts
import brainstormPromptTemplate from "../../pkg/system-prompt-brainstorm.md?raw";
```

Inside the `createMockFetchFromPkgFiles` function, add a new branch alongside the existing `system-prompt.md` branch:

```ts
if (url.includes("system-prompt-brainstorm.md")) {
  return Promise.resolve({
    ok: true,
    text: () => Promise.resolve(brainstormPromptTemplate),
  } as Response);
}
```

Place it BEFORE the `system-prompt.md` branch so the more-specific name wins (otherwise `system-prompt.md` matches first via `includes`).

- [ ] **Step 2: Write `prompts/tests/brainstorm-prompt.test.ts`.**

```ts
import { describe, it, expect, vi } from "vitest";
import { makeBrainstormSystemPrompt } from "@vibes.diy/prompts";
import { createMockFetchFromPkgFiles } from "./helpers/load-mock-data.js";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("makeBrainstormSystemPrompt", () => {
  it("substitutes title, theme, and a multi-file VFS", async () => {
    const fetchImpl = createMockFetchFromPkgFiles();
    globalThis.fetch = vi.fn(fetchImpl as unknown as typeof fetch);

    const result = await makeBrainstormSystemPrompt("anthropic/claude-opus-4.5", {
      title: "Quick Notes",
      theme: undefined,
      currentVfs: new Map([
        ["App.jsx", "export default function App() { return <main>hi</main>; }"],
        ["helpers.js", "export const greet = () => 'hi';"],
      ]),
    });

    const sp = result.systemPrompt;

    // Title is interpolated into the {{TITLE_SECTION}} marker.
    expect(sp).toContain('The app is called "Quick Notes"');
    // Both files appear inside <current-vfs>, sorted by path (App.jsx before helpers.js).
    expect(sp).toMatch(/<current-vfs>[\s\S]*<file path="App\.jsx">[\s\S]*<file path="helpers\.js">[\s\S]*<\/current-vfs>/);
    // The interview content is present.
    expect(sp).toContain("interview assistant");
    // The skill catalog markers from the code-gen template are NOT present.
    expect(sp).not.toContain("{{CONCATENATED_LLMS}}");
    expect(sp).not.toContain("{{IMPORT_STATEMENTS}}");
  });

  it("handles an empty VFS without leaking placeholder syntax", async () => {
    const fetchImpl = createMockFetchFromPkgFiles();
    globalThis.fetch = vi.fn(fetchImpl as unknown as typeof fetch);

    const result = await makeBrainstormSystemPrompt("anthropic/claude-opus-4.5", {
      currentVfs: new Map(),
    });

    expect(result.systemPrompt).not.toContain("{{CURRENT_VFS}}");
    expect(result.systemPrompt).not.toContain("{{TITLE_SECTION}}");
    expect(result.systemPrompt).not.toContain("{{THEME_DESIGN}}");
  });

  it("emits files in stable sorted order", async () => {
    const fetchImpl = createMockFetchFromPkgFiles();
    globalThis.fetch = vi.fn(fetchImpl as unknown as typeof fetch);

    const result = await makeBrainstormSystemPrompt("anthropic/claude-opus-4.5", {
      currentVfs: new Map([
        ["zeta.js", "// z"],
        ["alpha.js", "// a"],
        ["middle.jsx", "// m"],
      ]),
    });

    const sp = result.systemPrompt;
    const aIdx = sp.indexOf('path="alpha.js"');
    const mIdx = sp.indexOf('path="middle.jsx"');
    const zIdx = sp.indexOf('path="zeta.js"');
    expect(aIdx).toBeGreaterThanOrEqual(0);
    expect(mIdx).toBeGreaterThan(aIdx);
    expect(zIdx).toBeGreaterThan(mIdx);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails.**

```bash
cd /Users/marcusestes/Websites/vibes.diy/prompts/tests && pnpm test brainstorm-prompt -- --run
```

Expected: FAIL — `makeBrainstormSystemPrompt` is not exported by `@vibes.diy/prompts` yet.

- [ ] **Step 4: Commit.**

```bash
git add prompts/tests/helpers/load-mock-data.ts prompts/tests/brainstorm-prompt.test.ts
git commit -m "test(prompts): failing tests for makeBrainstormSystemPrompt"
```

---

## Task 4: Implement `makeBrainstormSystemPrompt`

**Files:**

- Modify: `prompts/pkg/prompts.ts`
- Modify: `prompts/pkg/index.ts`

- [ ] **Step 1: Add the builder to `prompts/pkg/prompts.ts`.**

Append (just before the final `export async function getSkillText` if you prefer; placement doesn't matter so long as the imports above are present):

```ts
export interface MakeBrainstormSystemPromptOptions {
  fetch?: typeof fetch;
  pkgBaseUrl?: string;
}

export interface BrainstormSystemPromptResult {
  systemPrompt: string;
  model: string;
}

export async function makeBrainstormSystemPrompt(
  model: string,
  sessionDoc: {
    title?: string;
    theme?: string;
    currentVfs?: ReadonlyMap<string, string>;
  } & MakeBrainstormSystemPromptOptions
): Promise<BrainstormSystemPromptResult> {
  const pkgBaseUrl = sessionDoc?.pkgBaseUrl ?? DEFAULT_PKG_BASE_URL;

  // Title — match the wording used by the code-gen path so the LLM treats it
  // the same way.
  const titleSection = sessionDoc?.title
    ? `The app is called "${sessionDoc.title}". Use this name when you ask about the app.\n\n`
    : "";

  // Theme — load and wrap the same way makeBaseSystemPrompt does. Validate
  // against the theme catalog so an unknown slug silently drops.
  const themeCatalogNames = getThemeCatalogNames();
  const requestedTheme = typeof sessionDoc?.theme === "string" ? sessionDoc.theme : undefined;
  const validatedTheme = requestedTheme && themeCatalogNames.has(requestedTheme) ? requestedTheme : undefined;
  let themeDesignSection = "";
  if (validatedTheme) {
    const rTheme = await keyedLoadAsset.get(`theme:${validatedTheme}`).once(async () => {
      return loadAsset(`./themes/${validatedTheme}.md`, {
        fallBackUrl: pkgBaseUrl,
        basePath: () => import.meta.url,
        mock: { fetch: sessionDoc.fetch },
      });
    });
    if (!rTheme.isErr()) {
      themeDesignSection = `<theme-design-md>\n${rTheme.Ok() ?? ""}\n</theme-design-md>\n\n`;
    }
  }

  // Current VFS — render every file as <file path="…">…</file>, sorted by
  // path, wrapped in <current-vfs>. Empty map collapses to "".
  const vfs = sessionDoc?.currentVfs;
  let vfsSection = "";
  if (vfs && vfs.size > 0) {
    const sortedKeys = [...vfs.keys()].sort();
    const fileBlocks = sortedKeys.map((path) => `<file path="${path}">\n${vfs.get(path) ?? ""}\n</file>`).join("\n");
    vfsSection = `<current-vfs>\n${fileBlocks}\n</current-vfs>`;
  }

  const template = await getSystemPromptTemplate(pkgBaseUrl, "system-prompt-brainstorm.md", sessionDoc.fetch);
  const systemPrompt = template
    .replaceAll("{{TITLE_SECTION}}", titleSection)
    .replaceAll("{{THEME_DESIGN}}", themeDesignSection)
    .replaceAll("{{CURRENT_VFS}}", vfsSection);

  return { systemPrompt, model };
}
```

Note: `getSystemPromptTemplate` is the existing private helper in `prompts.ts` — it accepts a filename and is keyed-cached. Reusing it gives us the same loadAsset path as `system-prompt.md`.

- [ ] **Step 2: Re-export from `prompts/pkg/index.ts`.**

Add to `prompts/pkg/index.ts`:

```ts
export { makeBrainstormSystemPrompt } from "./prompts.js";
```

(Placement: anywhere in the file; I suggest right after `export { resolveEffectiveModel } from "./prompts.js";` for visual grouping.)

- [ ] **Step 3: Run the test to verify it passes.**

```bash
cd /Users/marcusestes/Websites/vibes.diy/prompts/tests && pnpm test brainstorm-prompt -- --run
```

Expected: PASS — all three test cases green.

- [ ] **Step 4: Commit.**

```bash
git add prompts/pkg/prompts.ts prompts/pkg/index.ts
git commit -m "feat(prompts): add makeBrainstormSystemPrompt builder"
```

---

## Task 5: Backend — branch system-prompt selection on brainstorm mode

**Files:**

- Modify: `vibes.diy/api/svc/public/prompt-chat-section.ts`

- [ ] **Step 1: Update imports at the top of `prompt-chat-section.ts`.**

Find the existing import line (around [prompt-chat-section.ts:88](../../vibes.diy/api/svc/public/prompt-chat-section.ts:88)):

```ts
import { getRecoveryAddendum, getRecoveryStitchAddendum, makeBaseSystemPrompt, resolveEffectiveModel } from "@vibes.diy/prompts";
```

Replace with:

```ts
import {
  getRecoveryAddendum,
  getRecoveryStitchAddendum,
  makeBaseSystemPrompt,
  makeBrainstormSystemPrompt,
  resolveEffectiveModel,
} from "@vibes.diy/prompts";
```

- [ ] **Step 2: Branch the system-prompt selection.**

Find the block at [prompt-chat-section.ts:709](../../vibes.diy/api/svc/public/prompt-chat-section.ts:709):

```ts
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
```

Replace with (preserving surrounding `if (systemPrompt.isErr())` etc.):

```ts
const systemPrompt = await exception2Result(async () => {
  const effectiveModel = await resolveEffectiveModel({ model }, {});
  const pkgBaseUrl = promptsPkgBaseUrl(vctx.params.pkgRepos.workspace);
  const fetchOverride = createPromptAssetFetch({ fetchAsset: vctx.fetchAsset });
  if (resChat.mode === "brainstorm") {
    return makeBrainstormSystemPrompt(effectiveModel, {
      title,
      theme,
      currentVfs: priorFs,
      pkgBaseUrl,
      fetch: fetchOverride,
    });
  }
  return makeBaseSystemPrompt(effectiveModel, {
    skills,
    theme,
    title,
    demoData: false,
    variant: isInitial ? "initial" : "continuation",
    pkgBaseUrl,
    fetch: fetchOverride,
  });
});
```

`priorFs` is the `ReadonlyMap<string, string>` already loaded a few lines above by `loadPriorFileSystem(vctx, chatId)` — exactly the format `makeBrainstormSystemPrompt` expects.

- [ ] **Step 3: Build the api package to verify the type changes compile.**

```bash
cd /Users/marcusestes/Websites/vibes.diy/vibes.diy/api && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit.**

```bash
git add vibes.diy/api/svc/public/prompt-chat-section.ts
git commit -m "feat(api): select brainstorm system prompt for mode='brainstorm'"
```

---

## Task 6: Backend — extend `getResChatFromMode` for brainstorm

**Files:**

- Modify: `vibes.diy/api/svc/public/prompt-chat-section.ts`

- [ ] **Step 1: Verify the current `getResChatFromMode` shape.**

Open [prompt-chat-section.ts:751](../../vibes.diy/api/svc/public/prompt-chat-section.ts:751). The function checks `isReqPromptApplicationChatSection || isReqPromptImageChatSection` for the `applicationChats` branch; everything else falls through to `chatContexts`.

- [ ] **Step 2: Confirm brainstorm joins the chatContexts branch.**

The route ([chat.$userHandle.$appSlug.tsx:389](../../vibes.diy/pkg/app/routes/chat/chat.$userHandle.$appSlug.tsx)) opens its session with `mode: "chat"`, which only ensures a `chatContexts` row. Brainstorm uses the same chat session, so it must look the row up in `chatContexts`. **No code change is required** — falling through to the `else` branch is correct.

What we DO need to change: extend the `if (!iResChat)` error-typing block so a missing chatContexts row reports a specific brainstorm error (instead of generically falling through with no `Result.Err` branch matched).

Find:

```ts
if (!iResChat) {
  if (isReqCreationPromptChatSection(orig)) {
    return Result.Err(`Creation Chat ID ${req.chatId} not found`);
  } else if (isReqPromptApplicationChatSection(orig)) {
    return Result.Err(`Application Chat ID ${req.chatId} not found`);
  } else if (isReqPromptImageChatSection(orig)) {
    return Result.Err(`Image Chat ID ${req.chatId} not found`);
  }
}
```

Replace with:

```ts
if (!iResChat) {
  if (isReqCreationPromptChatSection(orig)) {
    return Result.Err(`Creation Chat ID ${req.chatId} not found`);
  } else if (isReqPromptApplicationChatSection(orig)) {
    return Result.Err(`Application Chat ID ${req.chatId} not found`);
  } else if (isReqPromptImageChatSection(orig)) {
    return Result.Err(`Image Chat ID ${req.chatId} not found`);
  } else if (isReqPromptBrainstormChatSection(orig)) {
    return Result.Err(`Brainstorm Chat ID ${req.chatId} not found`);
  }
}
```

- [ ] **Step 3: Add the import for `isReqPromptBrainstormChatSection` at the top of the file.**

Find the existing imports from `../../types/chat.js` (search the file for `isReqPromptImageChatSection` to locate the line). Add `isReqPromptBrainstormChatSection` to the same import list.

- [ ] **Step 4: Build the api package.**

```bash
cd /Users/marcusestes/Websites/vibes.diy/vibes.diy/api && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit.**

```bash
git add vibes.diy/api/svc/public/prompt-chat-section.ts
git commit -m "feat(api): brainstorm mode resolves via chatContexts branch"
```

---

## Task 7: Backend — skip recovery for brainstorm mode

**Files:**

- Modify: `vibes.diy/api/svc/public/prompt-chat-section.ts`

- [ ] **Step 1: Locate the recovery dispatch.**

Find the recovery branch at [prompt-chat-section.ts:1539](../../vibes.diy/api/svc/public/prompt-chat-section.ts:1539). It begins with `const stitchMode = recoveryCounter.consecutiveFruitless === 2;`. The recovery exists because code-gen output can fail mid-SEARCH/REPLACE; brainstorm output has no SEARCH/REPLACE blocks to recover.

- [ ] **Step 2: Guard the recovery path on `resChat.mode !== "brainstorm"`.**

Find the function that contains this recovery block (search backward from line 1539 for the nearest `function` keyword — likely `dispatchRecoveryIfApplicable` or inline inside `handlerLlmRequest`). Add an early return at the top of the recovery dispatch:

```ts
if (resChat.mode === "brainstorm") {
  // Brainstorm output is plain markdown — no SEARCH/REPLACE blocks to recover.
  return Result.Ok();
}
```

Place it immediately after the function's parameter destructuring, before any other early-return checks. If `resChat` is not in scope at that point, locate the nearest enclosing scope where it IS available and add the guard one level out (the call to `recoveryLogger.Debug()…Msg("recovery-start")` is the latest you can guard before recovery work begins).

- [ ] **Step 3: Build the api package.**

```bash
cd /Users/marcusestes/Websites/vibes.diy/vibes.diy/api && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit.**

```bash
git add vibes.diy/api/svc/public/prompt-chat-section.ts
git commit -m "feat(api): skip SEARCH/REPLACE recovery for brainstorm mode"
```

---

## Task 8: Chat session API — add `mode` override to `LLMChat.prompt()`

**Files:**

- Modify: `vibes.diy/api/types/vibes-diy-api.ts`
- Modify: `vibes.diy/api/impl/index.ts`

- [ ] **Step 1: Extend the `LLMChat` interface.**

In `vibes.diy/api/types/vibes-diy-api.ts` find:

```ts
export interface LLMChat extends LLMChatEntry {
  prompt(req: LLMRequest, opts?: { inputImageBase64?: string }): Promise<Result<ResPromptChatSection, VibesDiyError>>;
```

Replace with:

```ts
export interface LLMChat extends LLMChatEntry {
  /**
   * Send a user prompt. By default the request goes out with the chat
   * session's mode (set when openChat was called). Pass `opts.mode` to send
   * a single prompt under a different mode without reopening the session
   * — used by the Chat (brainstorm) button to interleave brainstorm and
   * code-gen turns inside one chat thread.
   */
  prompt(
    req: LLMRequest,
    opts?: { inputImageBase64?: string; mode?: import("./chat.js").PromptLLMStyle }
  ): Promise<Result<ResPromptChatSection, VibesDiyError>>;
```

- [ ] **Step 2: Honor the override in `LLMChatImpl.prompt`.**

In `vibes.diy/api/impl/index.ts` find the existing `prompt` method ([api/impl/index.ts:904](../../vibes.diy/api/impl/index.ts:904)). Replace with:

```ts
  async prompt(
    msg: LLMRequest,
    opts?: { inputImageBase64?: string; mode?: PromptLLMStyle }
  ): Promise<Result<ResPromptChatSection, VibesDiyError>> {
    const mode = opts?.mode ?? this.res.mode;
    if (!isPromptLLMStyle(mode)) {
      return Result.Err({
        type: "vibes.diy.error",
        name: "VibesDiyError",
        message: `Chat mode ${mode} does not support prompting`,
        code: "unsupported-chat-mode",
      } as VibesDiyError);
    }
    const res = await this.api.request<ReqType<ReqPromptLLMChatSection>, ResPromptChatSection>(
      {
        type: "vibes.diy.req-prompt-chat-section",
        mode,
        chatId: this.res.chatId,
        outerTid: this.tid,
        prompt: msg,
        ...(mode === "img" && opts?.inputImageBase64 ? { inputImageBase64: opts.inputImageBase64 } : {}),
      },
      {
        resMatch: isResPromptChatSection,
      }
    );
    return res;
  }
```

`PromptLLMStyle` is already imported in this file via `isPromptLLMStyle`; if not, add `PromptLLMStyle` to the existing import line that brings in `isPromptLLMStyle`.

- [ ] **Step 3: Build the api package.**

```bash
cd /Users/marcusestes/Websites/vibes.diy/vibes.diy/api && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit.**

```bash
git add vibes.diy/api/types/vibes-diy-api.ts vibes.diy/api/impl/index.ts
git commit -m "feat(api-impl): allow per-prompt mode override on LLMChat.prompt"
```

---

## Task 9: Frontend — `ChatInput` dual-button

**Files:**

- Modify: `vibes.diy/pkg/app/components/ChatInput.tsx`

- [ ] **Step 1: Update the `ChatInputProps` interface.**

Find the `ChatInputProps` interface at the top of [ChatInput.tsx](../../vibes.diy/pkg/app/components/ChatInput.tsx). Replace:

```ts
interface ChatInputProps {
  promptProcessing: boolean;
  onSubmit: (prompt: string) => void;
```

with:

```ts
interface ChatInputProps {
  promptProcessing: boolean;
  /**
   * `mode` is `'brainstorm'` when the user clicked Chat, `'app'` (code-gen)
   * when they clicked Code. Other modes are not exposed via this input.
   */
  onSubmit: (prompt: string, mode: "app" | "brainstorm") => void;
```

- [ ] **Step 2: Replace `handleSendPrompt` with a mode-aware version.**

Find:

```ts
const handleSendPrompt = useCallback(() => {
  if (prompt && !promptProcessing) {
    onSubmit(prompt);
    setPrompt("");
  }
}, [prompt, promptProcessing, onSubmit]);
```

Replace with:

```ts
const handleSendPrompt = useCallback(
  (mode: "app" | "brainstorm") => {
    if (prompt && !promptProcessing) {
      onSubmit(prompt, mode);
      setPrompt("");
    }
  },
  [prompt, promptProcessing, onSubmit]
);
```

- [ ] **Step 3: Update the keyboard handler to default to `'app'`.**

Find the `onKeyDown` handler on the `<textarea>`:

```ts
              onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === "Enter" && !e.shiftKey && !promptProcessing) {
                  e.preventDefault();
                  handleSendPrompt();
                }
              }}
```

Replace with:

```ts
              onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === "Enter" && !e.shiftKey && !promptProcessing) {
                  e.preventDefault();
                  handleSendPrompt("app");
                }
              }}
```

(Enter still triggers Code, matching today's behavior.)

- [ ] **Step 4: Update `useImperativeHandle` so `clickSubmit` keeps firing Code.**

Find:

```ts
          clickSubmit: () => {
            submitButtonRef.current?.click();
          },
```

This stays the same; `submitButtonRef` will continue to point at the Code button.

- [ ] **Step 5: Add the Chat button to the bottom row.**

Find the bottom-row JSX block beginning with:

```tsx
<div
  style={{
    display: "inline-flex",
    borderRadius: 7,
    padding: promptProcessing ? 2 : 0,
    background: promptProcessing ? btnSnakeBorder : "transparent",
    animation: promptProcessing ? "vibes-border-spin 2s linear infinite" : "none",
  }}
>
  <Button
    ref={submitButtonRef}
    type="button"
    onClick={handleSendPrompt}
    disabled={promptProcessing}
    variant="blue"
    size="fixed"
    aria-label={promptProcessing ? "Processing" : "Send message"}
    className={
      promptProcessing ? "!border-0 !shadow-none !bg-[var(--vibes-submit-disabled-bg)] !text-[var(--vibes-submit-disabled-fg)]" : ""
    }
    style={promptProcessing ? { opacity: 1 } : undefined}
  >
    {promptProcessing ? workingMessage : "Code"}
  </Button>
</div>
```

Replace with:

```tsx
<div className="flex items-center gap-2">
  <Button
    type="button"
    onClick={() => handleSendPrompt("brainstorm")}
    disabled={!hasCode || promptProcessing || !prompt}
    variant="blue"
    size="fixed"
    aria-label="Brainstorm an improvement"
    title={!hasCode ? "Available once your app has code — start with Code first." : "Brainstorm an improvement"}
    className="!bg-transparent !text-light-primary dark:!text-dark-primary !border !border-light-decorative-01 dark:!border-dark-decorative-01 hover:!bg-light-decorative-01 dark:hover:!bg-dark-decorative-01"
  >
    Chat
  </Button>
  <div
    style={{
      display: "inline-flex",
      borderRadius: 7,
      padding: promptProcessing ? 2 : 0,
      background: promptProcessing ? btnSnakeBorder : "transparent",
      animation: promptProcessing ? "vibes-border-spin 2s linear infinite" : "none",
    }}
  >
    <Button
      ref={submitButtonRef}
      type="button"
      onClick={() => handleSendPrompt("app")}
      disabled={promptProcessing}
      variant="blue"
      size="fixed"
      aria-label={promptProcessing ? "Processing" : "Send message"}
      className={
        promptProcessing
          ? "!border-0 !shadow-none !bg-[var(--vibes-submit-disabled-bg)] !text-[var(--vibes-submit-disabled-fg)]"
          : ""
      }
      style={promptProcessing ? { opacity: 1 } : undefined}
    >
      {promptProcessing ? workingMessage : "Code"}
    </Button>
  </div>
</div>
```

- [ ] **Step 6: Build the frontend package.**

```bash
cd /Users/marcusestes/Websites/vibes.diy/vibes.diy/pkg && pnpm tsc --noEmit
```

Expected: errors at the call site of `<ChatInput onSubmit={...}>` because `onSubmit` no longer takes a single string. We fix that in Task 10.

- [ ] **Step 7: Commit.**

```bash
git add vibes.diy/pkg/app/components/ChatInput.tsx
git commit -m "feat(chat-input): add Chat button next to Code with mode-aware onSubmit"
```

---

## Task 10: Frontend — thread mode through the chat route's `sendPrompt`

**Files:**

- Modify: `vibes.diy/pkg/app/routes/chat/chat.$userHandle.$appSlug.tsx`

- [ ] **Step 1: Change the `promptToSend` state shape.**

Find at [chat.$userHandle.$appSlug.tsx:257](../../vibes.diy/pkg/app/routes/chat/chat.$userHandle.$appSlug.tsx:257):

```ts
const [promptToSend, sendPrompt] = useState<string | null>(null);
```

Replace with:

```ts
type PendingPrompt = { text: string; mode: "app" | "brainstorm" };
const [promptToSend, sendPrompt] = useState<PendingPrompt | null>(null);
```

- [ ] **Step 2: Update the firing effect.**

Find at [chat.$userHandle.$appSlug.tsx:348](../../vibes.diy/pkg/app/routes/chat/chat.$userHandle.$appSlug.tsx:348):

```ts
      if (chat && promptToSend?.trim().length) {
```

Replace with:

```ts
      if (chat && promptToSend && promptToSend.text.trim().length) {
```

Then find the nearby:

```ts
const sentPrompt = promptToSend;
// Clear promptToSend BEFORE firing so any re-render of this effect
// (e.g. searchParams change) sees null and skips the branch.
sendPrompt(null);
chat.prompt({
  messages: [
    {
      role: "user",
      content: [{ type: "text", text: sentPrompt }],
    },
  ],
});
```

Replace with:

```ts
const sentPrompt = promptToSend;
// Clear promptToSend BEFORE firing so any re-render of this effect
// (e.g. searchParams change) sees null and skips the branch.
sendPrompt(null);
chat.prompt(
  {
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: sentPrompt.text }],
      },
    ],
  },
  sentPrompt.mode === "brainstorm" ? { mode: "brainstorm" } : undefined
);
```

The `console.log` immediately below uses `sentPrompt` as a string — change `console.log(`send prompt`, sentPrompt);` to `console.log(\`send prompt\`, sentPrompt.text, sentPrompt.mode);`.

Also find:

```ts
sendPrompt(promptText);
```

near [chat.$userHandle.$appSlug.tsx:506](../../vibes.diy/pkg/app/routes/chat/chat.$userHandle.$appSlug.tsx:506) and replace with:

```ts
sendPrompt({ text: promptText, mode: "app" });
```

(That call site is the URL-prompt prefill — keep it on `'app'` because URL prompts are first-build flows.)

- [ ] **Step 3: Update the `<ChatInput onSubmit={sendPrompt}>` wiring.**

Find at [chat.$userHandle.$appSlug.tsx:715](../../vibes.diy/pkg/app/routes/chat/chat.$userHandle.$appSlug.tsx:715):

```tsx
onSubmit = { sendPrompt };
```

Replace with:

```tsx
              onSubmit={(text, mode) => sendPrompt({ text, mode })}
```

- [ ] **Step 4: Build the frontend package.**

```bash
cd /Users/marcusestes/Websites/vibes.diy/vibes.diy/pkg && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run the existing app tests to make sure no regressions.**

```bash
cd /Users/marcusestes/Websites/vibes.diy/vibes.diy/tests && pnpm test -- --run
```

Expected: same pass/fail as before this change. Any new failures should be surfaced and addressed before continuing.

- [ ] **Step 6: Commit.**

```bash
git add vibes.diy/pkg/app/routes/chat/chat.$userHandle.$appSlug.tsx
git commit -m "feat(chat-route): plumb mode through sendPrompt for chat-button dispatch"
```

---

## Task 11: Frontend — option-line parser util

**Files:**

- Create: `vibes.diy/pkg/app/utils/option-lines.ts`
- Create: `vibes.diy/tests/app/option-lines.test.ts`

- [ ] **Step 1: Write the failing test first.**

Create `vibes.diy/tests/app/option-lines.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseOptionLines } from "../../pkg/app/utils/option-lines.js";

describe("parseOptionLines", () => {
  it("returns prose only when no marker is present", () => {
    const r = parseOptionLines("This is just prose.\nNo options here.");
    expect(r.prose).toBe("This is just prose.\nNo options here.");
    expect(r.options).toEqual([]);
  });

  it("extracts a trailing options group and removes it from the prose", () => {
    const text = ["What's the vibe?", "", "▸ Calm and focused", "▸ Playful and weird", "▸ That's enough — let's build it!"].join(
      "\n"
    );
    const r = parseOptionLines(text);
    expect(r.prose).toBe(["What's the vibe?", ""].join("\n"));
    expect(r.options).toEqual(["Calm and focused", "Playful and weird", "That's enough — let's build it!"]);
  });

  it("ignores partial trailing lines (still streaming)", () => {
    // Last line is a marker but the message isn't terminated by a newline,
    // so we treat it as in-progress and leave it in the prose.
    const r = parseOptionLines("Question?\n\n▸ Option A\n▸ Option B (partia");
    expect(r.options).toEqual(["Option A"]);
    expect(r.prose.endsWith("▸ Option B (partia")).toBe(true);
  });

  it("trims whitespace around markers", () => {
    const r = parseOptionLines("Q?\n\n▸   Spaced answer  ");
    expect(r.options).toEqual(["Spaced answer"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails.**

```bash
cd /Users/marcusestes/Websites/vibes.diy/vibes.diy/tests && pnpm test option-lines -- --run
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `parseOptionLines`.**

Create `vibes.diy/pkg/app/utils/option-lines.ts`:

```ts
/**
 * Splits an assistant message into prose and a trailing "▸ option" group.
 *
 * The chat UI renders option lines as clickable buttons. To avoid flickering
 * during streaming, a marker line is only counted as a button if it is fully
 * terminated (followed by a newline OR not the very last character of the
 * message).
 *
 * Mid-message marker groups are left in the prose — only a trailing group at
 * the end of the message is peeled off. This matches the prompt's
 * "question-then-options-then-end" cadence.
 */
export interface ParsedMessage {
  readonly prose: string;
  readonly options: readonly string[];
}

const MARKER = "▸"; // ▸ (BLACK RIGHT-POINTING SMALL TRIANGLE)

export function parseOptionLines(text: string): ParsedMessage {
  if (!text) return { prose: "", options: [] };

  // A marker line "counts" only if it is terminated by a newline. The last
  // line of a streaming message may be a partial marker — keep it in prose.
  const endsWithNewline = text.endsWith("\n");
  const lines = text.split("\n");

  // Walk backward, collecting consecutive marker lines. Stop at the first
  // non-marker (or non-blank-after-marker) line.
  let cutIndex = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    const stripped = lines[i].trimStart();
    if (stripped.startsWith(MARKER)) {
      // The very last line is only "complete" if the message ends with a
      // newline OR there's at least one more line below it.
      const isLast = i === lines.length - 1;
      if (isLast && !endsWithNewline) continue;
      cutIndex = i;
    } else if (stripped === "") {
      // Allow blank lines between options if the LLM emits them — keep walking.
      // Safety: stop if we walked past every marker.
      if (cutIndex < lines.length) break;
    } else {
      break;
    }
  }

  if (cutIndex === lines.length) {
    return { prose: text, options: [] };
  }

  const proseLines = lines.slice(0, cutIndex);
  const optionLines = lines.slice(cutIndex).filter((line) => line.trimStart().startsWith(MARKER));
  const options = optionLines.map((line) => line.trimStart().slice(MARKER.length).trim()).filter(Boolean);

  return {
    prose: proseLines.join("\n"),
    options,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes.**

```bash
cd /Users/marcusestes/Websites/vibes.diy/vibes.diy/tests && pnpm test option-lines -- --run
```

Expected: PASS — all four cases.

- [ ] **Step 5: Commit.**

```bash
git add vibes.diy/pkg/app/utils/option-lines.ts vibes.diy/tests/app/option-lines.test.ts
git commit -m "feat(chat-options): add parseOptionLines util with tests"
```

---

## Task 12: Frontend — `OptionButtons` component

**Files:**

- Create: `vibes.diy/pkg/app/components/OptionButtons.tsx`

- [ ] **Step 1: Write the component.**

```tsx
import React from "react";

interface OptionButtonsProps {
  readonly options: readonly string[];
  /** Disabled buttons (older, non-most-recent messages) render as visual history. */
  readonly disabled?: boolean;
  readonly onSelect?: (option: string) => void;
}

/**
 * Stacked clickable answer options for a brainstorm question.
 *
 * Rendered inside an assistant message bubble below the prose. Disabled state
 * is used for non-most-recent messages — the buttons stay visually present
 * (history) but cannot be clicked.
 */
export function OptionButtons({ options, disabled, onSelect }: OptionButtonsProps) {
  if (options.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-2" data-message-role="brainstorm-options">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onSelect?.(option)}
          className={
            "w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors " +
            "border border-light-decorative-01 dark:border-dark-decorative-01 " +
            "bg-light-background-01 dark:bg-dark-background-01 " +
            "text-light-primary dark:text-dark-primary " +
            (disabled
              ? "cursor-default opacity-70"
              : "hover:bg-light-decorative-01 dark:hover:bg-dark-decorative-01 cursor-pointer")
          }
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export default OptionButtons;
```

- [ ] **Step 2: Build the package.**

```bash
cd /Users/marcusestes/Websites/vibes.diy/vibes.diy/pkg && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit.**

```bash
git add vibes.diy/pkg/app/components/OptionButtons.tsx
git commit -m "feat(chat-options): add OptionButtons component"
```

---

## Task 13: Frontend — wire option buttons into `TopLevelMsg`

**Files:**

- Modify: `vibes.diy/pkg/app/components/MessageList.tsx`
- Modify: `vibes.diy/pkg/app/components/ChatInterface.tsx`

- [ ] **Step 1: Update `MessageListProps`.**

In `MessageList.tsx`, find the `MessageListProps` interface and add:

```ts
  onSelectOption?: (option: string) => void;
```

right below the existing `onRetry?: (msg: PromptError) => void;` line.

- [ ] **Step 2: Update the `TopLevelMsg` component to render options.**

Find the `TopLevelMsg` function (around [MessageList.tsx:126](../../vibes.diy/pkg/app/components/MessageList.tsx:126)). Update its props and body:

```tsx
import { parseOptionLines } from "../utils/option-lines.js";
import { OptionButtons } from "./OptionButtons.js";

// …existing imports…

function TopLevelMsg({
  lines,
  begin,
  isLast,
  onSelectOption,
}: {
  begin: ToplevelBeginMsg;
  lines: LineMsg[];
  isLast: boolean;
  onSelectOption?: (option: string) => void;
}) {
  const fullText = lines.map((i) => i.line).join("\n");
  const { prose, options } = parseOptionLines(fullText);

  const renderSeq = useChatDebug("TopLevelMsg", {
    sectionId: begin.sectionId,
    blockId: begin.blockId,
    streamId: begin.streamId,
    seq: begin.seq,
    blockNr: begin.blockNr,
    lineCount: lines.length,
    optionCount: options.length,
    isLast,
  });

  return (
    <div
      className="mb-4 flex flex-row justify-end px-4"
      key={begin.sectionId}
      data-message-role="narration"
      data-section-id={begin.sectionId}
      data-block-id={begin.blockId}
      data-prompt-id={begin.streamId}
      data-block-seq={begin.seq}
      data-render-seq={renderSeq}
    >
      <BrutalistCard size="md" messageType="ai" className="mr-8 max-w-[85%]" style={{ fontSize: "0.8rem" }}>
        <div className="prose prose-sm dark:prose-invert prose-ul:pl-5 prose-ul:list-disc prose-ol:pl-5 prose-ol:list-decimal prose-li:my-0 max-w-none">
          <ReactMarkdown>{prose}</ReactMarkdown>
        </div>
        <OptionButtons options={options} disabled={!isLast} onSelect={isLast ? onSelectOption : undefined} />
      </BrutalistCard>
    </div>
  );
}
```

- [ ] **Step 3: Pass `isLast` and `onSelectOption` from `MessageList`.**

In `MessageList`, find every place that renders `<TopLevelMsg ... />`. There is one usage inside the main `forEach` loop and another in the truncate-recovery block. Update both.

For the main one (around line 553):

```tsx
acc.push(<TopLevelMsg key={`toplevel-${block.begin.sectionId}-${idx}`} begin={block.begin} lines={block.lines} />);
```

Replace with:

```tsx
const isLast = msg.fsRef ? false /* code-end follow-up */ : true;
acc.push(
  <TopLevelMsg
    key={`toplevel-${block.begin.sectionId}-${idx}`}
    begin={block.begin}
    lines={block.lines}
    isLast={false}
    onSelectOption={onSelectOption}
  />
);
```

(We default older messages to `isLast={false}` and patch the _very last_ assistant message after the reduce — see step 4.)

For the truncate-recovery one:

```tsx
acc.push(
  <TopLevelMsg key={`pre-truncate-top-${preBlock.begin.sectionId}-${preIdx}`} begin={preBlock.begin} lines={preBlock.lines} />
);
```

Replace with:

```tsx
acc.push(
  <TopLevelMsg
    key={`pre-truncate-top-${preBlock.begin.sectionId}-${preIdx}`}
    begin={preBlock.begin}
    lines={preBlock.lines}
    isLast={false}
    onSelectOption={undefined}
  />
);
```

- [ ] **Step 4: After the reduce, mark the most recent `TopLevelMsg` as `isLast`.**

After the reduce that builds `messageElements`, scan for the last `TopLevelMsg` and clone it with `isLast={true}` and the live `onSelectOption`:

```tsx
// Mark the most recent TopLevelMsg as the active one — its option buttons
// are clickable; older ones are visual history.
if (!promptProcessing) {
  for (let i = messageElements.length - 1; i >= 0; i--) {
    const el = messageElements[i];
    // React.isValidElement guarantees el is a ReactElement; we still need
    // to narrow on the component type to be safe.
    if (React.isValidElement(el) && (el.type as { name?: string }).name === "TopLevelMsg") {
      messageElements[i] = React.cloneElement(el as React.ReactElement<{ isLast: boolean; onSelectOption?: (o: string) => void }>, {
        isLast: true,
        onSelectOption,
      });
      break;
    }
  }
}
```

Place this block immediately before the existing `useEffect(() => { … }, [lastFsRef?.fsId]);` and the `return (...)` JSX.

- [ ] **Step 5: Update the function signature and the destructure.**

Find the function signature:

```ts
function MessageList({
  promptBlocks,
  chatId,
  selectedFsId,
  onClick,
  onRetry,
  agentSavedBlockIds,
}: MessageListProps) {
```

Add `onSelectOption`:

```ts
function MessageList({
  promptBlocks,
  promptProcessing,
  chatId,
  selectedFsId,
  onClick,
  onRetry,
  onSelectOption,
  agentSavedBlockIds,
}: MessageListProps) {
```

Note: also include `promptProcessing` in the destructure if it isn't already — the step 4 logic uses it. (It's part of the props interface but the existing code did not destructure it.)

- [ ] **Step 6: Plumb `onSelectOption` through `ChatInterface.tsx`.**

In [ChatInterface.tsx](../../vibes.diy/pkg/app/components/ChatInterface.tsx), update the props and pass-through:

```tsx
function ChatInterface({
  promptState,
  onClick,
  onRetry,
  onSelectOption,
}: {
  promptState: PromptState;
  onClick: (a: { fsId: string; appSlug: string; userHandle: string }) => void;
  onRetry?: (msg: PromptError) => void;
  onSelectOption?: (option: string) => void;
}) {
```

And in the JSX, add `onSelectOption={onSelectOption}` to the `<MessageList ... />` element.

- [ ] **Step 7: Build the package.**

```bash
cd /Users/marcusestes/Websites/vibes.diy/vibes.diy/pkg && pnpm tsc --noEmit
```

Expected: errors at the call site of `<ChatInterface>` because `onSelectOption` is now expected. We resolve that in Task 14.

- [ ] **Step 8: Commit.**

```bash
git add vibes.diy/pkg/app/components/MessageList.tsx vibes.diy/pkg/app/components/ChatInterface.tsx
git commit -m "feat(chat-options): render OptionButtons inside TopLevelMsg with onSelectOption"
```

---

## Task 14: Frontend — wire `onSelectOption` from the chat route

**Files:**

- Modify: `vibes.diy/pkg/app/routes/chat/chat.$userHandle.$appSlug.tsx`

- [ ] **Step 1: Define the handler.**

In the route component, just below the existing `const [promptToSend, sendPrompt] = useState<PendingPrompt | null>(null);` line, add:

```ts
const handleSelectOption = useCallback(
  (option: string) => {
    sendPrompt({ text: option, mode: "brainstorm" });
  },
  [sendPrompt]
);
```

- [ ] **Step 2: Pass it to `<ChatInterface>`.**

Find the JSX `<ChatInterface ...>` usage in this file and add `onSelectOption={handleSelectOption}`.

- [ ] **Step 3: Build the package.**

```bash
cd /Users/marcusestes/Websites/vibes.diy/vibes.diy/pkg && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run the existing tests.**

```bash
cd /Users/marcusestes/Websites/vibes.diy/vibes.diy/tests && pnpm test -- --run
```

Expected: same pass/fail as before. Investigate any regressions.

- [ ] **Step 5: Commit.**

```bash
git add vibes.diy/pkg/app/routes/chat/chat.$userHandle.$appSlug.tsx
git commit -m "feat(chat-route): dispatch brainstorm prompt when option clicked"
```

---

## Task 15: Frontend — auto-handoff on `<vibes-brief>`

**Files:**

- Modify: `vibes.diy/pkg/app/routes/chat/chat.$userHandle.$appSlug.tsx`

- [ ] **Step 1: Add a brief-detection effect.**

The chat reducer dispatches `block.end` events that close out a turn. We watch `promptState.running` flipping from `true` to `false` and inspect the most recent assistant message for a `<vibes-brief>` block.

Add this effect immediately after the existing fsId-fetch `useEffect` (the one that ends with `}, [fsId, userHandle, appSlug, vibeDiyApi]);`):

```ts
const lastBriefHandledRef = useRef<string | null>(null);
useEffect(() => {
  if (promptState.running) return;
  const blocks = promptState.blocks;
  if (blocks.length === 0) return;

  // Find the latest assistant TopLevel message text.
  const lastBlock = blocks[blocks.length - 1];
  let collected = "";
  let toplevelStreamId: string | null = null;
  for (const msg of lastBlock.msgs) {
    if (msg.type === "block.toplevel.begin") {
      collected = "";
      toplevelStreamId = msg.streamId;
    } else if (msg.type === "block.toplevel.line") {
      collected += (collected ? "\n" : "") + msg.line;
    }
  }
  if (!toplevelStreamId) return;

  // Only handle each turn once.
  if (lastBriefHandledRef.current === toplevelStreamId) return;

  const match = collected.match(/<vibes-brief>([\s\S]*?)<\/vibes-brief>/);
  if (!match) return;

  const briefBody = match[1].trim();
  if (!briefBody) return;

  lastBriefHandledRef.current = toplevelStreamId;
  sendPrompt({ text: `Build this change:\n\n${briefBody}`, mode: "app" });
}, [promptState.running, promptState.blocks]);
```

- [ ] **Step 2: Verify imports.**

Make sure `useRef`, `useEffect`, and `useCallback` are all imported from `react` at the top of the file (they should be already). No additional imports needed.

- [ ] **Step 3: Build the package.**

```bash
cd /Users/marcusestes/Websites/vibes.diy/vibes.diy/pkg && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run the existing tests.**

```bash
cd /Users/marcusestes/Websites/vibes.diy/vibes.diy/tests && pnpm test -- --run
```

Expected: pass.

- [ ] **Step 5: Commit.**

```bash
git add vibes.diy/pkg/app/routes/chat/chat.$userHandle.$appSlug.tsx
git commit -m "feat(chat-route): auto-handoff to code-gen when brainstorm emits <vibes-brief>"
```

---

## Task 16: API integration test — brainstorm system prompt selection

**Files:**

- Create: `vibes.diy/api/tests/brainstorm-mode.test.ts`

- [ ] **Step 1: Look for an existing test that exercises `prompt-chat-section.ts` and use it as a template.**

```bash
ls /Users/marcusestes/Websites/vibes.diy/vibes.diy/api/tests/ | grep -i 'prompt\|chat'
```

Most likely candidates: `api.test.ts` (broad), `prompt-asset-fetch.test.ts` (asset-fetch only). If the codebase has a higher-fidelity prompt-chat-section integration test, model the new one after it. Otherwise skip the heavy integration test and instead write a focused unit test that asserts the system-prompt selection logic — extract a small `selectSystemPrompt(resChat, …)` pure function in `prompt-chat-section.ts` if one doesn't exist, and unit-test that.

If the existing test patterns are too heavy to mirror, write the smaller version: a vitest test that imports `makeBrainstormSystemPrompt` and `makeBaseSystemPrompt` directly and confirms they produce different system prompts for the same inputs. This is sufficient for V1; the end-to-end test in Task 17 covers wire-level behavior.

- [ ] **Step 2: Write the smaller-form test.**

`vibes.diy/api/tests/brainstorm-mode.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { makeBaseSystemPrompt, makeBrainstormSystemPrompt } from "@vibes.diy/prompts";
import { createMockFetchFromPkgFiles } from "../../../prompts/tests/helpers/load-mock-data.js";

const fetchImpl = createMockFetchFromPkgFiles();
globalThis.fetch = vi.fn(fetchImpl as unknown as typeof fetch);

describe("brainstorm vs code-gen prompt selection", () => {
  it("brainstorm prompt does not contain skill catalog or import statements", async () => {
    const r = await makeBrainstormSystemPrompt("anthropic/claude-opus-4.5", {
      title: "X",
      currentVfs: new Map([["App.jsx", "export default function App() { return null; }"]]),
    });
    expect(r.systemPrompt).toContain("interview assistant");
    expect(r.systemPrompt).not.toContain("import React");
    expect(r.systemPrompt).not.toContain("SEARCH/REPLACE");
  });

  it("code-gen prompt does contain SEARCH/REPLACE rules", async () => {
    const r = await makeBaseSystemPrompt("anthropic/claude-opus-4.5", {
      skills: ["fireproof", "callai"],
      title: "X",
    });
    expect(r.systemPrompt).toContain("SEARCH");
    expect(r.systemPrompt).toContain("REPLACE");
  });

  it("the two prompts differ for the same inputs", async () => {
    const a = await makeBrainstormSystemPrompt("anthropic/claude-opus-4.5", {
      title: "X",
      currentVfs: new Map(),
    });
    const b = await makeBaseSystemPrompt("anthropic/claude-opus-4.5", { skills: ["fireproof"], title: "X" });
    expect(a.systemPrompt).not.toBe(b.systemPrompt);
  });
});
```

- [ ] **Step 3: Run the test.**

```bash
cd /Users/marcusestes/Websites/vibes.diy/vibes.diy/api && pnpm test brainstorm-mode -- --run
```

Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add vibes.diy/api/tests/brainstorm-mode.test.ts
git commit -m "test(api): brainstorm vs code-gen prompt selection"
```

---

## Task 17: End-to-end smoke verification

**Files:** none (manual verification + final pnpm check)

- [ ] **Step 1: Run the full repo check.**

```bash
cd /Users/marcusestes/Websites/vibes.diy && pnpm check
```

Expected: format clean, build green, tests pass, lint clean. Re-run individual failing suites in isolation per `agents/flaky-tests.md` if anything looks transient.

- [ ] **Step 2: Manual sanity — start the dev server and walk the flow.**

Per `CLAUDE.md`: for UI changes, exercise the feature in a browser. Start dev locally (the workspace's documented dev command — refer to `agents/environments.md` for the exact command), then:

1. Open an existing chat where `hasCode === true`.
2. Verify the **Chat** button appears next to **Code** and is enabled.
3. Type a short prompt like "make the empty state nicer" and click **Chat**. Confirm the assistant reply streams in with `▸ ` lines turned into stacked clickable buttons inside the message bubble.
4. Click an option. Confirm the chosen text appears as the next user message and a follow-up assistant reply streams in.
5. Continue until the brief lands. Confirm a second turn (mode `'app'`) auto-fires and code starts streaming.
6. Reload the page. Confirm the interview history renders with disabled buttons; the brief and the code-gen turn are intact.
7. Open a fresh chat with no code. Confirm the Chat button is disabled.

Document any deviation in a follow-up note. UI assertions are visual; if you can't run the dev server in this environment, skip step 2 and explicitly say so when reporting completion (per CLAUDE.md guidance on UI verification).

- [ ] **Step 3: Final commit / no-op.**

If any incidental fixes were made during verification, commit them now with a focused message. Otherwise nothing to commit.

```bash
git status
```

Expected: clean working tree.

---

## Self-Review Notes

**Spec coverage check:**

- §1 New mode `'brainstorm'` → Task 1.
- §2 New asset `system-prompt-brainstorm.md` → Task 2.
- §3 New builder `makeBrainstormSystemPrompt` → Tasks 3–4.
- §4 Backend wiring + recovery skip → Tasks 5–7.
- §5 ChatInput dual-button → Task 9.
- §6 Clickable `▸ ` options → Tasks 11–14.
- §7 Auto-handoff on `<vibes-brief>` → Task 15.
- §8 Persistence → no schema change required; turns ride existing `chatSections`. Verified by Task 17 reload step.
- §9 Edge cases → covered by parser tests (Task 11), empty-VFS test (Task 3), and the manual flow check (Task 17 step 2).
- §10 Testing → Tasks 3, 11, 16; Task 17 covers integration.

**Type consistency check:**

- `'brainstorm'` literal used identically in `PromptLLMStyle`, `reqPromptBrainstormChatSection.mode`, `LLMChat.prompt(opts.mode)`, and `ChatInput.onSubmit`.
- `PendingPrompt = { text: string; mode: 'app' | 'brainstorm' }` consistent across `ChatInput.onSubmit`, the route's `sendPrompt`, the firing effect, and the option-click handler.
- `ReadonlyMap<string, string>` flows from `loadPriorFileSystem` → `priorFs` → `makeBrainstormSystemPrompt({ currentVfs })` consistently.
- `parseOptionLines` returns `{ prose: string; options: readonly string[] }` and is consumed identically in `TopLevelMsg`.

**Placeholder scan:** no TBD/TODO; every step has either explicit code or a concrete shell command. Task 16 step 1 mentions an alternative (extract `selectSystemPrompt`) but step 2 commits to the smaller-form test as the actual deliverable, so there is no unresolved branch.

**Deviation flagged:** Task 6 documents the chatContexts vs applicationChats deviation from the spec. The spec said applicationChats; the route opens with `mode: "chat"` so chatContexts is the correct branch. No code change there beyond extending the error message.
