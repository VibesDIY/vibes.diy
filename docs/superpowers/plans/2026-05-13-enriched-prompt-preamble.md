# Enriched-prompt preamble from pre-allocation

## Why

The pre-allocation LLM call already runs once per new chat to pick skills, propose title pairs, an icon, and a theme — so it has the user prompt in hand and an LLM cycle to spend. We're underusing it.

Generated apps drop core platform features (`can("write")`, `useFireproof` live queries, `callAI`, `ImgGen`) because:

- The system prompt is a long bullet list of rules, easy for the model to skim past.
- The seed prompts read as single-user ("Build a task tracker"), so the model has no signal that sharing, identity, AI tagging, or generated imagery should land.

The fix is to have the pre-alloc call synthesize a **3-sentence enriched preamble** that names — for this specific app — how the core features should manifest: which docs are written, who can see/edit them, where callAI fits, whether ImgGen makes sense. The model then sees the rules **applied to its actual app** before generating, not as abstract guidance.

## The change

### 1. Extend the pre-alloc schema (`prompts/pkg/prompts.ts`)

Add `enrichedPrompt: string` to `preAllocSchema` and `preAllocParsed`. Description (in the schema, the model reads it):

> A 3-sentence preamble that grounds the build in our core platform features for THIS specific app. Sentence 1: what gets written to Fireproof and how it's shared between viewers (one doc-shape per persisted thing, who writes it, who reads it). Sentence 2: where callAI fits (which user action triggers an AI call, what JSON shape comes back, what gets saved). Sentence 3: whether ImgGen is part of the experience and what it depicts — or `useViewer.can("write")` gating if no images. Be concrete: name specific fields, named buttons, and the specific multi-user behavior. Never abstract.

Update `makePreAllocUserMessage` to instruct the model to fill `enrichedPrompt` with workflow-specific synthesis, not a paraphrase.

### 2. Persist as `active.enriched-prompt`

Add to `vibes.diy/api/types/invite.ts` (the active-entries module — co-located with `ActiveTitle`, `ActiveSkills`, etc.):

```ts
export const ActiveEnrichedPrompt = type({
  type: "'active.enriched-prompt'",
  enrichedPrompt: "string",
});
```

`ensureAppMetadata` already writes the other `active.*` entries from pre-alloc; add this one alongside. Same idempotency guard (`isActiveTitle` presence skips the whole pre-alloc) keeps it free on re-pushes.

### 3. Thread through to the system prompt

- `loadActiveSettings` in `vibes.diy/api/svc/public/prompt-chat-section.ts` already returns `{ skills, theme, title }` — extend to `{ skills, theme, title, enrichedPrompt }`.
- `makeBaseSystemPrompt` options gain `enrichedPrompt?: string`.
- Templates `prompts/pkg/system-prompt.md` and `system-prompt-initial.md` get a new `{{ENRICHED_PROMPT}}` placeholder, positioned **right before** `{{USER_PROMPT}}` in the title section. When absent the placeholder collapses to empty (same pattern as `{{TITLE_SECTION}}`).

The placement matters: the preamble lands inside the per-app context block, **after** the rules and the user prompt, so the model reads "here are the rules → here's the user's ask → here's how the rules apply to this specific ask → now build."

Wrap it with a clearly named tag so the model can refer to it: `<app-workflow>…</app-workflow>`. Tagged blocks generally score higher attention than loose preamble text.

### 4. Backwards compatibility

Old `app_settings` rows have no `active.enriched-prompt`. `loadActiveSettings` returns `undefined`, the placeholder collapses, the prompt is identical to today. Re-pushes of an existing app stay idempotent on `active.title` presence — they don't regenerate the enriched prompt, which is fine. New chats get it.

## Eval plan

Same 5-prompt batch (`task-tracker kanban-priority recipe-book journal-sentiment bookmarks`) against the dev server in this worktree.

**Metrics** — grep `archive/<run>/resolved/App.jsx` for each:

- `useViewer` import present
- `can("write"` call present
- `useFireproof` + `useLiveQuery` present
- `callAI(` present
- `<ImgGen` present (when relevant — flag-only)

**Target**: ≥80% of generated apps include both `useViewer` and `can("write"`, plus the skills the pre-alloc selected are actually used. The prior fix (adding `use-viewer` to `getDefaultSkills`) ensures the import + docs land in every prompt; the enriched preamble is what pushes the model to **actually call it**.

Iterate by tightening the schema description — first round is just "give me 3 sentences"; if the model dodges multi-user concerns, mention "if the app could conceivably be shared with another viewer, sentence 3 must name what `can("write")` gates."

## Open questions / things to confirm

- The pre-alloc call has an 8s timeout. Adding one more string field to the output schema costs ~50–200 tokens of generation — well within budget but worth measuring once.
- Where to surface the enriched prompt to the _user_ (chat panel? hidden?). For v1 it's invisible — just goes into the system prompt. UI exposure can come later.
- Should re-pushes re-run pre-alloc to backfill `enriched-prompt` on old apps? No, not for v1. Old apps work without it.

## Out of scope

- Editing the existing system prompt rules to be shorter. The enriched preamble is the lever; rule trimming is a separate effort if measurements show the rule list itself is the ceiling.
- Streaming the enriched prompt back to the chat UI as a "here's the plan" message. Tempting but mixes pre-alloc into the user-visible turn — defer.
