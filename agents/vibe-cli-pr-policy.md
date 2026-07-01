# Vibe (CLI) work: the deploy is the ship, the PR is just a safety net

When you're building or editing a **Vibe** with the `vibes-diy` CLI — the JSX apps
under `vibes/<slug>/` that you `push`/`publish` to a handle — the delivery mechanism is
the CLI deploy, **not** the git merge. Internalize the difference, because it changes how
much the PR/merge dance matters.

## What actually ships a vibe

```
npx vibes-diy push    --vibe <handle>/<slug>   # deploy the working-dir source to that handle
npx vibes-diy publish --vibe <handle>/<slug>   # make the latest push the live release
```

Run from the vibe's source directory. Once you `push` (and `publish` for the OG/live
handle), the change is **live for users**. That is the ship. The git repo does not gate,
build, or serve the vibe.

## So the PR/merge is not the meaningful part — don't stress about it

- The git branch + PR exist to **keep the code from getting lost** (cloud sessions are
  ephemeral; a pushed branch survives). That's the whole job of the PR here.
- The **merge is not meaningful** for a vibe — the live app doesn't depend on `main`.
  Don't race to "merge on green," don't schedule tight merge-loop check-ins, don't treat
  an unmerged vibe PR as unfinished work. Just make sure the work **is committed and
  pushed** and a PR exists so nothing is lost.
- **Don't care which PR the vibe changes land on.** If you're constrained to a branch
  that already has an open PR (e.g. a follow-up after the prior PR merged), it's fine to
  pile the new vibe changes onto that PR. Note it in the body so reviewers aren't
  surprised, and move on. Don't spend effort splitting vibe changes into tidy separate
  PRs for their own sake.

## Reviews ARE useful — take them, but don't rush them

- Charlie / Codex review feedback on vibe PRs is genuinely valuable (they catch real
  bugs — race conditions, ownership checks, edge cases). **Read it and act on it.**
- Because the merge isn't the deadline, there's **no need to rush the review** or hurry
  it to a merge. Let it take the time it takes.
- When you apply review feedback, **auto-deploy the fix** to the live handle(s)
  (`push` + `publish`) the same way you'd deploy any other change — the review→fix→deploy
  loop keeps the _live app_ correct, which is what matters. Then push the commit so the
  PR reflects it and the reviewer can re-check.

## When the merge DOES matter

This policy is scoped to **vibe (CLI-deployed) work**. For platform / library / infra
changes — anything that ships through the normal build & deploy pipeline (packages,
workers, schema, bindings, `vibes.diy/**`) — the full [`pr-lifecycle.md`](pr-lifecycle.md)
rules still apply: there, the merge _is_ the ship, so green CI + review + merge matter.

## TL;DR

Deploy it (that's the ship). Commit + push it (so it's not lost). Open/keep a PR (don't
fuss over which one). Apply review feedback and auto-deploy it. Don't stress about the
merge — just make sure it eventually happens.
