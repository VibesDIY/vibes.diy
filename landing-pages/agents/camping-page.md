# Camping Page — Agent Runbook

End-to-end guide for building and launching the camping audience page.

**Spec:** `docs/superpowers/specs/2026-05-27-camping-page-design.md`

**PR policy:** Merge the PR before activating any Meta ads for this page.

---

## Phase 1 — Seed Park Data

```sh
# Get a free NPS API key at https://www.nps.gov/subjects/developer/get-started.htm
NPS_API_KEY=<your-key> node scripts/seed-parks.js
# → writes scripts/parks-data.json (~63 national parks)
```

Verify the output has at least 60 parks with `name`, `states`, `activities`, `images` fields populated.

---

## Phase 2 — Generate Apps (all 5 in parallel)

```sh
npx vibes-diy@latest login   # once per device

# Run all 5 in background, log to _status.log
gen() {
  npx vibes-diy@latest generate --user-slug=og --app-slug="$1" "$2" >> vibes/camping/_status.log 2>&1
  echo "DONE $1 exit=$?" >> vibes/camping/_status.log
}

mkdir -p vibes/camping
gen national-park-search  "National park finder. Filter 63 NPS parks by state and activity. Each park card: name, states, photo, entrance fee, top activities. Topographic map skin: off-white background with faint contour lines, charcoal text, bright orange accent, JetBrains Mono for metadata. Data is in local Fireproof storage (bulk-loaded on first run from a parks array constant). No external API calls at runtime." &
gen camp-gear-list        "Camping group packing list. Categories: Shelter, Kitchen, Safety, Navigation, Personal. Each item: name, who's bringing it, claimed/unclaimed toggle. Shows 'still needed' count at top per category. Simple, clean, offline-first with Fireproof." &
gen camp-meal-plan        "Camping meal planner for a multi-day trip. Day-by-day grid: breakfast, lunch, dinner. Each meal: name and who's cooking dinner. Bottom section: combined shopping list. User can set number of days (default 3). Fireproof for persistence." &
gen group-trail-log       "Group hiking log for a camping trip. Each entry: trail name, distance in miles, elevation gain in feet, difficulty (easy/moderate/hard/epic), hikers (comma list), notes. Sortable by date or difficulty. Fireproof for persistence." &
gen camping-adventure-story "Choose-your-own-adventure camping story told around a campfire. At least 3 branching decision points, at least 4 different endings. Illustrated with CSS art scenes (no external images). One ending must involve a bear being right there. Reads well aloud. Cozy campfire atmosphere in the UI." &

wait
cat vibes/camping/_status.log
```

---

## Phase 3 — Verify Deploys

```sh
for slug in national-park-search camp-gear-list camp-meal-plan group-trail-log camping-adventure-story; do
  echo -n "$slug: "
  curl -sL "https://${slug}--og.prod-v2.vibesdiy.net/" | grep -oE '"fsId":"[^"]+"'
done
```

All must show `"fsId":"z..."` (a real CID, not `"pending"`). Re-generate with a fresh slug if any are stuck.

---

## Phase 4 — Build the Page

1. Copy `src/pages/block-party.hbs` as a starting point
2. Rename to `src/pages/camping.hbs`
3. Update frontmatter: title, description, ogUrl, source, apps array (5 apps above)
4. Replace all CSS with WPA poster skin (see spec for tokens and design notes)
5. Run `pnpm check` — fix any template errors
6. `open _site/camping.html` — verify page looks right

---

## Phase 5 — OG Screenshot + Index Updates

```sh
# Add 'camping' to SLUGS array in screenshot-pages.js, then:
pnpm check
node screenshot-pages.js
# → images/screenshots/camping.jpg
```

Add `"ogImage": "https://good.vibes.diy/images/screenshots/camping.jpg"` to frontmatter.

Update `src/pages/index.hbs` and `src/pages/about.hbs` with a camping card.

---

## Phase 6 — PR and Merge

```sh
pnpm check
npx prettier --write scripts/seed-parks.js  # non-hbs files only
git add src/pages/camping.hbs scripts/ images/screenshots/camping.jpg src/pages/index.hbs src/pages/about.hbs screenshot-pages.js
git commit -m "feat: camping audience page — 5 apps, WPA poster skin, NPS park finder"
git push -u origin <branch>
gh pr create ...
```

**Merge the PR before creating or activating any Meta ads for this page.**

---

## Phase 7 — Meta Ads (after PR is merged)

Follow `agents/full-audience-playbook.md` Phase 11+ for ad creation.
Always create ads as ACTIVE at $10/day per `agents/ad-copy-rules.md`.
