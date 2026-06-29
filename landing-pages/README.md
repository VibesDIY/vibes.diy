# Vibes DIY Landing Pages

Landing pages for [Vibes DIY](https://vibes.diy), built with Handlebars templates and shared partials (footer, newsletter, head/meta).

**Live site:** https://good.vibes.diy

## Local development

```bash
pnpm install        # first time only
pnpm build          # compiles src/pages/*.hbs → _site/*.html
npx serve _site     # http://localhost:3000
```

## Pages

| Path | Template | Audience |
|------|----------|----------|
| `/` | `src/pages/index.hbs` | Hub page with cards linking to all landing pages |
| `/valentines` | `src/pages/valentines.hbs` | Lovers |
| `/teachers` | `src/pages/teachers.hbs` | Educators |
| `/hotwheels` | `src/pages/hotwheels.hbs` | Hot Wheels collectors |
| `/organizers` | `src/pages/organizers.hbs` | Desk clerks, renovators, event planners |
| `/builders` | `src/pages/builders.hbs` | New/non-technical builders (editorial layout) |
| `/wedding` | `src/pages/wedding.hbs` | Wedding planners (editorial layout) |
| `/youtubers` | `src/pages/youtubers.hbs` | YouTubers (back of house) |
| `/coaches` | `src/pages/coaches.hbs` | Sports coaches |
| `/contractors` | `src/pages/contractors.hbs` | Trades / contractors |
| `/homeschoolers` | `src/pages/homeschoolers.hbs` | Homeschool families |
| `/puppies` | `src/pages/puppies.hbs` | Puppy owners |
| `/reshippers` | `src/pages/reshippers.hbs` | Electronics parts reshippers |

## Project structure

```
src/
  layouts/       # standard.hbs, editorial.hbs — page shells
  partials/      # head.hbs, footer.hbs, newsletter.hbs — shared components
  pages/         # *.hbs — one per landing page
build.js         # Handlebars compiler → outputs to _site/
```

Each page has JSON front-matter in a Handlebars comment at the top:

```handlebars
{{!--
{
  "layout": "standard",
  "title": "Page Title",
  "description": "Meta description",
  "ogUrl": "https://good.vibes.diy/page",
  "source": "page-name"
}
--}}
```

## Workflow — never push directly to main

All changes go through a PR branch. Cloudflare Pages posts a **preview URL** on every PR so you can review in a real browser before merging.

```bash
git checkout -b my-branch-name   # branch off main
# ... make changes ...
pnpm build                         # verify locally
git add <files> && git commit -m "what changed and why"
git push -u origin my-branch-name
gh pr create --fill                # opens PR, preview URL appears in ~1 min
```

Once you're happy with the preview, merge the PR. The live site deploys automatically.

## Adding a new page

1. Copy an existing `.hbs` page in `src/pages/` as a starting point
2. Update the JSON front-matter (title, description, ogUrl, source)
3. Add `{{> newsletter}}` where you want the subscribe form
4. Add a card for it in `src/pages/index.hbs`
5. Run `pnpm build` to verify, then follow the branch → PR → merge workflow
