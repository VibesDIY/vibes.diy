# Eval: web-generated app → CLI `edit` fidelity

End-to-end runbook for evaluating whether `vibes-diy edit` faithfully preserves a web-generated app on a follow-up turn. Complements [eval-local-dev.md](eval-local-dev.md) (which uses the codegen-edit harness for repeated batches against local dev) — this one is a single, real-environment, mixed-client flow: generate via the chat UI in Chrome, then drive a follow-up via the CLI.

## Why this flow

The CLI `edit` and the web 2nd-prompt go through the same server-side `openChat` + `prompt` path: both look up the chat by appSlug, send only the new user message, and the server rebuilds the LLM history from `ChatSections` via `reconstructConversationMessages`. So this eval also verifies that the cross-client expectation holds — `edit` from CLI should produce results indistinguishable from a 2nd prompt the web user could have sent.

Apps created in the web chat have real assistant-turn history written by the LLM stream — no synthetic seed is involved (cf. [#1667](https://github.com/VibesDIY/vibes.diy/issues/1667) and #1680 for the push-originated case where a seed IS required).

## Preconditions

- `vibes-diy@dev` installed globally: `npm i -g vibes-diy@dev`. Verify with `vibes-diy --help` — `edit` must be listed. If `edit` is missing, the npm `@dev` dist-tag is stale; see [deploy-tags.md](deploy-tags.md) (`pkg@d*` retag).
- Logged in: `vibes-diy user-settings` should print a `UserId` and the user's grants. If not, `vibes-diy login` once.
- Chrome MCP enabled and a Chrome window with a valid `vibes.diy` session (Clerk cookies set). See [chrome-mcp-debug.md](chrome-mcp-debug.md) for session etiquette: never `pkill`, never hit `cli-v2` directly, route via `vibes.diy` + stable-entry.
- Pick a unique `RUN_ID` (e.g. 8-char UUID prefix). Test directories: `/tmp/eval-web-cli-<RUN_ID>/<case-name>`.

## Workflow

### 1. Generate the app via Chrome

Navigate to `https://vibes.diy/chat/prompt?prompt64=<base64-prompt>`. The page kicks off a fresh chat with that prompt. Use `mcp__chrome-devtools__navigate_page` against an existing tab so the session/cookies are preserved (per [chrome-mcp-debug.md](chrome-mcp-debug.md)).

### 2. Wait for the generate to finish

Two signals to watch for, in order of reliability:

- **URL transition**: the chat starts at `/chat/prompt?...`; once the server has bound the appSlug and started streaming, the page navigates to `/chat/<userHandle>/<appSlug>` (or `/chat/<userHandle>/<appSlug>/<fsId>` after the first block.end). Poll with `evaluate_script: () => location.pathname`.
- **Preview iframe**: when streaming completes the preview iframe at `<appSlug>--<userHandle>.vibesdiy.app` (or `.localhost.vibesdiy.net:8888` on dev) loads the actual built app. `wait_for` on a unique text marker from the prompt is more reliable than waiting for a fixed button label.

Use `mcp__chrome-devtools__wait_for` with a generous timeout (90s+). Generation against prod typically takes 30–90s.

### 3. Extract userHandle + appSlug

Read `location.pathname` via `evaluate_script`. Pattern: `/chat/<userHandle>/<appSlug>(/<fsId>)?`. The CLI command only needs `appSlug` (it resolves `userHandle` from your CLI default), but record both — they're needed for the DB inspection step. Also screenshot the chat for the report.

### 4. Run the CLI `edit`

```sh
RUN_ID=<prefix>
CASE=ev1
mkdir -p /tmp/eval-web-cli-$RUN_ID/$CASE-edit && cd $_
vibes-diy edit <appSlug> "<follow-up prompt>" --dir . 2>&1 | tee edit.log
```

If your CLI default userHandle differs from the web account's, pass `--handle <slug>` so `ensureChatId` can find the existing chat.

### 5. Verify

Open `App.jsx` (and any other files). Compare against the original from the chat page — Chrome MCP can `evaluate_script` to read the current `<iframe>`'s document, or screenshot before+after. Score the same axes the codegen-edit eval uses:

- **Constraint honored?** Was the follow-up prompt's hard constraint respected (no new imports, no behavior change, file-X-only, etc.)?
- **Earlier features preserved?** Are the original features from the web prompt still present and wired the same way? Key tell: the Fireproof database name should be unchanged.
- **Files touched as instructed?** Did `edit` only modify the file(s) you asked it to, or did it rewrite everything?

### 6. Cross-check in `db:inspect`

Confirm the chat actually carried context to the LLM rather than starting fresh — `pkg@d2.2.13-dev.1`'s `edit` regressed in our 2026-05-11 eval precisely because the prompt landed on an unseeded chat. For web-generated chats this should never happen (the first turn is real LLM streaming) — but verifying defends against regressions.

```sh
cd /Users/jchris/code/fp/vibes.diy
pnpm --dir vibes.diy/api/svc run db:inspect sql "SELECT chatId, COUNT(*) AS prompts FROM \"PromptContexts\" WHERE chatId IN (SELECT chatId FROM \"ChatContexts\" WHERE appSlug = '<appSlug>')"
```

Expect `prompts >= 2` (one from the initial web generate, one from the CLI edit). If it's 1, the edit's `openChat` failed to find the existing chat — investigate userHandle / appSlug match.

## Pitfalls

- The CLI default userHandle must match the web account's slug. `vibes-diy user-settings` shows the default. If wrong, pass `--handle` explicitly.
- The generate page may briefly render `/chat/prompt?...` before the appSlug binding lands. Don't extract slugs from the URL until you've confirmed the `/chat/<user>/<app>` pattern.
- `vibes-diy edit` opens a fresh chat session each call — there's no client-side conversation state, the server reconstructs from `ChatSections`. This is the same as the web 2nd prompt path.
- For multi-turn evaluation, just call `vibes-diy edit` repeatedly with different follow-ups. Each call appends a `PromptContext` row.

## Reporting shape

Markdown table, one row per follow-up:

| Follow-up | Constraint honored? | Earlier features preserved? | Files touched as instructed? | PromptContexts count | Notes |

Plus a 1–2 sentence verdict: does CLI `edit` against a web-generated app behave the way a web 2nd prompt would? Flag any divergence.
