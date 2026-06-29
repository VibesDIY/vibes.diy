# Bringing good.vibes.diy into the monorepo (and giving the blog a real feed)

**Hook:** the marketing site lived in a separate private repo that quietly held both the
public landing pages *and* the ad-buying machinery. Merging the public half into the open
monorepo meant drawing a clean line between "enthusiastically public" and "stays private."

**Source:** spec at `docs/superpowers/specs/2026-06-29-landing-pages-monorepo-and-markdown-blog-design.md`.

**The trade-off / why / gotcha:**
- A privacy audit before any copy found *no live secrets* but a real PII/infra cluster:
  Meta business/app/account IDs and a personal FB ad account tied to a real name. Lesson:
  "private → public" moves need an audit pass even when there are no tokens to rotate.
- We rejected the obvious "archive the old repo" move in favor of "keep it private, delete
  only what moved." Less work, less risk, and it gives the ad tooling a natural home —
  exactly one copy of everything.
- The blog had no machine-readable model (hand-written HTML cards, dates as free text), so
  a "good RSS feed" was really "give the blog a data model first." Markdown + front-matter
  turns the index and Atom/RSS feeds into byproducts of one sorted post list.
- Cutover gotcha: two repos must never race-deploy to the same Cloudflare Pages project —
  remove the old `deploy.yml` the moment the monorepo workflow goes green.
- pnpm gotcha: a standalone package inside a pnpm monorepo needs `--ignore-workspace` so the
  root doesn't claim it.
