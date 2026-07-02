---
title: "From one CLAUDE.md to forty runbooks"
date: 2026-07-01T09:00:00Z
author: "Vibes DIY"
summary: "A year of agent documentation, read straight from git history: a 103-line init file, a 326-line grab-bag, a hard split into version-controlled runbooks — and what each era says about the work we were shipping at the time."
thumb: "/images/blog/one-claude-md-to-forty-runbooks/card.jpg"
---

You can read a team's history in its documentation the way you read a tree's history in its rings. Ours is unusually legible, because the documentation in question is written *for agents* — and every time the way we work changed, the docs had to change the same week or the agents kept doing the old thing. Today the repo carries a 79-line `CLAUDE.md` that is mostly a table of contents, forty runbooks under `agents/`, and a directory of invokable skills. A year ago it was one file, 103 lines long. Git remembers every step in between.

<figure>
    <img src="/images/blog/one-claude-md-to-forty-runbooks/card.jpg" alt="Title card: “1 file → 40 runbooks” set over shelves of books, in the Vibes DIY teal-and-goldenrod style." loading="lazy">
    <figcaption>The agent docs grew the way a library does: one shelf at a time, each shelf named after a problem.</figcaption>
</figure>

## June 2025: the file that described the codebase

The first `CLAUDE.md` lands in June 2025, and it's the classic `/init` artifact: "This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository." It describes what the app *was* at the time — a React Router v7 SPA with Netlify functions, a `useSimpleChat` hook, Fireproof documents for chat messages. Two commands: `pnpm dev` and `pnpm check`.

That's what agent docs were for in 2025: orienting one assistant, on one laptop, with a human watching every keystroke. The file says nothing about how to behave, because behavior wasn't the bottleneck — the human was right there. It only had to explain the code.

## July 2025 – March 2026: the grab-bag era

Then the work changed, and the file changed with it. The repo went monorepo in July 2025 (`CLAUDE.md` followed the code into a subdirectory, then re-grew at the root). The era's actual engineering was packaging: `call-ai`, `use-vibes`, tag-based publishing, a multi-package release train. And the doc grew exactly where that work hurt. By November 2025 it had swelled to 326 lines, and the section headings read like scar tissue: *Proper Release Order*. *Build Failure Analysis*. *Prevention Strategy*. And the wonderfully specific *"Call-AI Release Process (MANUAL ONLY — Not for Claude)"* — a heading that exists because, at some point, Claude cut a call-ai release it shouldn't have.

Two lessons from this era held up. First, **docs accrete where the pain is** — nobody planned a release-process chapter; releases just broke often enough to earn one. Second, one file with no internal structure stops working at a few hundred lines. Everything is equally top-of-mind, which means nothing is: the release rules sat next to the file-structure tour, and an agent loading the whole thing had no signal about what actually mattered for today's task.

## April 2026: the split

The fix arrives as two commits, two days apart. On April 9, the agent rules that had been living in *personal* `~/.claude/` memory files and a private `rules.md` got checked into a version-controlled `agents/` directory — coding standards, deploy tags, environment architecture, the Fireproof rules-bag. On April 10, `CLAUDE.md` went from 300 lines to 27: a link hub pointing into `agents/`, plus a short quick-reference.

The timing wasn't an accident. This was the season the product grew its in-place editing pipeline — autosaved edit turns, live-preview hot-swap on every code block — which meant more agent sessions doing heavier work in parallel. Rules that live in one person's local memory files don't scale past one person. Moving them into the repo made them **reviewable** (a rule change is now a diff someone approves), **shared** (every agent, every machine, same rules), and **maintained** — the repo's standing instruction from then on: PRs that change agent behavior update the relevant `agents/` file alongside the code.

## May 2026: memory becomes repo-backed, skills become invokable

The migration kept going. A May commit titled "memory inline to repo" moved another batch of accumulated local memory — debugging patterns, git workflow, code-quality rules — into `agents/`, and it hardened into policy: an agent's memory file may only be a one-paragraph *pointer*; the substance must live in the repo, where it can be read, reviewed, and fixed.

The same month, a second kind of document appeared. `agents/` files describe *how we work*; but some knowledge is a *procedure you run* — a QA pass, a code review, a debugging loop. Those became skills under `.claude/skills/`, starting with a QA standard-operating-procedure promoted out of a real PR review, and later the vendored `superpowers` workflow skills so they'd exist in ephemeral cloud sessions that have no globally-installed plugins. The boundary was worth writing down: prose for how we work, skills for things we invoke.

This is also when the docs started assuming *plural* agents — worktree-setup runbooks, a parallel-implementer dispatch pattern harvested from an actual multi-agent PR. The reader of the docs was no longer "the assistant." It was a fleet.

## June 2026: runbooks written by the sessions that needed them

The most recent ring is the thickest. June 2026 is when our agents moved into ephemeral cloud containers by default (that story is its own post — see below), and nearly every fight with that infrastructure left a runbook named after it: how to make headless Chromium screenshots work behind the egress proxy, how to query the production Postgres when raw `psql` hangs, which GitHub MCP calls bloat context and what to use instead, how to measure a deployed app inside its cross-origin iframe, how to tell a flaky test from a real failure.

Notice what changed in *kind*, not just count. The 2025 file described code. The 2026 runbooks describe **operations**: `pr-lifecycle.md` specifies the autonomous merge loop — open the PR, request review, apply feedback, merge on green without a human in the chair. The docs stopped being a map of the codebase and became the standard operating procedure for working on it unattended. Fittingly, most of them are now written by agents, for the next agent: each one is the residue of a debugging session that someone would otherwise repeat from scratch.

<div class="table-scroll">
<table>
    <thead><tr><th>Era</th><th>Shape</th><th>The work at the time</th><th>What docs were for</th></tr></thead>
    <tbody>
        <tr><td>Jun 2025</td><td>One 103-line <code>CLAUDE.md</code></td><td>SPA + chat + Fireproof</td><td>Describe the codebase</td></tr>
        <tr><td>Jul 2025 – Mar 2026</td><td>One file, peaking at 326 lines</td><td>Monorepo, packages, tag-based publishing</td><td>Stop releases from breaking</td></tr>
        <tr><td>Apr 2026</td><td>27-line hub + <code>agents/</code></td><td>In-place editing pipeline, more parallel sessions</td><td>Make the rules reviewable and shared</td></tr>
        <tr><td>May 2026</td><td>+ repo-backed memory, + skills</td><td>Worktrees, multi-agent dispatch, QA SOPs</td><td>Split "how we work" from "things we invoke"</td></tr>
        <tr><td>Jun 2026 →</td><td>79-line hub + 40 runbooks</td><td>Cloud containers, evals, autonomous merges</td><td>Operate unattended</td></tr>
    </tbody>
</table>
</div>

## What the rings say

- **Don't design the structure; harvest it.** Every good file in `agents/` earned its existence by hurting first. The one deliberate act was the split — recognizing when the pile needed shelves.
- **The index is the interface.** An agent reads the 79-line `CLAUDE.md` every session and fetches runbooks on demand, so each link's one-line summary is a retrieval key, written so the right doc gets pulled at the right moment. Those summaries are the most-edited lines in the repo.
- **If it isn't in the repo, it doesn't exist.** Private memory files don't survive an ephemeral container, can't be reviewed, and can't teach the next agent. Version control turned tribal knowledge into infrastructure.
- **Docs are load-bearing now.** When the reader executes what it reads, a stale doc isn't embarrassing — it's a bug, with a blast radius. That's why doc updates ride in the same PR as the behavior they describe.

**Read more:** the June chapter of this story — why the agents moved to the cloud in the first place, and what broke on the way — is in [Why our agents don't get a laptop](/blog/agents-in-the-cloud.html).

<div class="post-cta">
  <h3>Built by a team that writes things down.</h3>
  <p>The same discipline that keeps our agents sharp ships your apps. Type a sentence; get something real.</p>
  <a href="https://links.vibes.diy/homepage" class="btn">Start building →</a>
</div>
