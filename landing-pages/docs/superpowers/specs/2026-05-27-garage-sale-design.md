# Garage Sale Page Design

**Date:** 2026-05-27  
**Path:** `/garage-sale`  
**Source tag:** `garage-sale`

## Goal

A landing page targeting neighborhood garage-sale organizers — the person who already volunteered. The spotlight app solves their biggest pain: getting neighbors signed up without running a group chat. Supporting apps cover individual sellers (shareable listing URL), thrift buyers (shareable find cards with ratings), day-of logistics (gear checklist, cash tracking).

## Psychographic

**Primary:** The coordinator who stepped up. Already committed to running the sale; needs tools, not convincing. Ad copy: "One link. Everyone's in. No group chat needed."

**Secondary (below fold):** Individual sellers wanting a shareable URL; thrifters who want to show off finds.

## Apps (5 total)

### 01 — The Coordinator (spotlight)
- **Slug:** `group-sale-signup`
- **Title:** The Coordinator
- **Tagline:** One link. Everyone's in.
- **Theme:** `broadsheet`
- **Prompt:** Neighborhood garage sale coordinator app. Organizer creates a sale event with date, address, and neighborhood name. Neighbors sign up with: name, table or blanket spot preference (first-come), what category of stuff they're selling (clothes, toys, tools, misc), whether they need change from the organizer. Shows a live participant list and a count of spots claimed. Shared link, no login.
- **Fork line:** Running a multi-block sale with assigned street sections? Clone it and add a street-segment field to each signup.

### 02 — Sale Poster
- **Slug:** `yard-sale-listing`
- **Title:** Sale Poster
- **Tagline:** Your sale. One link. Share anywhere.
- **Theme:** `poster`
- **Prompt (CLI — trim to <50 words):** Yard sale listing app. Fill in address, date, hours, item categories. Each listing gets a `?listing=doc._id` shareable URL that shows a clean sale-day card with address, hours, a Google Maps link, and the item list. No login.
- **Fork line:** Selling at a flea market stall instead of your driveway? Clone it and change the address field to stall number and venue name.

### 03 — Rate My Thrift
- **Slug:** `rate-my-thrift`
- **Title:** Rate My Thrift
- **Tagline:** Show off the find. Let the crowd judge.
- **Theme:** `vault`
- **Prompt:** Thrift find sharing app with URL-based item routing. Users post a find: photo upload, item name, price paid, where they found it, a one-line brag. Each submitted item gets a shareable URL via `?item=doc._id` query param. On load, parse `window.location.search` for `?item=`; if present, show that single item in hero view with emoji reaction buttons (🔥 steal, 💎 gem, 😬 overpaid, 🤌 perfect). If no `?item=` param, show the full community feed with a "Post your find" CTA. Dark photo-forward layout.
- **Fork line:** Running a vintage market and want only your vendor's finds visible? Clone it and add a vendor filter to the feed.

### 04 — Gear List
- **Slug:** `sale-day-checklist`
- **Title:** Gear List
- **Tagline:** Tables, signs, bags — claimed or needed.
- **Theme:** `terminal`
- **Prompt:** Group garage sale equipment tracker. Shared list of items needed: folding tables (how many), folding chairs, extension cords, price sticker rolls, grocery bags, poster board + markers, cash box. Each item: quantity needed, who's bringing it, quantity they're contributing. Shows what's still unclaimed. Anyone with the link can claim items. No login.
- **Fork line:** Hosting an estate sale with a professional setup list? Clone it and update the item list to match your specific needs.

### 05 — Cash Box
- **Slug:** `cash-box-tracker`
- **Title:** Cash Box
- **Tagline:** Who sold what. Split at the end.
- **Theme:** `proof`
- **Prompt:** Multi-seller cash tracking app for group garage sales. Each seller registers their name at the start. During the sale, anyone records a transaction: seller name, item description, amount. Running total per seller shown live. End-of-day summary shows each seller's total and the split from the shared cash box. No login, shared link for the whole group.
- **Fork line:** Splitting proceeds with a charity? Clone it and add a charity percentage field that comes off the top before splitting.

## Visual Skin

**Broadsheet** — newspaper/classifieds grid aesthetic. Black and white, bold headline type, column layout. Feels like a community flyer. Differentiates from the colorful audience pages.

Typography: system serif for headlines (or `Playfair Display`), monospace for numbers/prices, sans for body.

Background: off-white (`#f5f0e8` or similar newsprint tone), black rule lines, no drop shadows.

## Page Structure

1. **Hero / spotlight** — "One link. Everyone's in. No group chat needed." + spotlight screenshot + single CTA "Start the sign-up"
2. **Gallery** (4 cards) — Sale Poster, Rate My Thrift, Gear List, Cash Box — each with Join + Clone + Remix
3. **Closing CTA** — "Build your own sale tool" prompt link

## Layout: `webring` (custom skin inline)

## Frontmatter

```json
{
  "layout": "webring",
  "title": "For Garage Sales | Vibes DIY",
  "description": "The Coordinator, Sale Poster, Rate My Thrift, Gear List, Cash Box. Five apps for the person running the neighborhood sale.",
  "ogUrl": "https://good.vibes.diy/garage-sale/",
  "source": "garage-sale"
}
```

## Wire-in

- Add card to `src/pages/index.hbs` (newest first)
- Add to `screenshot-pages.js` slugs list
- Capture `images/screenshots/garage-sale.jpg` after build

## Prompt length strategy

- `rate-my-thrift` → full detailed spec (500+ words) — the `?item=doc._id` routing is a precise technical requirement
- All other 4 apps → trim to under 50 words for CLI — remove elaboration, keep only the core noun + verb + fields + sharing mechanism
- Never use the 100-150 word middle range — it underspecifies without the benefit of brevity

## Key constraints

- Always `--user-slug og` in the run script
- Never run prettier on `.hbs` files
- Verify each deploy with `curl ... | grep -E "fsId|mountVibe"` before building the page
