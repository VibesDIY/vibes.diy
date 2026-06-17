# Team-shared Claude Code skills

This directory is the canonical location for **invokable** Claude Code skills shared across the team. It is one of the few subdirectories of `.claude/` that is **not** gitignored — the carve-out is in [`.gitignore`](../../.gitignore) (`.claude/*` + `!.claude/skills/`).

## Convention

Each skill lives in its own subdirectory:

```
.claude/skills/<skill-name>/
├── SKILL.md          # required: YAML frontmatter (name, description) + body
├── references/       # optional: markdown loaded on demand from SKILL.md
├── assets/           # optional: templates / output scaffolds the skill copies
└── scripts/          # optional: executable helpers the skill invokes via Bash
```

Claude Code looks for project-scoped skills under this path when running in this repo. Inside a session, the dev triggers a skill either by typing its slash-command form (`/<skill-name> ...`) or by describing the task in a way that matches the skill's `description` field. Step 5 of "Adding a new skill" below is the test that validates discovery for a freshly added skill before merging.

## Boundary with `agents/`

- **`agents/*.md`** holds team rules and conventions (Fireproof patterns, code-quality, deploy tags, etc.). They are loaded into context by reference — from [`CLAUDE.md`](../../CLAUDE.md), from inside an agent's working session, or from another skill.
- **`.claude/skills/<name>/SKILL.md`** holds invokable, discovered skills with YAML frontmatter and optional bundled resources.

`agents/` documents _how we work_. `.claude/skills/` provides _things we invoke_.

## Adding a new skill

1. Create `.claude/skills/<your-skill>/SKILL.md`.
2. Add YAML frontmatter with `name` (kebab-case, matches the directory) and `description` (one or two sentences — what it does plus when to trigger).
3. Write the body as imperative instructions. Reference bundled resources by relative path.
4. Optionally add `references/`, `assets/`, `scripts/` for content that loads on demand.
5. Test in a fresh Claude Code session before merging.

## Existing skills

### First-party

- [`dependabot-review/`](dependabot-review/SKILL.md) — read-only audit of every open Dependabot PR. Assigns Merge/Verify/Investigate/Hold verdicts and produces a consolidated report. Source: [VibesDIY/dependabot-review](https://github.com/VibesDIY/dependabot-review).
- [`qa-pr/`](qa-pr/SKILL.md) — agent-driven QA pass against a PR preview URL using the kmikeym v0.01m SOP. Every run covers desktop + mobile (390×844) in one pass.
- [`vibe-data/`](vibe-data/SKILL.md) — read/write/query/explore data in vibes via the `vibes-diy` CLI.

### Vendored `superpowers` (v5.1.0, [obra/superpowers](https://github.com/obra/superpowers), MIT)

Core workflow skills vendored as flat project skills so they're available to **cloud sessions** (which read `.claude/skills/` from the repo but have no globally-installed plugins). Provenance, license, and the update procedure live in [`superpowers-vendor/`](superpowers-vendor/README.md). Invoke by bare name (the `superpowers:` prefix is plugin-only and was rewritten out). The upstream `using-superpowers` meta-skill is intentionally **not** vendored — it's a plugin-bootstrap skill that's inert as a manual project skill; `CLAUDE.md` points sessions at the concrete workflow skills directly instead.

- [`brainstorming/`](brainstorming/SKILL.md), [`writing-plans/`](writing-plans/SKILL.md), [`executing-plans/`](executing-plans/SKILL.md), [`subagent-driven-development/`](subagent-driven-development/SKILL.md), [`dispatching-parallel-agents/`](dispatching-parallel-agents/SKILL.md)
- [`test-driven-development/`](test-driven-development/SKILL.md), [`systematic-debugging/`](systematic-debugging/SKILL.md), [`verification-before-completion/`](verification-before-completion/SKILL.md)
- [`requesting-code-review/`](requesting-code-review/SKILL.md), [`receiving-code-review/`](receiving-code-review/SKILL.md)
- [`using-git-worktrees/`](using-git-worktrees/SKILL.md), [`finishing-a-development-branch/`](finishing-a-development-branch/SKILL.md)
- [`writing-skills/`](writing-skills/SKILL.md)

## Distribution & upgrade path

**Current model: project-scoped skills.** These skills are _not_ packaged as a plugin. Claude Code auto-discovers them under `.claude/skills/` whenever a session runs inside a clone of this repo, so the only "install" step for an engineer is cloning `vibes.diy`. They're invoked by their bare name (`/qa-pr`). This is a fully supported distribution method and is the right fit while the skills are used **inside this repo**.

**When to upgrade to a plugin + marketplace.** A project skill can't be installed into _other_ repos, has no explicit versioned releases (it tracks whatever commit you're on), and can't bundle commands/agents/hooks/MCP as one unit. Upgrade when any of these becomes true:

1. You want a skill usable from **other repos or globally**, not just inside `vibes.diy`.
2. You've accumulated **several team skills** worth presenting as a catalog.
3. You need **versioned releases** or auto-update for the team.

**Minimal migration (a repo can be its own marketplace).** Add four things at the repo root (the `.claude-plugin/` and `plugins/` dirs sit at root, _not_ under `.claude/`, so the `.claude/*` gitignore rule doesn't touch them):

```
vibes.diy/
├── .claude-plugin/marketplace.json      # catalog: { name, owner, plugins:[{name, source:"./plugins/qa-pr"}] }
├── plugins/qa-pr/
│   ├── .claude-plugin/plugin.json       # manifest: { name, description, version } (name + description required)
│   └── skills/qa-pr/SKILL.md            # the skill moves here, content unchanged
└── .claude/settings.json                # extraKnownMarketplaces + enabledPlugins (auto-enables for the team)
```

Two caveats to weigh before pulling the trigger:

- **Invocation becomes namespaced** — `/qa-pr` turns into `/<plugin-name>:qa-pr`. Pick the plugin name with that in mind.
- **`.claude/settings.json` needs its own gitignore carve-out** (`!.claude/settings.json`) to be team-shared, since `.claude/*` ignores it today. (`.claude/settings.local.json` stays local/ignored.)

Then engineers run `/plugin marketplace add VibesDIY/vibes.diy` once (or get it automatically via the `extraKnownMarketplaces` entry on repo trust). Refs: [plugins](https://code.claude.com/docs/en/plugins.md), [plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces.md), [settings](https://code.claude.com/docs/en/settings.md).
