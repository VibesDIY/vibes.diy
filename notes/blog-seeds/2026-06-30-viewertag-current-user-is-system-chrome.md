# Stop telling the generator to draw its own login button

Source: branch `claude/viewertag-guidance-update-6de11n` — prompt-workspace guidance only
(`prompts/pkg/llms/use-viewer.md`, `use-vibe.md`, `fireproof.md`, `system-prompt.md`,
`system-prompt-initial.md`). No runtime/code change.

The old prompts told generated apps to put a no-prop `<ViewerTag />` (the current viewer's
pill / "Sign in" button) in the header on every page so a visitor could see who they were and
log in. But that widget is already **system chrome**: the Vibes Switch — the panel that opens
when you click the logo — shows the current user and offers sign-in (and avatar editing). So the
header pill was a duplicate the app didn't need to build.

Findings worth a full post:

- **The change is "what's the app's job vs. the platform's job," not an API removal.** The
  no-prop `<ViewerTag />` still exists and still renders a sign-in button for anonymous viewers
  — we just stopped *asking the generator to place one*. The login affordance moved out of every
  app's chrome and into one shared place (the logo), so apps render less and the experience is
  consistent across vibes. `<ViewerTag userHandle={...} />` for **other** people (comment authors,
  rosters, "added by") is untouched — that's still the app's job.

- **The use-viewer doc is a literate SEARCH/REPLACE tutorial, so editing the base example
  cascades.** Dropping `<ViewerTag />` from the opening scaffold broke every downstream edit's
  SEARCH anchor (the "commenting as" pill, the comment-thread destructure that re-introduces
  `ViewerTag`). The fix was to re-thread the whole tutorial: `ViewerTag` now enters the
  destructure exactly when the comment *list* first needs it to render authors — the one place it
  legitimately belongs — instead of on `App`'s first line "for identity."

- **Guidance lives in five files for a reason; they're not redundant.** `system-prompt*.md` is the
  always-on rule ("don't add a header pill"); the `llms/*.md` skill docs are the long-form how-to
  that only load when the relevant skill is selected. Both had to change or a generator with the
  use-viewer skill active would still see the old header-pill example. Tests only assert substring
  presence (`useViewer`, `avatarUrl`), so the literate examples can be restructured freely as long
  as the keywords survive.
