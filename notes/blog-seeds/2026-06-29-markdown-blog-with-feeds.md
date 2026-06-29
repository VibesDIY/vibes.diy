# Giving the good.vibes.diy blog a markdown spine (and Atom/RSS) without MDX

Source: `jchris/landing-pages-to-monorepo` (PR #2849)

The good.vibes.diy blog used to be hand-written inline-HTML `.hbs` files with a
hand-maintained index of cards — nothing machine-readable, every post carrying
its own copy-pasted `<style>` block. This PR moved posts to `src/posts/*.md`
(YAML front-matter + `marked`/`gray-matter`), generated the index and **both**
Atom 1.0 and RSS 2.0 feeds from one sorted post list, and converted the three
existing posts.

A few angles worth a post:

- **MDX was considered and rejected.** The SSG is plain Node + Handlebars with no
  React and no bundler; MDX would drag in a whole React/Preact + esbuild runtime.
  The payoff (inline interactive components) is largely moot here because every
  Vibe is an embeddable `<iframe>` — so "rich content" is just raw-HTML
  passthrough in `marked` plus an iframe when you want a live demo.
- **The shared-vs-bespoke CSS line.** The shared `blog-post` layout owns the
  common prose/figure/table/code chrome that used to be duplicated into every
  post; genuinely one-off decorations (one post's screenshot gallery + "loop"
  diagram) stay as a scoped `<style>` in that post's markdown. Deciding what is
  "shared chrome" vs "this post's art" is the real design call.
- **Same-day ordering needs a tiebreaker.** All three posts publish on the same
  date; a date-only sort is non-deterministic, so a time-of-day component in the
  front-matter date preserves intended order while the rendered date still reads
  "June 9, 2026."
- **A custom `marked` code renderer** re-creates the old `<span class="lang">`
  label from a fenced block's info string, so authors write plain ```js fences
  and still get the styled language tag — written to tolerate both old and new
  marked renderer signatures.

Gotcha captured: a huge mechanical content migration (270 prompt-generated
example apps) trips `prettier --check` in CI; the fix was to prettier-ignore the
whole migrated subdir rather than reflow generated output that just re-drifts.
