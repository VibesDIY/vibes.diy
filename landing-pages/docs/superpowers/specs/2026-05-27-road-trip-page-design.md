# Road Trip Landing Page — Design Spec

**Date:** 2026-05-27
**Page slug:** `road-trip`
**File:** `src/pages/road-trip.hbs`
**Layout:** `webring` (full self-contained chrome, no standard header/footer wrapper)

---

## Audience

**Psychographic:** People drawn to the van life aesthetic as a coherent lifestyle brand — TikTok van life content consumers who find the aesthetic as appealing as tradwife content, i.e. it's a *vibe*, not necessarily a lived commitment. They love the romance of the road: the freedom, the spontaneity, the people you meet when you go somewhere without a plan.

**Not:** hardcore full-time van lifers with specific gear needs. The page speaks to the romance, not the logistics.

**URL:** `https://good.vibes.diy/road-trip`
**Mailchimp source tag:** `road-trip`

---

## Visual Design

### Palette — Campfire Dusk

| Var | Hex | Use |
|-----|-----|-----|
| `--dark` | `#1A130E` | Nav, card backgrounds, deep sections |
| `--walnut` | `#2B2018` | Page background |
| `--ember` | `#E8A87C` | Accent text, links, italic headline color |
| `--cream` | `#F5D5A0` | Primary body text, headlines |
| `--terra` | `#C45C2A` | Badge, tag backgrounds, CTA button |
| `--sage` | `#4A7A5E` | Secondary accent, available for variation |
| `--ash` | `#7A6A5A` | Muted/secondary text |

### Typography

- **Serif:** `Playfair Display` (Google Fonts) — headlines, italic accents, quote section
- **Sans:** `Inter` (Google Fonts) — body, tags, badges, CTA

### Aesthetic

Dark walnut background, warm ember accents, editorial serif headlines. Van life TikTok: curated and aspirational, not granola. Full-bleed hero photo with heavy dark overlay + gradient fade to page background. No white — all light tones are cream/amber.

---

## Page Sections

### 1. Nav
Sticky, `--dark` background, 1px ember border-bottom. Centered `Vibes DIY` in Playfair Display italic, ember color.

### 2. Hero
- Full-bleed Unsplash photo: open highway to mountains (`photo-1469854523086-cc02fe5d8800`), `brightness(0.4) saturate(0.75)` filter
- Gradient overlay: transparent → `--walnut` from 20% to 100% (hero bleeds into page)
- Content overlaid at bottom-center:
  - Badge: `VAN LIFE APPS` — terracotta pill
  - Headline: `The road finds` / `*its people.*` — Playfair Display 4rem, italic em in ember
  - Sub: `Apps for the romance of the road — trade routes, share resources, and relax around the same fire.`
  - CTA: `Browse the apps →` — ember background, dark text, 4px radius

### 3. Apps Grid
Label: `Five apps, one vibe` / Title: `Everything the road gives you.` (italic Playfair)

Grid layout:
- **Row 1:** Signpost — spans full width, photo left + text right (2-col card)
- **Row 2:** Road Party + The Fill-Up — 2-col
- **Row 3:** Who You Met + The Weird One — 2-col

Each card: `--dark` background, `rgba(232,168,124,0.2)` border, 8px radius. Photo with `brightness(0.5) saturate(0.65)`. Tag pill (terracotta tint), title (Playfair), desc (ash), link (ember).

### 4. Quote Section
`--dark` background, bordered top/bottom. Centered Playfair italic quote:
> "You don't plan a road trip. You just leave and let the road plan itself around you."
> — the road, basically

### 5. Footer
Inline (webring layout has no partial access). Logo link → `https://links.vibes.diy/homepage`, social icon links (Discord, YouTube, Bluesky using `links.vibes.diy` redirector), copyright line. Dark background, ember icon color.

---

## The Five Apps

All apps use `--user-slug=og`. SEO-style slugs (descriptive, not branded).

### App 1 — Signpost
- **Slug:** `road-signpost`
- **Tag:** Route Advice
- **Unsplash card photo:** `photo-1476041800959-2f6bb412c8ce` (desert highway)
- **On-brief prompt:** Community corkboard for road travelers. Each entry: a location name, a short tip (one to three sentences), and an optional direction note ("2 miles past the junction, left fork"). Entries sorted newest first. No accounts — just add and share. Van life aesthetic: dark background, warm amber text, minimal UI.
- **Upgrade target:** Broaden tip types beyond van lifer secrets — any road find works (great diner, scenic overlook, avoid this stretch of I-40, best gas prices in 50 miles).

### App 2 — Road Party
- **Slug:** `road-party-finder`
- **Tag:** Gather
- **Unsplash card photo:** `photo-1504280390367-361c6d9f38f4` (campfire)
- **On-brief prompt:** Spontaneous gathering coordinator for van lifers. Post: spot name, date/time, "still here until" field. Anyone with the link can tap to say they're coming. Live list of who's in. No accounts, offline-first with Fireproof. Dark campfire aesthetic.
- **Upgrade target:** Works for any group road trip stopover — not just campers. "We're at [rest stop] for 2 hours" is equally valid.

### App 3 — The Fill-Up
- **Slug:** `road-resource-share`
- **Tag:** Resource Share
- **Unsplash card photo:** `photo-1558618666-fcd25c85cd64` (camp supplies)
- **On-brief prompt:** Crowdsourced van lifer resource finder. Add a spot: type (water / electricity / dump station / free overnight), location name, brief note. Browse by type. Fireproof for offline persistence. Warm dark aesthetic.
- **Upgrade target:** Broaden resource types to include: gas prices, clean restrooms, good coffee, free wifi, scenic pullout, EV charging — anything useful to any road tripper.

### App 4 — Who You Met
- **Slug:** `road-encounters`
- **Tag:** People
- **Unsplash card photo:** `photo-1522202176988-66273c2fd55f` (people talking)
- **On-brief prompt:** Personal travel journal of people encountered on the road. Each entry: name, where you crossed paths, one thing you remember. Entries in reverse chronological order. Private (local Fireproof, no sharing). Warm intimate aesthetic, campfire palette.
- **Upgrade target:** Add optional share link per entry — send to the person you met so they can add their own memory of the crossing.

### App 5 — The Weird One
- **Slug:** `route-advisor`
- **Tag:** Decide
- **Unsplash card photo:** `photo-1500534314209-a25ddb2bd429` (person with map at golden hour)
- **On-brief prompt:** Van life route chooser. Enter: where you are now, roughly where you're heading. Get three route options with personality labels: The Fast One, The Beautiful One, The Weird One. Each gets a two-sentence description of what to expect. Fireproof saves your last three queries. Minimal, atmospheric UI.
- **Upgrade target:** Add trip context selector (solo / couple / group / with kids) to tune the route personality descriptions toward more relevant suggestions.

---

## Generation Script

`vibes/road-trip/_run.sh` — 5 parallel `gen()` calls, each backgrounded, logging to `_status.log`. Standard pattern from `agents/batch-landing-pages.md`.

Verify all 5 with `fsId: z<CID>` (not `pending`) before building the `.hbs` page.

---

## Upgrade Cycle

After initial generation and page launch, run `agents/improve-app-via-screenshot.md` for each app with these specific upgrade targets:

| App | Upgrade goal |
|-----|-------------|
| Signpost | Accept any road tip type, not just hidden gems |
| Road Party | Work for any scheduled stop, not just camping |
| The Fill-Up | Add general road tripper resource types |
| Who You Met | Add optional share-link per entry |
| The Weird One | Add trip-context selector for tuned suggestions |

Upgrade cycle goal: same aesthetic skin, broader accessible workflow. No brand changes.

---

## Build Checklist

1. Generate 5 apps in parallel (`vibes/road-trip/_run.sh`)
2. Verify all `fsId` are real CIDs
3. Create `src/pages/road-trip.hbs` — `webring` layout, inline CSS, frontmatter with `apps` array
4. `pnpm check` — verify build
5. `open _site/road-trip.html` — visual check
6. Add `road-trip` to `screenshot-pages.js`, run `node screenshot-pages.js`
7. Add `"ogImage"` to frontmatter
8. Update `src/pages/index.hbs` and `src/pages/about.hbs` with road-trip card
9. `pnpm check` + prettier on non-hbs files + commit
