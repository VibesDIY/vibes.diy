# `@vibes.diy/eval-codegen-edit`

Archive CLI generation streams to disk and analyze edit-apply failures.

See [PLAN.md](./PLAN.md) for design rationale and roadmap.

## Quick start

```sh
# Single run against the seed prompt
pnpm -F @vibes.diy/eval-codegen-edit run -- task-tracker

# Batch over all seed prompts
pnpm -F @vibes.diy/eval-codegen-edit batch
```

Each run lands under `archive/<timestamp>_<slug>/`. The load-bearing artifact
is `sections.jsonl` — every other file (resolved code, errors) is derived
and re-creatable via `replay`.

## Auth

Re-uses your existing `vibes-diy` CLI login. All runs publish under the
`eval` user slug — make sure your account has access. Override with
`--user-slug <slug>` if needed.
