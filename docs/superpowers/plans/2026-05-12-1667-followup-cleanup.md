# #1667 Follow-up Cleanup Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out the debt accumulated during #1667 implementation — recovery unification (already done), `loadPriorFileSystem` resolution, naming consistency, plan-doc backflow, flake mitigation, PR prep.

**Architecture:** Each task is independent. Most are small (file rename, type fix, doc update). Investigations (T2, T6) come before destructive changes. T1 already landed in e9f66353.

**Tech Stack:** Same as #1667 — TypeScript, vitest, arktype, drizzle, `@adviser/cement` Result.

---

## Task 1: Recovery unification — DONE

Landed in commit `e9f66353`. `buildRecoveryRequest` is now the single recovery entry point; `buildFullRecoveryRequest` and `RecoverySlotInput` are gone; production caller updated; tests rewritten for the new wire format. 28/28 recovery tests green.

No further action — listed here so the plan covers the full debt picture.

---

## Task 2: Investigate `loadPriorFileSystem` — is it still needed?

**Background:** The handoff (`docs/superpowers/plans/2026-05-12-1667-handoff.md`) documents a pre-existing bug: `loadPriorFileSystem` ([prompt-chat-section.ts:156](../../../vibes.diy/api/svc/public/prompt-chat-section.ts#L156)) parses `Apps.fileSystem` as `vibeFile[]` and filters to `f.type === "code-block"`, which silently produces empty maps for all production rows (the actual content lives behind `assetURI` and must be resolved via `vctx.storage.fetch`).

After T13 removed the `CURRENT FILES` system-prompt append, `loadPriorFileSystem` still has three callers:

- [prompt-chat-section.ts:539](../../../vibes.diy/api/svc/public/prompt-chat-section.ts#L539)
- [prompt-chat-section.ts:784](../../../vibes.diy/api/svc/public/prompt-chat-section.ts#L784)
- [prompt-chat-section.ts:1408](../../../vibes.diy/api/svc/public/prompt-chat-section.ts#L1408)

Since the function returns empty maps in production, those callers have been receiving empty data the whole time. Two paths forward.

**Files:**

- Investigate: `vibes.diy/api/svc/public/prompt-chat-section.ts` (the three call sites)
- Investigate: `vibes.diy/api/svc/intern/version-timeline.ts` (`resolveVfsFromFileSystem` is the working pattern)

- [ ] **Step 1: Read each caller's surrounding context**

```bash
sed -n '530,560p' vibes.diy/api/svc/public/prompt-chat-section.ts
sed -n '775,800p' vibes.diy/api/svc/public/prompt-chat-section.ts
sed -n '1395,1420p' vibes.diy/api/svc/public/prompt-chat-section.ts
```

For each, document: what does the caller do with the returned map? If it iterates and uses each `[path, content]` pair, the empty-map bug has been silently breaking that feature. If it only checks `vfs.size === 0` as a presence flag, the bug is benign.

- [ ] **Step 2: Decide per-caller**

For each caller, classify:

- **(a) Function output unused / benign**: remove the call site, kill the function call.
- **(b) Function output needed**: replace `loadPriorFileSystem` with the timeline-resolving pattern from `loadVersionTimeline` + `resolveVfsFromFileSystem` (which actually fetches asset content via `vctx.storage.fetch`).

- [ ] **Step 3: Apply the decision**

If all three callers can be removed: delete `loadPriorFileSystem` entirely and its import. Commit:

```bash
git commit -m "chore(api): drop loadPriorFileSystem — all callers ignored its (silently empty) output"
```

If some need real data: replace with `loadVersionTimeline(...).Ok()` + take the most-recent entry's vfs. Commit:

```bash
git commit -m "fix(api): replace loadPriorFileSystem with timeline-resolving fetch in <caller-name>"
```

- [ ] **Step 4: Verify nothing else regressed**

```bash
cd vibes.diy/api/tests && pnpm vitest run prompt-chat-section
cd vibes.diy/api/tests && pnpm vitest run prompt-assembly
cd vibes.diy/api/tests && pnpm vitest run prompt-handler
cd vibes.diy/api/tests && pnpm vitest run inspect-prompt-chat-section
```

All four suites must stay green.

---

## Task 3: Rename `keepFullTurnPromptId` → `keepFullTurnStreamId`

**Background:** T11 discovered that `PromptReq` events expose `streamId`, not `promptId`. The implementer renamed the internal local variable but left `ReconstructOpts.keepFullTurnPromptId` as the public field name. T13 verified the values are equal (`promptContexts.promptId === prompt.req.streamId` for any given turn), so functionally it works — but the name is misleading.

**Files:**

- Modify: `vibes.diy/api/svc/public/prompt-chat-section.ts` (interface + internal references)
- Modify: `vibes.diy/api/tests/reconstruct-messages.test.ts` (callers in tests)

- [ ] **Step 1: Find all references**

```bash
grep -rn "keepFullTurnPromptId" vibes.diy/ vibes-diy/
```

- [ ] **Step 2: Rename across the codebase**

The field lives on `ReconstructOpts`. Rename the property + all callers:

```ts
// Before
export interface ReconstructOpts {
  readonly keepFullTurnPromptId?: string;
}

// After
export interface ReconstructOpts {
  readonly keepFullTurnStreamId?: string;
}
```

And update the call site inside `assemblePromptPayload`:

```ts
// Before
const conversationMessages = reconstructConversationMessages(allSectionMsgs, {
  keepFullTurnPromptId: latestPromptId,
});

// After
const conversationMessages = reconstructConversationMessages(allSectionMsgs, {
  keepFullTurnStreamId: latestPromptId,
});
```

(`latestPromptId`'s value is the same; only the named parameter changes.)

- [ ] **Step 3: Update tests**

```bash
grep -rln "keepFullTurnPromptId" vibes.diy/api/tests/
```

Rename `keepFullTurnPromptId` → `keepFullTurnStreamId` in each.

- [ ] **Step 4: Run, expect pass**

```
cd vibes.diy/api/tests && pnpm vitest run reconstruct-messages
cd vibes.diy/api/tests && pnpm vitest run prompt-assembly
```

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/public/prompt-chat-section.ts vibes.diy/api/tests/reconstruct-messages.test.ts
git commit -m "refactor(api): rename ReconstructOpts.keepFullTurnPromptId → keepFullTurnStreamId"
```

---

## Task 4: Document `/`-prefix convention for `DiskFile.filename`

**Background:** T20 found that `DiskFile.filename` (`vibes-diy/cli/cmds/disk-drift.ts`) returns bare names like `"App.jsx"`, while the on-wire `VibeCodeBlock.filename` shape used by `selected.draft.files[i]` requires a leading slash (`"/App.jsx"`). T20's `buildEditPromptRequest` helper prepends `/` when constructing the request envelope.

This works but the type contract is unclear. Either:

- (a) Make `DiskFile.filename` always emit the leading slash (compute once at read time).
- (b) Document the convention with a comment on the `DiskFile` interface so the next reader doesn't trip on it.

Option (a) makes the types align cleanly. Pick (a) unless it causes test-fixture churn.

**Files:**

- Modify: `vibes-diy/cli/cmds/disk-drift.ts`
- Modify: `vibes-diy/cli/cmds/disk-drift.test.ts` (test assertions if any reference bare names)
- Modify: `vibes-diy/cli/cmds/edit-cmd.ts` (drop the `/`-prepend in `buildEditPromptRequest` since the source now already prepends)

- [ ] **Step 1: Update `readDiskSourceFiles` to emit `/`-prefixed filenames**

```ts
// vibes-diy/cli/cmds/disk-drift.ts, inside the for-loop:
out.push({
  type: "code-block",
  filename: `/${e.name}`, // leading slash to match on-wire convention
  lang: langOf(e.name),
  content,
});
```

- [ ] **Step 2: Update `isSameContent` to normalize `.undo` entries**

The `.undo` file may have been written without the leading slash. Normalize on read:

```ts
const sameContent =
  validated.length === sourceFiles.length &&
  sourceFiles.every((s) => {
    const candidate = validated.find((u) => u.filename === s.filename || `/${u.filename}` === s.filename);
    return candidate?.content === s.content;
  });
```

- [ ] **Step 3: Update tests if they assert bare names**

```bash
grep -n "filename" vibes-diy/cli/cmds/disk-drift.test.ts
```

Adjust expected values accordingly (`"App.jsx"` → `"/App.jsx"`).

- [ ] **Step 4: Simplify `buildEditPromptRequest`**

Drop the conditional `/`-prepend in [edit-cmd.ts](../../../vibes-diy/cli/cmds/edit-cmd.ts) — `DiskFile.filename` now already has the right shape, so pass through directly.

- [ ] **Step 5: Run tests**

```
cd vibes-diy && pnpm test disk-drift
cd vibes-diy && pnpm test edit-cmd
```

- [ ] **Step 6: Commit**

```bash
git add vibes-diy/cli/cmds/disk-drift.ts vibes-diy/cli/cmds/disk-drift.test.ts vibes-diy/cli/cmds/edit-cmd.ts
git commit -m "refactor(cli): align DiskFile.filename to leading-slash convention"
```

---

## Task 5: Backflow plan-doc deviations into the historical record

**Background:** `docs/superpowers/plans/2026-05-12-1667-prompt-compaction.md` contains the plan as written, but many tasks deviated during implementation. The current state of the codebase is correct; the plan is stale as a reference document. A reader trying to understand "how does the slot system work?" will get confused if they read the plan literally.

Two approaches:

- **Annotate inline**: Add a `> **Implementation note:** ...` callout under each task that deviated.
- **Append a deviations section**: Single section at the end of the plan listing each deviation.

The deviations section is lighter touch and easier to maintain. Pick that.

Known deviations:

- **Task 4** (`selectSlotSources`): plan had `(timeline, _selected: unknown)`; actual is one-arg `(timeline)`. The `_selected` param was dead across the whole plan.
- **Task 10** (`assembleSlotMessages`): plan used `(entries[entries.length-1] as unknown as { __lastEditBody?: string }).__lastEditBody = block` — two casts through `unknown`. Implementation uses a local `lastEditText` variable + canonical-label lookup, no casts.
- **Task 11** (`reconstructConversationMessages`): `PromptReq.streamId` is the discriminator, not `promptId`. Internal variable renamed; public field name (`keepFullTurnPromptId`) kept for now (Task 3 above fixes it).
- **Task 12** (`loadLatestPromptId`): plan returned raw `Promise<string | undefined>`; actual returns `Promise<Result<string | undefined>>` per the DB-I/O rules-bag convention.
- **Task 13** (`assemblePromptPayload` integration): plan called `selectSlotSources(timeline, args.selected)` (two args); fixed to one-arg call. `args.selected.files[i].content as string` cast replaced with discriminator narrowing on `f.type`.
- **Task 14** (`selected:{kind:version}`): plan had `args.selected!.fsId` non-null assertion; replaced with local `sel` variable to narrow without `!`.
- **Task 15** (recovery fold): originally split into two functions to preserve `assistantPartial`/`recoveryAddendum`/`lastReplaceFileLines` features. Task 1 above (DONE) collapses back to one.
- **Task 16** (handler wire): plan asserted `T13 already wired this`; T13 actually didn't pipe `selected`/`slots`/`focusPath` through to the assembler — T16 added the real passthrough.
- **Task 18** (`collectDiskDraft`): plan used `try/catch`, `JSON.parse() as DiskFile[]` cast, `null` returns. All three replaced with `exception2Result`, arktype validation, and `undefined` returns per rules-bag.
- **Task 20** (`buildEditPromptRequest`): plan's `selected.files` direct from `DiskFile` ignored the `/`-prefix mismatch. Helper prepends `/` (Task 4 above resolves cleanly).
- **Task 21** (`SLOT_DELIVERY_MODE`): plan's `return joined ? [...] : []` replaced with explicit `if (joined === "") return [];` per rules-bag.
- **Task 22** (C7 fixture): plan used nonexistent `ctx.seedChat/seedTurn`. Adapted to `createApiTestCtx + appendTurnToChat + ctx.api.openChat`. Also uses `assemblePromptPayload` directly instead of nonexistent `ctx.dryRun` (which T16 actually creates).
- **Task 23** (A/B harness): plan's `ctx.dryRun({ env: ... })` per-call env override doesn't work with `vctx.sthis.env`. Added `slotDeliveryMode?: "user" | "system"` to `AssemblePromptPayloadArgs` so it can be threaded as an arg (env still falls back).
- **Tests across the board**: plan repeatedly references `ctx.seedChat()` / `ctx.seedTurn()` (do not exist). The handoff warned about this; implementations use `appendTurnToChat`.

**Files:**

- Modify: `docs/superpowers/plans/2026-05-12-1667-prompt-compaction.md`

- [ ] **Step 1: Append a "Deviations during implementation" section** at the end of the plan with the bullets above, each linking to its commit SHA.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-05-12-1667-prompt-compaction.md
git commit -m "docs(#1667): record plan-vs-implementation deviations"
```

---

## Task 6: Reviewer-calibration note in `agents/code-quality.md`

**Background:** Two of the spec/quality review subagents flagged `!== undefined` checks as "falsy check violations." That's incorrect: rules-bag forbids `if (!x)` (truthy/falsy coercion) but explicitly endorses explicit comparisons like `if (x === true || x === "")`. `!== undefined` is the canonical explicit form. Multiple agents made the same mistake, which suggests the rules-bag text could be clearer.

**Files:**

- Modify: `agents/code-quality.md` (or `agents/rules-bag.md`)

- [ ] **Step 1: Add an "Explicit comparisons that ARE rules-bag-correct" section** with examples:

```markdown
### Explicit comparisons (NOT falsy checks)

Rules-bag forbids `if (!x)` (truthy/falsy coercion). It does NOT forbid
explicit value comparisons. The following are all correct:

- `if (x === undefined)`
- `if (x !== undefined)`
- `if (x === false)`
- `if (x.length === 0)`
- `if (idx >= 0)`
- `if (result.isOk() === false)`

What rules-bag flags is the type-ambiguous shortcut: `if (!x)` collapses
multiple possible "falsy" states (undefined, null, 0, "", false) into one
branch, hiding which state you actually meant. The explicit forms above
declare the intent.
```

- [ ] **Step 2: Commit**

```bash
git add agents/code-quality.md
git commit -m "docs(agents): clarify that explicit !== undefined is rules-bag-correct"
```

---

## Task 7: Document the parallel-implementer pattern

**Background:** The `superpowers:subagent-driven-development` skill says "Never dispatch multiple implementation subagents in parallel (conflicts)." The user explicitly overrode this for #1667, and parallel implementation worked with two caveats:

1. Implementers must touch non-overlapping files (verified by re-reading "Files:" in each task before dispatch).
2. Concurrent commits can race the `.git/.../index.lock`; the agent prompt includes a "wait 5s and retry once" instruction.

This pattern saved meaningful wall-clock time on #1667. Worth documenting so future plans can use it.

**Files:**

- Create: `agents/parallel-implementers.md` (or merge into existing agents/ file)

- [ ] **Step 1: Write the pattern**

Include:

- When to use (independent files, multiple eligible tasks)
- File-overlap check before dispatch
- Per-prompt git-lock retry boilerplate
- How to recover from a stray commit landing on `main` (cherry-pick to worktree, reset main)
- Caveat: reviewers are always parallel-safe (read-only) regardless

- [ ] **Step 2: Commit**

```bash
git add agents/parallel-implementers.md
git commit -m "docs(agents): pattern for parallel implementer dispatch"
```

---

## Task 8: Pre-existing test-fixture cast cleanup (optional, low priority)

**Background:** T11's implementer noted `as unknown as PromptAndBlockMsgs` casts in test factory helpers (`vibes.diy/api/tests/*-test-helpers.ts` and similar). These are pre-existing — not introduced by #1667 — but flagged for future cleanup since rules-bag prefers no casts.

**Files (investigate):**

```bash
grep -rln "as unknown as PromptAndBlockMsgs" vibes.diy/api/tests/
```

- [ ] **Step 1: List the casts and the helpers that use them**

- [ ] **Step 2: For each, evaluate whether arktype's `type({...})` could replace the cast**

If the cast is at a test-only fixture boundary, arktype validation at construction time is the cleanest replacement. If it's at a deeper helper used in production code paths, more care.

- [ ] **Step 3: Apply where cheap; skip where expensive**

This task is **optional** — don't block PR merge on it.

- [ ] **Step 4: Commit (if anything changed)**

```bash
git commit -m "chore(tests): drop pre-existing as-unknown-as casts where arktype suffices"
```

---

## Task 9: Investigate #1515 flake — api-tests hookTimeout under parallel load

**Background:** `pnpm check` runs all 170 test files in parallel. 30 api-test files consistently fail (same set across runs) with `Error: Hook timed out in 10000ms.` at the `beforeAll` / `beforeEach` ctx-setup line. All affected tests pass in isolation. Posted to [#1515](https://github.com/VibesDIY/vibes.diy/issues/1515#issuecomment-4434548721).

This is **infra**, not code. The branch's task tests are correct; the deterministic-30 failures are a parallel-load saturation issue in the api-tests project.

**Files (investigate):**

- `vibes.diy/api/tests/vitest.config.ts` — current project config
- Root `vitest.config.ts` — workspace config

- [ ] **Step 1: Reproduce in isolation**

```bash
cd vibes.diy/api/tests && pnpm vitest run
```

Does it pass in isolation? If yes, the issue is specifically parallel-load across the workspace.

- [ ] **Step 2: Try mitigations one at a time**

In order of lightest-touch:

- (a) Bump `hookTimeout` for the api-tests project from default 10s → 30s.
- (b) Lower `maxWorkers` for the api-tests project (currently default).
- (c) Add a `sequence.groupOrder` so api-tests run in their own group, not interleaved with vibes.diy chromium tests.

Try (a) first. Re-run `pnpm check`. If still failing on the same 30, try (b). Etc.

- [ ] **Step 3: If a fix works, commit it on its own branch (NOT this one)**

Infrastructure changes belong in their own PR. Commit message:

```bash
git commit -m "fix(test-infra): bump api-tests hookTimeout to 30s to ride out parallel-load setup spikes"
```

Then push and open PR with the #1515 context. Reference the comment URL.

This task is **out of scope** for the #1667 branch — break it out before merge.

---

## Task 10: PR prep

**Background:** Branch `implement-1667-prompt-compaction` is feature-complete. Need to push and open the PR.

**Files:** N/A (git/gh operations)

- [ ] **Step 1: Push the branch**

```bash
git push -u origin implement-1667-prompt-compaction
```

- [ ] **Step 2: Draft PR description**

The PR description should cover:

- One-line summary
- Architecture (slot-based prompt assembly replacing CURRENT-FILES-in-system)
- Phases (one bullet per major phase: types, last-edit diff, slot assembler, compaction, integration, recovery, CLI, env config, eval scenarios, cleanup)
- Wire-format changes that prod will observe (CURRENT FILES moves to user role; new ORIGINAL / LAST_EDIT / PREVIOUS / RECOVERY_PARTIAL / SELECTED_DRAFT / SELECTED_VERSION slot framing)
- Known follow-ups (link back to this plan doc)
- Test status: 28/28 recovery, 3/3 prompt-assembly, 2/2 prompt-handler, 14/14 slot-assembler, plus #1515 flake note
- Eval scenarios that need follow-up live-LLM validation post-merge

- [ ] **Step 3: Open the PR**

```bash
gh pr create --base main --head implement-1667-prompt-compaction --title "feat(#1667): domain-aware prompt compaction with named slots" --body "$(cat <<'EOF'
## Summary

Replaces the static `CURRENT FILES`-in-system-prompt block with a domain-aware
slot system: `ORIGINAL`, `LAST_EDIT`, `PREVIOUS`, `RECOVERY_PARTIAL`,
`SELECTED_DRAFT`, `SELECTED_VERSION`. Each slot is a user-role message
interpolated between conversation history and the new user turn. The system
prompt no longer carries file content.

Closes #1667.

## Architecture

- **Slots are user messages** carrying labeled file state. The model sees
  explicit framing (`--- PREVIOUS (current state — anchor SEARCH here) ---`)
  instead of having to infer "this is the current state" from context.
- **Canonical home** for SEARCH anchors: `recovery > selected.draft > previous`.
  Recovery turns route `RECOVERY_PARTIAL` as canonical; CLI drift routes
  `SELECTED_DRAFT`; everything else falls through to `PREVIOUS`.
- **Compaction**: older turns' code blocks compact to `[Created App.jsx —
  N lines, M bytes]` or `[N-line edit to App.jsx]` summaries; the kept turn
  (latest persisted) retains full body.
- **Per-deployment mute** via `SLOTS_*` env vars; per-request override via
  `req.slots`. `SLOT_DELIVERY_MODE=system` renders all slots as a single
  system message for the pre-merge A/B parity test.

## Test plan

- [x] `prompt-assembly` 3-turn + selected.version: green
- [x] `prompt-handler` slot pipe-through: green
- [x] `slot-assembler` 14 unit tests: green
- [x] `slot-env-defaults` request-vs-env: green
- [x] `slot-delivery-mode` user/system render: green
- [x] `eval/c7-scaffold-revert` 16-turn ORIGINAL breadcrumb: green
- [x] `eval/slot-delivery-ab` user-vs-system parity: green
- [x] `recovery` 28 tests after unification: green
- [x] `last-edit-diff` 16 tests: green
- [x] `version-timeline` 9 tests: green
- [x] `disk-drift` 4 tests: green
- [x] `edit-cmd` --focus + selected.draft auto-attach: green
- [x] `reconstruct-messages` compaction + back-compat: green
- [x] `inspect-prompt-chat-section` regression: green
- [x] full `pnpm check` — build/lint green; 30 api-tests hit #1515 hookTimeout flake under parallel load (all pass in isolation)

## Follow-ups

See [docs/superpowers/plans/2026-05-12-1667-followup-cleanup.md](docs/superpowers/plans/2026-05-12-1667-followup-cleanup.md) for the cleanup queue:

- T2: `loadPriorFileSystem` callers — investigate vs. remove
- T3: rename `keepFullTurnPromptId` → `keepFullTurnStreamId`
- T4: align `DiskFile.filename` `/`-prefix convention
- T5: backflow plan-vs-implementation deviations into the plan doc
- T6: reviewer-calibration note on `!== undefined` vs falsy
- T7: document parallel-implementer pattern in `agents/`
- T9: investigate #1515 hookTimeout (out of scope; own PR)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Return the PR URL**

---

## Execution order

T1 is already done. Recommended order for the rest:

1. **T2** (loadPriorFileSystem investigation) — clarifies what's actually unused
2. **T3** (rename) + **T4** (filename convention) — small mechanical refactors, can parallelize
3. **T5** (plan doc backflow) — pure docs, can run anytime
4. **T6** + **T7** (agents/ docs) — pure docs
5. **T8** (test-fixture casts) — optional, do or defer
6. **T9** (flake infra) — own PR; out of scope for this branch
7. **T10** (PR prep) — when everything else lands

T2–T8 can probably all land on this same branch before PR. T9 is its own thing.

---

## Self-review

- Every task has files listed, steps with executable content, and a commit at the end.
- No "TBD" or placeholder text.
- T1 marked as DONE so the plan accurately reflects state.
- T9 (flake infra) flagged as out-of-scope to prevent scope creep.
- T8 (pre-existing casts) flagged as optional.
- Types referenced (`ReconstructOpts`, `DiskFile`, `AssemblePromptPayloadArgs`) all exist in the current codebase; no imagined symbols.
