# Split `vibes-diy chats` into `codegen-log` + `app-chats`

**Status:** proposed — design review
**Date:** 2026-06-28
**Author:** jchris (+ Claude)

## Problem

The published CLI command `vibes-diy chats` is **split-brain**: its two subactions
read two _different and unrelated_ chat systems.

- `chats <vibe>` (LIST) → API `listApplicationChats` → reads **`ApplicationChats`**
- `chats <vibe> <chatId>` and `--response` → API `get-chat-response` /
  `getChatDetails` → reads **`ChatContexts` + `ChatSections`**

Those are not two views of one feature. They are populated by two different
server flows, routed by `mode` in
[`open-chat.ts`](../../../vibes.diy/api/svc/public/open-chat.ts):

```
mode: codegen        → ensureChatId            → ChatContexts (+ ChatSections + PromptContexts)
mode: runtime | img  → ensureApplicationChatId → ApplicationChats
```

### The two domains

|               | **Codegen transcript**                                                                                                        | **App runtime chats**                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Tables        | `ChatContexts` + `ChatSections` + `PromptContexts`                                                                            | `ApplicationChats`                                                                        |
| Written by    | `ensureChatId` (`mode: codegen`)                                                                                              | `ensureApplicationChatId` (`mode: runtime`/`img`)                                         |
| What it is    | the builder↔LLM conversation that **generates/edits the vibe's source**                                                       | conversations that happen **inside the deployed app** (runtime AI chat, in-app image gen) |
| Content model | event-sourced block events in `ChatSections`; `ChatContexts` is a lightweight `chatId → user/app` resolution row (no content) | messages stored **inline** in an `ApplicationChats.blocks` jsonb                          |
| Audience      | **platform devs** debugging the generator                                                                                     | **vibe builders** debugging their app's chat/image data                                   |

### Evidence

- Prod Neon row counts: **`ChatContexts` = 6,916** vs **`ApplicationChats` = 2,232**.
  They are not subset/superset — `ApplicationChats` is a newer, separate feature
  (e.g. `jchris/photo-chat`, created 2026-05-16, predates it).
- `jchris/photo-chat` has a full **codegen** history (`ChatContexts` chatId
  `z3ZWd3wTq6vVN5GC2u`, 4 turns, rendered in the builder chat view) but **zero**
  `ApplicationChats` rows. Result today: `chats jchris/photo-chat` prints
  "(no chats found)", yet `chats jchris/photo-chat z3ZWd3wTq6vVN5GC2u --response`
  reconstructs the entire build transcript. The command lists one feature and
  deep-reads the other.

## Decision

Keep **both** capabilities, expose them as **two distinct commands**, and retire
the overloaded "chat" name on the codegen side (it's a generation transcript, not
a conversation in the product sense). Names (chosen):

- **`vibes-diy codegen-log`** — platform/codegen debug. The build transcript:
  list the codegen chats for a vibe, and deep-read one (prompts, reconstructed
  model output, block events, token usage). This is the existing `--response`
  family.
- **`vibes-diy app-chats`** — builder-facing. The deployed app's runtime in-app
  chats (`ApplicationChats`, inline `blocks`).

This also **fixes the bug by construction**: each command lists and deep-reads
the _same_ table family, so LIST and deep-read stop disagreeing.

## Design

### Server (`vibes.diy/api`)

1. **New handler `list-codegen-chats`** (`svc/public/`): list distinct codegen
   chats for a vibe from `ChatContexts`, keyed by `userId` (+ optional
   `appSlug`/`ownerHandle`), ordered `created desc`, cursor-paginated — mirror
   `list-application-chats.ts` exactly but on the `chatContexts` table. Returns
   `{ chatId, appSlug, ownerHandle, created }`. The `ChatContexts_userId_userSlug_appSlug`
   index already covers the filter.
2. **New types** in `api/types/settings.ts`: `reqListCodegenChats` /
   `resListCodegenChats` (+ item). Shape identical to the ApplicationChats list
   types — the item fields are the same — but distinct type names so the two
   surfaces evolve independently. Register on the api interface + manifest +
   `impl/index.ts`.
3. **Leave `listApplicationChats` and `get-chat-response` untouched.** No
   behavior change to existing handlers — purely additive (per the api-core rule:
   tests-first, additive, no bundled refactor).

### CLI (`vibes-diy/cli`)

Split [`cmds/chats-cmd.ts`](../../../vibes-diy/cli/cmds/chats-cmd.ts) into two
commands sharing the existing render helpers (`chat-response-render.ts`):

- **`codegen-log`**: LIST → new `list-codegen-chats` endpoint; deep-read
  (`<chatId>`, `--response`/`--raw`/`--files`/`--jsonl`/`--user`/`--turn`) →
  existing `get-chat-response`. This is the current command's deep-read behavior,
  now with a LIST that matches it.
- **`app-chats`**: LIST → `listApplicationChats` (today's LIST behavior).
  Deep-read of an `ApplicationChats` row's inline `blocks` is a **follow-up**
  (out of scope for v1 unless trivial) — v1 is LIST only, which is the builder
  debug need.

### Back-compat for the published `chats` command

`vibes-diy chats` is shipped on npm (currently `latest 2.6.9`). Options (pick in
review):

- **(A) Keep `chats` as a thin deprecated alias of `codegen-log`** (its
  deep-read already reads codegen), printing a one-line deprecation notice to
  stderr that points at `codegen-log` + `app-chats`. Its LIST is changed to read
  `ChatContexts` (so the alias becomes self-consistent). Lowest breakage.
- **(B) Remove `chats`**, ship the two new commands. Cleaner, but a breaking CLI
  change.

Recommendation: **(A)** for one release, then remove `chats` in a later major.

## Test plan (TDD, tests first)

- **Server:** unit test `list-codegen-chats` against the existing
  `createVibeDiyTestCtx` harness — seed `ChatContexts` rows for an app, assert
  list + cursor pagination + `appSlug`/`ownerHandle` filtering. Mirror the
  existing `list-application-chats` test. (Reuse infra; no new harness.)
- **CLI:** extend `chats-cmd.test.ts` → `codegen-log` lists from the new endpoint
  and deep-reads via `get-chat-response`; `app-chats` lists from
  `listApplicationChats`. Assert the deprecation notice on `chats` (option A).
- **Regression guard:** a test that a vibe with codegen history but no
  `ApplicationChats` row (the photo-chat shape) is now listed by `codegen-log`
  (would have returned empty under the old `chats`).

## Open questions for review

1. Back-compat: **(A) deprecated alias** vs **(B) remove `chats`**?
2. Should `codegen-log` live under a `debug` namespace (e.g.
   `vibes-diy debug codegen-log`) to signal it's platform-internal, or stay
   top-level alongside `app-chats`?
3. Does `app-chats` need a v1 deep-read (render `ApplicationChats.blocks`), or is
   LIST sufficient for the builder debug use case to start?
4. Type duplication: distinct `*CodegenChats` types vs reusing the
   `*ApplicationChats` item shape with a shared name. (Leaning distinct, per the
   type-hygiene rule — don't overload one envelope for two features.)
