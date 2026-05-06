# Recovery stream fixtures

Trimmed `block-stream` events from real eval runs that produced apply errors. Each `.jsonl` is one block-stream message per line, in wire order, captured before the recovery orchestrator existed (so the original recovery dispatch was a no-op or 400 — those bytes are intentionally NOT included; we trim through the failed `block.code.end`).

Use these to exercise `streamingResolver.observeBlock` against real model output without depending on a live LLM.

## Fixtures

### `kanban-priority-divider-as-end.jsonl`

Source: `eval/codegen-edit/archive/2026-05-06T14-06-27-893Z_kanban-priority/sections.jsonl`, trimmed through `blockSeq <= 80`.

- 81 events
- Two code blocks: clean (sectionId `z4Dpa19c4jys4WAqbX`) then failing (sectionId `z2EetbmGUgcvJGXWvW`)
- Failed block expected: `divider-as-end` + `orphan-end` → `errorCount: 2`, `reason: "divider-as-end"`
- blockId for both code sections: `zYWhk3nheQLZgcqU1`

### `task-tracker-clean-then-fail.jsonl`

Source: `eval/codegen-edit/archive/2026-05-06T12-27-57-434Z_task-tracker/sections.jsonl`, trimmed through `blockSeq <= 84`.

- 85 events
- Two code blocks: clean (sectionId `zP7mJPsMU6oegMmkN`) then failing (sectionId `z51dXuW9k7tV3meu9x`)
- Failed block expected: `divider-as-end` + `orphan-end` → `errorCount: 2`, `reason: "divider-as-end"`
- Tests "scoped to failing block only" — the clean code.end forwards normally, only the failed one is suppressed and replaced with `block.code.truncated`

## Regenerating

If new captured runs are needed, use the discovery script in
`/Users/jchris/.claude/plans/make-a-plan-to-piped-axolotl.md` Phase B.2:

```sh
for d in $(ls -1 eval/codegen-edit/archive/ | grep -v '^index'); do
  f="eval/codegen-edit/archive/$d/errors.json"
  if [ -s "$f" ]; then
    cnt=$(jq 'length // 0' < "$f")
    if [ "${cnt:-0}" -gt 0 ]; then echo "$d  errors=$cnt"; fi
  fi
done
```

Then trim through the failed `block.code.end`'s blockSeq (look it up via `errors.json`'s `seq` field — note that's the prompt-event seq, not the section blockSeq; you'll need to match by `sectionId`).
