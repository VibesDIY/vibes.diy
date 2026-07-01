# "Copy instructions for your coding agent" — hand a vibe to any harness

Source: branch `claude/code-harness-edit-affordance-yyjhem`. A "copy the brief" affordance on the
vibe editor's Code tab, a `vibes-diy help` alias, and the confirmation that `pull` is not
owner-only.

Goal: let anyone editing a vibe drop a ready-to-paste brief into Claude Code / Cursor / Codex so
the agent can pull the vibe, edit it locally, and push it back — without the human having to
reverse-engineer the CLI.

Findings worth a full post:

- **The brief is written AT the agent, not the human.** `buildAgentInstructions()` emits markdown
  templated to the exact vibe (`owner/slug` in the `pull`/`push` commands, slug as the `--dir`).
  The affordance lives on the Code tab header and shows for *everyone* who can open the panel — not
  just the owner — because pulling source isn't owner-gated. The Monaco Edit toggle stays
  owner-only right next to it.

- **The login step is the interesting one.** The brief tells the agent to run `npx vibes-diy login`
  *itself* rather than handing it back to the user: `login` shells out to `open()` and auto-launches
  a browser tab for the human to approve, returning on the localhost CA callback. So on the user's
  own machine the agent never has to stop and say "please run login" — it just runs it and the
  browser pops. (Headless/CI still uses the `VIBES_DEVICE_ID` env var.)

- **`vibes-diy help` didn't actually work — now it does.** cmd-ts only wires up `--help`; a bare
  `help` token threw "Not a valid subcommand name," even though the README template and CLI footer
  had been telling people to run it for months. A tiny leading-token normalizer (`help` →
  `--help`, `help pull` → `pull --help`) fixes the promise instead of rewording every doc.

- **Pull was never owner-only — the code already said so, one doc lied.** `getAppByFsId` grants
  non-owners `public-access` / `granted-access.*` / `accepted-email-invite`, and the source-serving
  entry point (`?source=true`) has no auth gate of its own. The pull command's grant check was the
  gate, and it only rejected `not-found`/`not-grant` — so it *over*-served `pending-request` and
  `revoked-access` (you'd requested-but-not-been-approved and still get source). Swapping the check
  for the shared `isReadableGrant` predicate (aliased from the cached-suggestion read rule, an
  explicit allowlist over the full grant union) makes it exactly "if you can open the vibe you can
  read its source, and only that" — tightening the leak while keeping every real access-holder. The
  `vibe-code` skill doc that claimed `pull` needs an editor grant got corrected: only `push` does.
