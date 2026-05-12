# Domain-aware prompt compaction with named slots

Date: 2026-05-12
Status: Design approved, plan pending
Issue: VibesDIY/vibes.diy#1667
Precursor: VibesDIY/vibes.diy#1696 (dry-run inspection — merged-pending)

## Motivation

Per-turn prompts grow monotonically across a chat session because every follow-up turn carries the full prior conversation plus the full filesystem. After ~20 turns the per-call prompt can be an order of magnitude larger than the first call. The completions stay short; the prompts climb into the hundreds of thousands of tokens. The model rarely needs the entire intermediate history to make the next edit — it needs the scaffold, the latest state, the most recent change, and (when present) whatever version the user is referencing right now.

#1690 partially addressed this by appending `CURRENT FILES` to the continuation system prompt. That fixed the silent-no-op failure mode (model emitting SEARCH against an imagined file shape) by giving the model resolved bytes on the first attempt. But #1690 only added; it did not evict, so today's prompts are slightly larger than before it landed. The token win in this issue comes from eviction plus better positioning of the file-state surface.

The #1667 OP also surfaced a separate but adjacent bug: chats seeded only by `vibes-diy push` have zero `PromptContexts` history, so the follow-up turn ships with no prior assistant turn at all and the model rewrites the app from scratch. This design closes that hole via the `selected` slot's `draft` variant.

## High-level design

Replace today's continuation assembly (system prompt with appended CURRENT FILES, plus reconstructed conversation history with full SEARCH/REPLACE bodies) with:

1. **Four named slots** delivered as synthetic `role: "user"` messages, interpolated at chronologically natural positions in the conversation.
2. **Older-turn compaction** that preserves narration but replaces fenced code-block bodies with one-line summaries.
3. **Recovery unified** as a slot consumer so there is one assembly path, not two.

No DB schema changes. Existing chats load unchanged; compaction only affects outbound `messages` assembly.

## Slot set

```
[original, selected?, last_edit?, previous]
```

| Slot        | Source                                                  | Always present?                                       | Render                                |
| ----------- | ------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------- |
| `original`  | fsId of first persisted assistant turn (scaffold)       | After ≥1 persisted turn                               | Full file bytes                       |
| `selected`  | Wire field on request (see below)                       | When user is viewing/drafting a non-canonical version | Full file bytes, with collision rules |
| `last_edit` | Algorithmic diff between `prev2_vfs` and `previous_vfs` | When ≥2 distinct fsIds exist                          | SEARCH/REPLACE delta                  |
| `previous`  | Newest persisted fsId (today's `loadPriorFileSystem`)   | Always on continuations                               | Full file bytes — canonical home      |

`final` collapses away: once file state is interpolated chronologically, "previous" _is_ the current bytes, and there is no separate `final` until the model produces one.

### `selected` wire shape

```ts
selected?:
  | { kind: "version"; fsId: string }     // UI: user pinned a historical version
  | { kind: "draft"; files: VfsMap }      // CLI: on-disk drift detected via .undo
```

- **Web UI** passes `{kind: "version", fsId}` when the user is actively viewing a non-current version.
- **CLI** reads disk vs `.undo` baseline; if they differ, packages disk content into `{kind: "draft", files}` and includes it on the request.
- Captions differ: version variant says "user is currently viewing this (N turns ago)"; draft variant says "current disk contents — may or may not be intended."

### Collision and dedup rules

- **Timeline dedup by fsId**: turns that produced no file change do not count as distinct versions. `prev2_vfs` is the fsId-deduped predecessor of `previous_vfs`.
- **Render-level dedup by per-file content hash**: PREVIOUS is canonical. For each file in an older snapshot slot (`original`, `selected.*`) whose content hash matches the same path in PREVIOUS, emit `--- App.jsx (identical to PREVIOUS) ---` instead of repeating bytes. `last_edit` does **not** participate in this dedup — it is a delta, not a snapshot, so there is nothing to pointer.
- **Template files unchanged through history** appear only in PREVIOUS. ORIGINAL doesn't pointer back to them — PREVIOUS already covers ground truth.
- **Files dropped before PREVIOUS** appear full-bytes only in ORIGINAL (and other slots that still contained them).
- **`selected` collision**: if `selected` resolves to one of `original`/`previous`, no extra slot — annotate the matching slot with `(currently viewed)` or `(on-disk draft)`.

## Placement: interpolated, not jammed into system prompt

```
system    : base + skills              (no CURRENT FILES — supersedes #1690's placement)
user_1
assistant_1                            (compressed: narration verbatim, blocks summarised)
[synthetic user] --- ORIGINAL FILES (state after your first response) ---
user_2
assistant_2                            (compressed)
…
user_{N-1}
assistant_{N-1}                        (compressed)
[synthetic user] --- SELECTED / ON-DISK DRAFT --- (optional)
[synthetic user] --- LAST EDIT (the diff that produced PREVIOUS) ---
[synthetic user] --- PREVIOUS FILES (current state — anchor SEARCH here) ---
user_N
→ model composes
```

`last_edit` sits immediately before `previous` so the model reads "here's what changed → here's where it landed" without intervening content. The slot block is delivered as a `role: "user"` message with a header that identifies its kind unambiguously.

### Why synthetic user, not system

The conversation timeline gives chronologically natural anchoring. A mid-conversation system message would lose that ordering and risk silent provider-side demotion (some LLM APIs collapse multi-system messages or move them to the front).

The risk is attention competition: a `role: "user"` message immediately before `user_N` could be misread by the model as the question. The pre-merge eval gate (below) addresses that head-on.

## Compaction of older turns

Lives in `reconstructConversationMessages`. Add `opts: { keepFullTurnPromptId?: string }`. The function walks the event stream as today; for blocks whose `promptId !== keepFullTurnPromptId`:

- **Narration (toplevel lines)**: keep verbatim. Short, valuable for stylistic continuity ("Paint the page with the Hearth Sim gradient" tells the model the design language without re-shipping bytes).
- **Code blocks (`block.code.begin … block.code.end`)**: replace with a summary line. Detection is structural, no body parse:
  - First non-blank line of the body equals `<<<<<<< SEARCH` → edit. Summary: `[N-line edit to App.jsx]` where N is the count of `block.code.line` events in the block.
  - Otherwise → create. Summary: `[Created App.jsx — 141 lines, 7554 bytes]` from `block.end.stats`.
- **Other event types**: passed through as today.

The most recent turn (`keepFullTurnPromptId` = latest `prompt.req.promptId`) is passed through verbatim. User messages are always verbatim.

## `last_edit` generation algorithm

Compute at slot-assembly time:

1. **Line-diff** `prev2_vfs[path]` vs `previous_vfs[path]` using Myers / patience diff (any standard implementation).
2. **Coalesce** adjacent hunks separated by ≤3 unchanged lines into one block (standard `diff -U3` behavior).
3. For each coalesced hunk, build `SEARCH` = (context + old content), `REPLACE` = (context + new content).
4. **Verify SEARCH is unique** in `prev2_vfs[path]`. If not, expand context one line at a time. Cap expansion at 20 lines.
5. **Degrade**: if expansion hits cap without uniqueness, or the file produces >20 hunks, emit `[App.jsx: wholesale rewrite, see PREVIOUS]` for that file only. Other files in the same turn keep their hunks.

Special cases:

- File in `prev2` only (deleted): `[DELETED: filename]`. No bytes.
- File in `previous` only (newly created): `[NEW FILE: filename — see PREVIOUS]`. No duplication, since PREVIOUS already carries the bytes.
- File identical in both: skip entirely.

Approximate size: ~100 LOC including LCS implementation. Pure function, easily unit-testable in isolation.

### Why SEARCH/REPLACE, not unified diff

- Native to our edit pipeline — primes the model to emit the same shape on its next turn.
- Anchor-based: self-locating without line numbers, resilient to context drift between turns.
- Same parser path on both sides — no new format to support, the model already produces this grammar on output.

## Recovery unification

Today's `buildRecoveryRequest` merges `CURRENT FILES` into the system prompt at recovery time. If continuation moves to synthetic-user slot delivery and recovery stays as-is, we have two ground-truth sources during recovery turns and two assembly paths to maintain.

Fold recovery into the slot assembler:

- Add slot variant `{ kind: "recovery-partial"; files: VfsMap; focusPath: string }`.
- `buildRecoveryRequest` becomes a thin wrapper that adds this slot variant to the assembled payload rather than emitting its own system-prompt merge.
- During recovery turns, `recovery-partial` becomes the canonical-home slot (instead of PREVIOUS), because it carries the most authoritative bytes (the in-flight resolver's running vfs).
- The recovery suffix (anti-gaslight directive: "verify your partial against CURRENT FILES; anchor SEARCH against text that appears there") **stays in the system prompt** where it is now. That text is instruction, not file state, and does not suffer from the double-source problem.

Result: one assembly pipeline, five slot variants (`original`, `selected.version`, `selected.draft`, `last_edit`, `previous`) plus the recovery-only `recovery-partial`, one canonical-home rule that swaps from `previous` to `recovery-partial` only during recovery turns.

## Budget

No new caps. Each slot renders through existing `renderCurrentFiles` (16 KB/file, 32 KB total per slot). Per-slot, no cross-slot truncation, no shared pool. Adding limiters before we have measurement is premature; the dedup rules above already keep the common case small.

## CLI surface additions

- `vibes-diy edit "<prompt>" --focus <path>` — sets the slot-rendering `focusPath` for this request so multi-file edits anchor on the right file. Default stays `App.jsx`.
- `vibes-diy generate --dry-run --focus <path>` — same flag, same semantics.
- The CLI reads disk vs `.undo` baseline before sending a continuation; if they differ, packages disk content into `selected: { kind: "draft", files }`.

## Pre-merge eval gate

The single biggest open question is **synthetic-user vs mid-conversation system** for slot delivery. Both are reasonable; the right answer depends on model behavior we cannot predict from the design alone.

Acceptance gate:

> Run the C1–C6 fidelity scenarios from [the OP comment](https://github.com/VibesDIY/vibes.diy/issues/1667#issuecomment-4423934079) twice — once with slot blocks delivered as synthetic `role: "user"` messages, once as a single mid-conversation `role: "system"` message — against the same dry-run-captured baseline (via #1696). If the user-role variant shows >5% degradation on any individual scenario or >2% in aggregate, the design flips to system-message delivery despite the chronological awkwardness.

This is the only gate. Other behavior (byte reduction, recovery exhaustion, fidelity on continuation chats) is measured post-merge against real traffic; we do not gate on hypothetical numbers.

## Backwards compatibility

- **No DB schema changes**.
- Existing chats load unchanged. Compaction only affects outbound `messages` assembly; nothing about what is persisted changes.
- #1690's CURRENT-FILES-in-system-prompt block is removed — superseded by the `previous` slot in the conversation timeline. Old chats benefit immediately from the new code because the same `PromptContexts`/`apps.fileSystem` rows are read.
- The push-seeded chat path (#1680 / `ensure-push-seeded-chat`) continues to work. `original` is filled from the synthetic push-time turn. `selected.draft` is what closes the residual hole when the CLI's on-disk content has drifted from the seeded state.

## Out of scope

- **Significance tagging UI** and the `version_significance` table — defer until evals show a need for user-pinned mid-history slots.
- **`mid-A` / `mid-B` slots** — defer for the same reason. If we need more trajectory, `last_edit_-2`, `last_edit_-3` (more diff slots, not snapshot slots) is the natural extension because diffs scale with edit surface, not file size.
- **Fork-history feature** — selection is reference-only; edits always anchor `previous`.
- **Conversation prose compaction** — separate concern from file-version history.
- **Recovery-turn dry-run** — only attempt #1 payload is exposed today.

## Sequencing

1. **#1696** — dry-run + assembly/dispatch split. Merged-pending. Provides the measurement surface for everything below.
2. **This issue (#1667)** — single PR covering:
   - Slot assembler that takes `Array<{label, caption, vfs, focusPath?}>` and renders each through `renderCurrentFiles`.
   - Slot interpolation in `injectSystemPrompt` (or its successor).
   - `reconstructConversationMessages` compaction via `keepFullTurnPromptId`.
   - `last_edit` generator (pure module).
   - Recovery unified as a slot consumer.
   - `--focus` CLI flag on `edit` and `generate --dry-run`.
   - CLI on-disk-drift detection wiring `selected.draft`.
3. **Pre-merge gate**: C1–C6 A/B via #1696's dry-run, two variants of slot delivery role.
4. **Post-merge**: measure byte reduction, recovery exhaustion rate, edit fidelity against the recorded C1–C6 baseline.

## Files likely touched

- [vibes.diy/api/svc/public/prompt-chat-section.ts](vibes.diy/api/svc/public/prompt-chat-section.ts) — `injectSystemPrompt` becomes slot-aware; `reconstructConversationMessages` gains `keepFullTurnPromptId` option.
- [vibes.diy/api/svc/intern/recovery.ts](vibes.diy/api/svc/intern/recovery.ts) — `renderCurrentFiles` generalizes to take a list of slot entries; `buildRecoveryRequest` becomes a slot consumer.
- New file under `vibes.diy/api/svc/intern/` (or peer): `last-edit-diff.ts` — pure SEARCH/REPLACE generator.
- New file: `slot-assembler.ts` — owns the slot ordering and rendering rules.
- `protocol` module — `selected` wire shape additions, `--focus` propagation through the prompt request envelope.
- `vibes-diy/cli/cmds/edit-cmd.ts` and `generate-cmd.ts` — `--focus` flag, `.undo` drift detection.
- Tests under `vibes.diy/api/tests/` — slot assembly, last-edit diff generation, compaction, recovery slot consumption.

## Open coordination questions

1. The `prompt-chat-section` refactor (split assembly from dispatch, plus the slot-aware rewrite) is the biggest behavioral change in the file. Confirm no in-flight work on the same module before opening the PR.
2. `selected` wire shape is new on the protocol surface — coordinate with @mabels for the type-shape review.
