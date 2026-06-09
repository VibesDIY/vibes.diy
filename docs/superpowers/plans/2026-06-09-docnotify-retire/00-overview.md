# DocNotify retirement — chain overview

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Each chain step is its own plan file in this directory; execute them in order, with a **deploy + verify** gate between them.

**Goal:** Remove the dead `DocNotify` Durable Object from every environment without breaking a Cloudflare deploy.

**Spec:** [../../specs/2026-06-09-docnotify-retire-design.md](../../specs/2026-06-09-docnotify-retire-design.md)

**Tracking issues:** #2265 (item 1), #2264 (parent cleanup).

## The chain

Each step is a separate PR with its own file. **A deploy + dry-run gate sits between them** — Step B must not deploy until Step A is live, or Cloudflare returns error 10061 (cannot delete a class while a binding references it).

| Order | File                                                       | PR                | Deploys                         | Gate before next                   |
| ----- | ---------------------------------------------------------- | ----------------- | ------------------------------- | ---------------------------------- |
| 1     | [01-step-a-cli-unbind.md](01-step-a-cli-unbind.md)         | A: cli unbinding  | `vibes-diy-v2-cli`              | cli live + dry-run clean           |
| 2     | [02-step-b-class-deletion.md](02-step-b-class-deletion.md) | B: class deletion | test, dev, preview, prod, local | prod deploy only after cli is live |

## Safety invariants (do not violate)

1. **cli before prod.** PR A (cli drops its cross-script `DOC_NOTIFY` binding) must be deployed before PR B's prod deploy. This is the reverse of the usual "prod before cli" order — call it out in the deploy PR.
2. **Never delete `AccessFnDO`.** Still live via the chat plane (`appHandlers` → `env.ACCESS_FN_DO`). Out of scope; blocked on #2263.
3. **Keep every historical migration tag** (`v1..v5`). Only append. wrangler rejects deploys when a previously-applied tag is missing from config.
4. **`wrangler deploy --dry-run` per env is the authoritative gate.** If any env errors, stop and apply the documented contingency before deploying.
5. **Leave cli's APP_SESSIONS / USER_NOTIFY cross-script bindings** intact — they are live.

## Done when

- `DocNotify` class, `DOC_NOTIFY` bindings (except the dormant cli history note), source file, and env type are gone.
- `grep -rn "env.DOC_NOTIFY\|DocNotify" vibes.diy --include='*.ts'` returns only intentional comment references (or none).
- All envs deploy clean; single-vibe live updates still work.
