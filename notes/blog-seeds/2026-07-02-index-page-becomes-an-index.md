# The homepage was a catalog wearing a homepage costume

**Hook:** good.vibes.diy's index page grew into a 90-card catalog — great as a gallery, useless as
a front door. Instead of redesigning it, we renamed it: the old index moved to `/apps` untouched,
and a new index took its place that does exactly three things — point at the blog, the builder's
docs, and the catalog it used to be.

**Source:** `claude/vibes-diy-index-redesign-3wyo28` — landing-pages index split (index.hbs →
apps.hbs + new index.hbs).

**The trade-off / why / gotcha:**

- The cheapest redesign is a rename. The catalog page was *good* — the failure was positional, not
  qualitative. Moving it to `/apps` preserved every card and its OG screenshot pipeline while
  freeing `/` to answer "what is this site" in one screen.
- The new page is assembled almost entirely from copy that already existed: the about page's
  "what this site is" prose, and `notes/how-to-talk-about-vibes.md`'s fun/done/alive pitch,
  group-chat/front-counter split, and payment/privacy guardrails ("takes the order the moment it's
  live — add a payment flow when you're ready"; access-scoped privacy, never secrecy). Messaging
  docs written as internal reference turned out to be publishable nearly verbatim.
- Gotcha: two pages can't both claim `source: "homepage"` for attribution — the renamed catalog
  had to give up its `source` and ogUrl even though "don't change it" was the brief. Metadata
  follows the URL, not the file.
