# Team-shared Claude Code skills

This directory is the canonical location for **invokable** Claude Code skills shared across the team. It is one of the few subdirectories of `.claude/` that is **not** gitignored — the carve-out is in [`.gitignore`](../../.gitignore) (`.claude/*` + `!.claude/skills/`).

## Convention

Each skill lives in its own subdirectory:

````
.claude/skills/<skill-name>/
├── SKILL.md          # required: YAML frontmatter (name, description) + body
├── references/       # optional: markdown loaded on demand from SKILL.md
├── assets/           # optional: templates / output scaffolds the skill copies
└── scripts/          # optional: executable helpers the skill invokes via Bash
````

Claude Code looks for project-scoped skills under this path when running in this repo. Inside a session, the dev triggers a skill either by typing its slash-command form (`/<skill-name> ...`) or by describing the task in a way that matches the skill's `description` field. Step 5 of "Adding a new skill" below is the test that validates discovery for a freshly added skill before merging.

## Boundary with `agents/`

- **`agents/*.md`** holds team rules and conventions (Fireproof patterns, code-quality, deploy tags, etc.). They are loaded into context by reference — from [`CLAUDE.md`](../../CLAUDE.md), from inside an agent's working session, or from another skill.
- **`.claude/skills/<name>/SKILL.md`** holds invokable, discovered skills with YAML frontmatter and optional bundled resources.

`agents/` documents *how we work*. `.claude/skills/` provides *things we invoke*.

## Adding a new skill

1. Create `.claude/skills/<your-skill>/SKILL.md`.
2. Add YAML frontmatter with `name` (kebab-case, matches the directory) and `description` (one or two sentences — what it does plus when to trigger).
3. Write the body as imperative instructions. Reference bundled resources by relative path.
4. Optionally add `references/`, `assets/`, `scripts/` for content that loads on demand.
5. Test in a fresh Claude Code session before merging.

## Existing skills

- [`qa-pr/`](qa-pr/SKILL.md) — agent-driven QA pass against a PR preview URL using the kmikeym v0.01m SOP.
