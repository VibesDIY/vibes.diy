# #1667 Post-PR Handoff

**Status as of 2026-05-12**: PR [#1717](https://github.com/VibesDIY/vibes.diy/pull/1717) open, awaiting review. 43 commits on branch `implement-1667-prompt-compaction`, main untouched.

This doc is for whoever picks up review, post-merge verification, or follow-up work. It assumes you've read the PR description on #1717 and want to know what's NOT in there.

## Quick orient

- **What shipped**: domain-aware slot system replaces `CURRENT FILES`-in-system-prompt. See [PR #1717](https://github.com/VibesDIY/vibes.diy/pull/1717) for the architecture summary and phase list.
- **What's open**: T8 (optional pre-existing test-fixture cast cleanup), T9 (#1515 hookTimeout infra — explicitly out of scope; own PR).
- **Plans**:
  - [docs/superpowers/specs/2026-05-12-1667-domain-aware-prompt-compaction-design.md](specs/2026-05-12-1667-domain-aware-prompt-compaction-design.md) — original spec.
  - [docs/superpowers/plans/2026-05-12-1667-prompt-compaction.md](2026-05-12-1667-prompt-compaction.md) — 25-task implementation plan + appended `## Implementation deviations` section (14 deviations recorded at commit `254ce37c`).
  - [docs/superpowers/plans/2026-05-12-1667-handoff.md](2026-05-12-1667-handoff.md) — the mid-work handoff from session 1 → session 2 (historical; described state at commit `827c4f35`).
  - [docs/superpowers/plans/2026-05-12-1667-followup-cleanup.md](2026-05-12-1667-followup-cleanup.md) — 10-task cleanup plan; T1–T7 done, T10 done (PR open), T8 optional, T9 separate PR.

## Branch state at handoff

```
4ddb1d08 fix(api): replace loadPriorFileSystem with loadVersionTimeline across all callers
fe6bad32 docs(agents): clarify that explicit === / !== undefined comparisons are rules-bag-correct
c850d45d docs(agents): parallel-implementer dispatch pattern from #1667 experience
e8fc8d78 refactor(api): rename ReconstructOpts.keepFullTurnPromptId → keepFullTurnStreamId
254ce37c docs(#1667): record plan-vs-implementation deviations
a19a0f35 refactor(cli): align DiskFile.filename to leading-slash convention
f0611e99 docs(#1667): follow-up cleanup plan
e9f66353 refactor(api): unify recovery into a single slot-consuming buildRecoveryRequest
... (35 more, see `git log d8fca0a3..HEAD --oneline` for the full list)
```

Total: 43 commits. Branched off `d8fca0a3` (main HEAD at start of work).

## How to verify

### Targeted (fast)

```bash
cd vibes.diy/api/tests
pnpm vitest run prompt-assembly       # 3/3 — slot interpolation
pnpm vitest run prompt-handler         # 2/2 — handler pipe-through
pnpm vitest run slot-assembler         # 14/14 — slot rendering + canonical-home + assembler
pnpm vitest run slot-env-defaults      # 2/2 — env vs request priority
pnpm vitest run slot-delivery-mode     # 2/2 — user/system delivery shapes
pnpm vitest run last-edit-diff         # 16/16 — diff + render + multi-file
pnpm vitest run version-timeline       # 9/9 — timeline + selectSlotSources + loadLatestPromptId
pnpm vitest run recovery               # 28/28 — unified buildRecoveryRequest
pnpm vitest run reconstruct-messages   # compaction + back-compat
pnpm vitest run inspect-prompt-chat-section  # 3/3 — dry-run regression
pnpm vitest run eval/c7-scaffold-revert     # ORIGINAL caption + breadcrumb
pnpm vitest run eval/slot-delivery-ab       # user/system payload parity
```

```bash
cd vibes-diy
pnpm test disk-drift                   # 4/4 — .undo-absence detection
pnpm test edit-cmd                     # 7/7 — --focus + selected.draft auto-attach
```

### Full suite

```bash
pnpm check
```

**Known caveat**: 30 api-test files fail with `Hook timed out in 10000ms` at `beforeAll` ctx-setup. Same set both runs, all green in isolation. Logged to [#1515](https://github.com/VibesDIY/vibes.diy/issues/1515#issuecomment-4434548721). Infra saturation, not a code regression. T9 of the followup plan covers mitigation as its own PR.

### Manual smoke

Post-merge, sanity-check on a real chat:

1. Open a chat with the CLI, do 3+ edits in a row.
2. Inspect a dry-run payload (any method — `--transcript` flag, server-side `dryRun: true`, etc.).
3. Look for the slot user messages BEFORE the new user turn:
   - `--- ORIGINAL (scaffold — first response, N turns ago) ---`
   - `--- PREVIOUS (current state — anchor SEARCH here; ORIGINAL scaffold is N turns earlier) ---`
   - `--- LAST_EDIT (the diff that produced the current PREVIOUS state) ---` with SEARCH/REPLACE blocks
4. Confirm system prompt does NOT contain `CURRENT FILES (resolved so far this turn):`.

## Wire-format changes prod will observe

What the model sees changes shape:

| Before                                                                           | After                                                                                             |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `[system + base + CURRENT_FILES, user_1, assistant_1_full, user_2, ..., user_N]` | `[system + base, user_1, assistant_1_compacted, ..., assistant_N-1_full, slot_user_1..M, user_N]` |
| Recovery: `[system+addendum+CURRENT_FILES, user, partial-resume?]`               | Recovery: `[system+addendum, original-user, slot-user(RECOVERY_PARTIAL), partial-resume?]`        |

The information content is the same; the framing is more explicit (the model sees `--- PREVIOUS (anchor SEARCH here) ---` instead of having to infer "this is the current state" from CURRENT FILES context).

Model behavior signals that would indicate a regression:

- SEARCH anchors miss more often (slot framing isn't landing) — check `recovery` counter rises.
- ORIGINAL gets ignored in scaffold-revert prompts (C7 scenario) — eval harness catches this.
- Models complaining about "back-to-back system messages" — would mean somewhere we re-introduced a second system message accidentally.

## Architectural decisions worth knowing

### Why slots are user-role by default

Anthropic, OpenAI, OpenRouter relays all accept user-role messages in any position and any quantity. System messages are restricted: many providers reject two of them; some treat the second as a violation. Routing slot content as user messages is universally compatible. The `SLOT_DELIVERY_MODE=system` env override (and `slotDeliveryMode?` arg on `assemblePromptPayload`) lets us A/B against single-system delivery without code change.

### Why `loadVersionTimeline` resolves via `vctx.storage.fetch`

The pre-existing `loadPriorFileSystem` parsed `Apps.fileSystem` as `vibeFile[]` (looking for `f.type === "code-block"`), but `Apps.fileSystem` actually stores `FileSystemItem` refs (`{fileName, mimeType, assetId, assetURI, size}`) — no content field. Real content lives behind `assetURI` (`sql://Assets/...`, `s3://...`, `r2://...`). The old function returned empty maps for all production rows. `loadVersionTimeline` (and its `resolveVfsFromFileSystem` helper) actually fetches via `vctx.storage.fetch(assetURI)` + `stream2uint8array` + `vctx.sthis.txt.decode`. This fix is part of T2 in the followup plan (commit `4ddb1d08`).

### Why `streamId` not `promptId` in `reconstructConversationMessages`

T11 schema discovery: `PromptReq` events expose `streamId`, not `promptId`. T13 verified `promptContexts.promptId === prompt.req.streamId` for any given turn — they're the same value, just named differently across schemas. The `ReconstructOpts` field was originally named `keepFullTurnPromptId`; T3 of the followup plan renamed it to `keepFullTurnStreamId` for honesty (commit `e8fc8d78`).

### Why `selected.draft` files have leading `/`

`DiskFile.filename` from `collectDiskDraft` now always emits `/`-prefixed names. The on-wire `VibeCodeBlock.filename` schema requires leading slash. T20 originally papered over the mismatch in `buildEditPromptRequest` with conditional prepend; T4 of the followup plan aligned the types so the prepend is gone (commit `a19a0f35`). `.undo` files written by older code may store bare names; `collectDiskDraft.sameContent` normalizes that for backward compat.

## What's NOT in scope for this PR

- **#1515 hookTimeout flake mitigation** — separate PR (T9 in the followup plan). The 30 deterministic failures are infra saturation; bumping `hookTimeout` for the api-tests project or reducing `maxWorkers` would mitigate.
- **Pre-existing `as unknown as PromptAndBlockMsgs` test-fixture casts** — T11 noted but didn't introduce them. T8 of the followup plan is optional cleanup.
- **Removing the env-derived path in `slotDeliveryMode`** — currently the arg overrides env, env falls back to `"user"`. Could simplify to arg-only after wider rollout if env knob proves unused.
- **Updating the existing `loadPriorFileSystem` _comment_ references in `version-timeline.ts` and `ensure-push-seeded-chat.ts`** — already updated in T2's commit (`4ddb1d08`).

## Open architectural questions

These came up during implementation, weren't blocking, and the answers may matter post-merge:

1. **Should the slot delivery mode default flip to `system` once the A/B settles?** Currently env-default is `user`. If `system` produces measurably better outputs in eval, change the default. The arg-override means tests don't need the env to flip first.
2. **Should `LAST_EDIT` participate in per-file dedup?** Currently it doesn't (it's a delta, not a snapshot). If model behavior shows it duplicating PREVIOUS bytes for unchanged files, revisit.
3. **`compaction: SlotConfig` env knob unused** — `resolveSlotConfig` has it for completeness, but `reconstructConversationMessages` doesn't honor it yet. Decide whether to wire it (controlled by `keepFullTurnStreamId` undefined) or remove the key.
4. **Should `recoveryAddendum` move out of the system message?** Currently it merges into system. With the slot system carrying file state in user messages, the anti-gaslight directive could equally live as a user message right before the slot. Worth A/B-ing.

## Where to look if something's off

- **Slot rendering wrong**: `vibes.diy/api/svc/intern/slot-assembler.ts` (`renderSlotsWithDedup`, `assembleSlotMessages`) and tests in `vibes.diy/api/tests/slot-assembler.test.ts`.
- **LAST_EDIT diff malformed**: `vibes.diy/api/svc/intern/last-edit-diff.ts` and `vibes.diy/api/tests/last-edit-diff.test.ts`.
- **Compaction not collapsing older turns**: `reconstructConversationMessages` in `vibes.diy/api/svc/public/prompt-chat-section.ts` (~line 605–700) and `vibes.diy/api/tests/reconstruct-messages.test.ts`.
- **Wrong canonical home**: `pickCanonicalHome` in `slot-assembler.ts`, and the caller wiring in `assemblePromptPayload`.
- **Recovery payload shape regression**: `vibes.diy/api/svc/intern/recovery.ts`'s unified `buildRecoveryRequest` + 28 tests in `recovery.test.ts`.
- **`selected.draft` not flowing through**: `vibes-diy/cli/cmds/edit-cmd.ts`'s `buildEditPromptRequest` → `vibes.diy/api/impl/index.ts` forwarding → `vibes.diy/api/svc/public/prompt-chat-section.ts` handler.
- **Env-var defaults not applied**: `resolveSlotConfig` in `slot-assembler.ts` and `slot-env-defaults.test.ts`.

## Agent-facing artifacts

These were added during the work and apply to future agent-driven implementations:

- [agents/rules-bag.md](../../../agents/rules-bag.md) — gained a new section clarifying explicit-comparison patterns (`!== undefined` etc. are correct; `if (!x)` is the forbidden one). Multiple reviewer agents misread this during the work; calibration note prevents repeat.
- [agents/parallel-implementers.md](../../../agents/parallel-implementers.md) — new file documenting the parallel-dispatch pattern that worked on #1667 (file-overlap map, index-lock retry boilerplate, stray-commit-to-main recovery).

## If you're resuming work

- All cleanup that fits this branch landed in commits e9f66353 → 4ddb1d08.
- Don't push more to this branch unless review explicitly asks for changes (mergeability comes from CharlieHelps's `pr-mergeability` daemon + human review).
- For follow-up tasks (T8, T9), open a separate branch off `main` after #1717 merges.
- The original handoff doc ([2026-05-12-1667-handoff.md](2026-05-12-1667-handoff.md)) is historical — useful for context but its action items are all closed.
