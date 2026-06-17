# Vendored superpowers skills

The 14 `superpowers` skills (`brainstorming`, `test-driven-development`,
`systematic-debugging`, `subagent-driven-development`, …) are vendored into this
repo as **flat project skills** under `.claude/skills/` so they are available to
sessions that run inside a clone of `vibes.diy` — including **cloud sessions**,
which read `.claude/skills/` from the repo but have no globally-installed
plugins.

This directory (`superpowers-vendor/`) holds only provenance and the upstream
license. It contains no `SKILL.md`, so it is **not** discovered as a skill.

## Source

- Upstream: <https://github.com/obra/superpowers> (Jesse Vincent, MIT)
- Vendored version: **5.1.0**
- License: see [`LICENSE`](LICENSE) in this directory.

## What changed during vendoring

Project-scoped skills are invoked by their **bare directory name**
(`test-driven-development`), not the plugin-namespaced form
(`superpowers:test-driven-development`) — the `superpowers:` prefix only exists
for skills installed via the plugin. So the upstream skills' internal
cross-references were rewritten:

```
superpowers:<name>  ->  <name>
```

Nothing else was modified. Skill bodies, `references/`, `scripts/`, and
`examples/` are otherwise verbatim from upstream 5.1.0.

## Activation

Cloud sessions do **not** run the upstream plugin's `SessionStart` hook (which
is what auto-injects `using-superpowers` at the top of every local session). To
keep these skills front-of-mind without that hook, the repo's
[`CLAUDE.md`](../../../CLAUDE.md) points sessions at them. They remain invokable
on demand via the Skill tool by their bare names.

## Updating from upstream

1. Install/locate the upstream plugin (e.g. `~/.claude/plugins/cache/claude-plugins-official/superpowers/<ver>/skills`).
2. Copy each skill directory into `.claude/skills/<name>/` (flat — discovery is one level only).
3. Re-apply the namespace rewrite on the copied skills:
   ```sh
   grep -rln 'superpowers:' .claude/skills | while IFS= read -r f; do
     sed -i '' 's/superpowers://g' "$f"
   done
   ```
4. Update the **Vendored version** line above and the entries in
   [`.claude/skills/README.md`](../README.md).
5. Validate discovery + a chained cross-reference in a fresh session before merging.
