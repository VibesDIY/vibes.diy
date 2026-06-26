# Contributing

Thanks for contributing to `vibes.diy`.

## Before You Start

- Read the [Code of Conduct](CODE_OF_CONDUCT.md).
- Search existing [issues](https://github.com/VibesDIY/vibes.diy/issues) and [pull requests](https://github.com/VibesDIY/vibes.diy/pulls).
- For questions, open a discussion in an issue or draft PR.

## Scope: small and sharp by default

The most valuable contribution is a PR that fixes one real, noticeable thing with a small, well-understood surface area. These compound our velocity. Default to them.

**The sweet spot is papercuts.** The layout-flash in the result preview header. The persistent CGI 404 in prod. Flashes of default/placeholder content during page load. There is no shortage of work like this — the hard part is _noticing_ it. Noticing a small defect and turning it into a tight issue or a small PR is exactly the bandwidth we want the team to add, so the maintainer doesn't have to carry every observation from "noticed" to "fixed" themselves. If you spot one, capture it (see [Reporting Bugs](#reporting-bugs)) or fix it — don't let it evaporate in chat.

### Two tracks

Decide which track a change is on _before_ you write code:

- **Track A — just do it.** Small, reversible, non-controversial, and explainable in one sentence. Open the PR directly. Most work should be here.
- **Track B — discuss first.** Broad, experimental, or behavior-changing. Open a GitHub issue describing the problem and the proposed direction, get it narrowed or explicitly approved as worthwhile churn, _then_ write code. The design discussion is async and lightweight — a couple of issue comments is enough — but it has to settle the motivation first.

### The one-sentence test

You should be able to say what a PR does and why in one sentence, and a reviewer should be able to verify it without reconstructing your intent. If you can't, the change is probably too broad or not yet understood — narrow it, or take it to a Track B discussion.

### Design-discussion tripwires

Any one of these is a signal to _consider_ Track B (issue first, code second):

- Materially changes the system prompt or codegen behavior. (Pure typo/clarity edits with no intended behavior change can stay Track A.)
- Adds a feature flag, a new code path, or a parallel implementation of something that already exists.
- Touches multiple subsystems or otherwise has broad surface area.
- Is an experiment — i.e. the payoff is uncertain.
- Broadly or contentiously changes user-visible behavior, or changes an API or data contract. (A narrow bug fix that _restores_ intended behavior — removing a layout flash, killing a default-content flicker — is Track A even though it's user-visible. The tripwire is for new or debatable behavior, not for fixing something that's plainly broken.)
- Bundles an always-on change together with experimental or flag-gated work. (Split it: land the small, non-controversial piece on its own; route the broad part to a design issue.)

**These are guidance, not hard gates.** They're heuristics for noticing when a change is getting big enough to be worth a quick design conversation — not a checklist that blocks work. When a tripwire trips, the move is to _flag it_ — "this looks like it might want a design issue first; should I scope it, or is it small enough to just do?" — and let the human decide. Don't refuse to proceed, and don't become rigid about the letter of the rule. A fast human check beats both rule-bound intransigence and silently barreling ahead; the goal is less fog, not more process.

### Experiments must pay for themselves

Big experiments cost time and tokens. Only start one when the expected payoff is proportional to that investment, and only after a Track B discussion that says so. Start with the cheapest test of the hypothesis — often a prompt change plus an eval run — before building any runtime machinery. An experiment's issue should state the hypothesis, how we'll know it worked (a metric or eval), and the rough cost; and it should **characterize the baseline first** — measure how often the problem actually occurs before investing in fixing it.

### Clarity is the author's job

A PR that takes a reviewer hours to figure out "what is this even trying to do" is a net cost, even when the code is correct — it contributes to the fog instead of cutting through it. The burden of making intent legible is on the author: a clear title, a one-paragraph "why", and an explicit in-scope / out-of-scope line. If a PR grows past its original one-sentence purpose mid-flight, split it rather than letting it sprawl.

## Development Setup

```bash
git clone https://github.com/VibesDIY/vibes.diy.git
cd vibes.diy
pnpm install
pnpm dev
```

## Making Changes

1. Create a branch from `main`.
2. Keep changes focused on one topic.
3. Add or update tests when behavior changes.
4. Run checks locally:

```bash
pnpm check
```

This runs formatting, linting, build, and tests.

## Pull Requests

- Write a clear title and description.
- Link related issues (for example: `Closes #123`).
- Update docs when needed.
- Ensure CI is green before requesting review.

## Commit Messages

Use clear, imperative commit messages. Conventional prefixes are recommended:

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `chore:` maintenance
- `refactor:` code cleanup without behavior change

## Reporting Bugs

Open an issue with:

- expected behavior
- actual behavior
- steps to reproduce
- environment details (OS, Node, browser, versions)

## License

By contributing, you agree your contributions are licensed under the project license in [LICENSE.md](LICENSE.md) (`Apache-2.0`).
