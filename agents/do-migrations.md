# Durable Object Migrations

Wrangler tracks DO migrations by tag on the live worker. The config in `wrangler.toml` is **append-only history**, not a desired state. Wrangler diffs config tags against the worker's last-applied tag and applies anything newer; it cannot retroactively delete a tag the worker has already recorded.

## The append-only rule

**Once a `[[env.<name>.migrations]]` block is shipped (any tag pushed to a `vibes-diy@*` deploy), it is permanent. Never delete or rewrite it.** Transitions are encoded as new entries.

If you delete a shipped migration block from config, the next deploy of that env hits this Cloudflare error (10074):

> The published script `<worker>` has a migration tag `vN`, which was not found in your wrangler.json file. You may have already deleted it. Applying all available migrations to the script…
> Cannot apply new-class migration to class `X` that is already depended on by existing Durable Objects [code: 10074]

Wrangler resets and re-applies every migration from `v1` against a worker that already has those classes live. The error names whichever `new_classes` is first in the array, not the migration you deleted.

This actually happened: commit `6d6fcfa8` dropped `[[env.cli.migrations]] tag = "v2"` from `vibes.diy/pkg/wrangler.toml`. Three deploys later (`vibes-diy@c2.2.68`) the cli deploy failed with the message above. Recovery is in commit `<recovery-sha>`: keep v2, append v3.

## Transition recipes

### Retire a local DO class (cross-script-bind instead)

Cli was the example: local `DocNotify` → cross-script binding to prod's `DocNotify`. The local class becomes **dormant** — it stays in the cli script's class registry but nothing addresses it because the binding routes elsewhere via `script_name`.

```toml
[env.cli.durable_objects]
bindings = [
  { name = "DOC_NOTIFY", class_name = "DocNotify", script_name = "vibes-diy-v2-prod" },
]

[[env.cli.migrations]]
tag = "v1"
new_classes = ["ChatSessions"]

# Historical — must stay. Removing this triggers 10074 (see below).
[[env.cli.migrations]]
tag = "v2"
new_classes = ["DocNotify"]
```

**You cannot add `deleted_classes = ["DocNotify"]` while a (even cross-script) binding still names the class** — Cloudflare blocks it with error 10061:

> Cannot apply --delete-class migration to class 'DocNotify' without also removing the binding that references it.

Cloudflare's validator counts the `class_name = "DocNotify"` field on the cross-script binding as a live reference to the local class, regardless of `script_name`. Leaving the class dormant is fine if you never need it back — zero new DO instances are created locally (the binding routes elsewhere), so the orphan never grows.

### Delete a DO class for real

Both legacy DOs from the session split (`DocNotify`, `AccessFnDO`) were ultimately deleted. The two cases show the two shapes — the ordering constraint depends entirely on whether any **cross-script** binding names the class:

**Case A — cross-script binding exists (DocNotify): deploy-ordered, cli-first.**
cli cross-script-bound prod's `DocNotify`, so prod could not `deleted_classes` it while cli's binding referenced it (10061). Sequence across two PRs:

1. **cli unbind (deploy FIRST):** drop the cross-script `DOC_NOTIFY` binding from cli (#2297). Now nothing external references prod's class.
2. **class deletion (deploy AFTER cli is live):** remove the local `DOC_NOTIFY` binding + append `deleted_classes = ["DocNotify"]` in every env (#2298). cli also needed its own `deleted_classes` for the dormant local class once the source was removed.

This is the **reverse** of the usual prod-before-cli order — call it out in the deploy PR.

**Case B — local binding only, no cross-script (AccessFnDO): single PR, standard order.**
`AccessFnDO` was a **local** class in every env (no `script_name` anywhere), so no env's binding referenced another env's class — no 10061 dependency between cli and prod. One PR (#2511): drop the `ACCESS_FN_DO` binding + append `v7 deleted_classes = ["AccessFnDO"]` in all six env blocks, delete source/export/type. Standard prod-before-cli deploy; either order is actually safe.

**In both cases:** the worker code must stop invoking the class **before** the deletion deploys — `deleted_classes` is irreversible and destroys all instances/state for the class. Gate the delete on a prior deploy that removed the last code reference. (Safe for these two only because they stored transient/recomputable state, never user data.)

### Add a new DO class

```toml
[[env.prod.migrations]]
tag = "vN"
new_classes = ["NewClass"]
```

Where `vN` is the next sequential tag for that env. Tags must be unique within an env and follow `v1, v2, v3, …` with no gaps.

### Rename a DO class

Use `renamed_classes`, never delete-then-create:

```toml
[[env.prod.migrations]]
tag = "vN"
renamed_classes = [{ from = "OldName", to = "NewName" }]
```

### Move a DO class to another script (preserving storage)

Use `transferred_classes` rather than delete-on-source + new-on-target. Storage migrates.

## Per-env tag sequences are independent

Each `[[env.<name>.migrations]]` array has its own `v1..vN` sequence. `env.cli` at v3 says nothing about `env.prod`'s tag count. When adding a class repo-wide, each env's array advances independently. The CI guardrail (`pkg/test/wrangler-migrations.test.ts`) enforces the `v1, v2, v3, …` shape per env.

## Cross-script bindings

`script_name = "<other-worker>"` in `[env.X.durable_objects].bindings` tells wrangler the class lives in another script. The local `migrations` array on env X should **not** declare that class via `new_classes` going forward — the source script owns the class lifecycle. If the class was once local on X and is now cross-script, retire it on X with `deleted_classes` (recipe above).

## When deploying touches migrations

1. Add migration block(s); never modify or delete existing blocks.
2. Run the guardrail: `cd vibes.diy/pkg && pnpm vitest run wrangler-migrations.test.ts` (also runs as part of `pnpm check`).
3. Inspect for storage-loss risks (anything `deleted_classes` zaps?).
4. Tag normally per `agents/deploy-tags.md`.

If a deploy hits error 10074, read this file first — almost always a tag-deletion regression, not a Cloudflare problem.
