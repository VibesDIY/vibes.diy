# Autoresearch run log — #2602 access-model codegen eval

This branch drives the [`eval/access-model`](../eval/access-model/README.md) autoresearch
loop (issue VibesDIY/vibes.diy#2602): _modify `prompts/pkg/**` → deploy to this PR's
preview env → `generate`/`score`/`report` against it → keep/discard against the composite
PASS/SOFT/FAIL metric behind the 5 verify gates_.

Why a PR preview env: the system prompts under `prompts/pkg/**` are served by the
backend, so each candidate prompt edit only takes effect once it is **deployed**. The
PR-preview workflow rebuilds `pr-{N}-vibes-diy-v2` on every push, so the eval's
`generate` (pointed at the preview API, authed by `VIBES_DEVICE_ID_PREVIEW`) exercises
the candidate prompts. The pinned codegen model is `anthropic/claude-opus-4.8`.

Config + loop discipline: [`agents/access-model-autoresearch.md`](../agents/access-model-autoresearch.md).
Outer-loop runbook: [`agents/autoresearch-outer-loop.md`](../agents/autoresearch-outer-loop.md).

This file is intentionally not part of the assembled system prompt; it exists to document
the run and to trigger the first preview deploy on baseline-identical prompts so the frozen
`baseline.json` is captured against the same env class the candidates run on.
