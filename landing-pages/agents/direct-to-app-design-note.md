# Design Note: Direct-to-App Campaigns

When an app IS the landing page, it needs to do the landing page's job in its first screen.

## The gap (as of June 2026)

Our best landing pages fill the viewport with personality:

| Landing page | Hero text | Energy |
|---|---|---|
| Bridesmaids | "You're not in the wedding. You **ARE** the wedding." | Punchy, specific, identity |
| Garage Sale | "One link. Everyone's in. No group chat needed." | Problem → solution in one breath |
| Camping | "**BUILT FOR THE TRAIL.**" | Bold, physical, aspirational |
| Carnival | "**FREE CARNIVAL GAMES**" (neon, 60% of viewport) | Pure fun, zero friction |
| Free Library | "Apps for neighbors who **share things.**" | Warm, communal, italic accent |
| Save the Date | "Save the Date" + editorial subhead about pre-invitation chaos | Elegant, relatable stress |

Our apps, by contrast, open with a small navbar and jump straight into the tool:

| App | First screen | Problem |
|---|---|---|
| Book Exchange Log | 40px green bar → list of books | No hook — looks like a spreadsheet |
| Guest Address Book | "Address Roundup" → form fields | Immediately asks for work |
| Live Run Sheet | Tiny "RUN OF SHOW" → cue board | Great for users, bad for first impressions |
| Garage Sale Coordinator | "Block Sale Board" → sign-up form | The broadsheet theme is strong but the header is tiny |

## What to fix

### 1. Hero that fills the first screen

The app's title/header area should take up at least 40% of the viewport on first load. Not just bigger text — a full visual moment with background color/image, headline, and subtext before any interactive elements.

**Pattern:** Unsplash photo background with dark overlay, or a bold solid-color hero block matching the app's theme.

### 2. Headlines that sell the experience, not the tool

Bad: "Book Exchange Log" / "Address Roundup" / "Run of Show"
Good: "What's in the box right now." / "Addresses collected. You didn't text a soul." / "Every cue. Every crew member's phone."

The headline should describe the **moment** or **outcome**, not the **feature**. Match the tone of the landing page that drove traffic to this app.

### 3. Fun, specific action text

Bad: "Submit" / "Add" / "Review address" / "Add my spot"
Good: "Drop a book" / "I'm in" / "Fire Q1" / "Claim my table"

Action text should name the real-world action, not the database operation. Verbs should be physical and specific to the domain.

### 4. Subtext that earns the click

Below the headline, one sentence that mirrors the landing page's editorial voice:

- Book Exchange Log: "Track what's in the little free library — leave a book, grab a book, see what's new."
- Guest Address Book: "You announced a date. Now collect sixty addresses without a single group text."
- Garage Sale Coordinator: "One link to sign up every neighbor. Saturday, you just sell."

### 5. Visual identity from first pixel

Each app already has a theme (broadsheet, terminal, hearth, etc.) but most themes allocate visual budget to the content area, not the hero. For direct-to-app campaigns, the hero IS the content area — it needs to carry the theme's full personality before the user scrolls.

## Reference: what works in ads

From our campaign data, the highest-performing combinations share:

- **High CTR (3.7%+):** Landing pages with headlines that name a specific situation ("You announce a date. Then begins the quiet chaos...")
- **High LPV (12%+):** Pages where the spotlight app is immediately visible and the CTA is one clear action
- **Cheapest CPC ($0.13):** Camping pages — outdoor/activity themes with warm, specific copy

The pattern: **specificity + personality + low friction = clicks that convert**.

## Applying this to App.jsx upgrades

When editing an app for direct-to-app campaigns:

1. Add an Unsplash hero background with a person doing the activity (see `agents/unsplash-app-upgrade.md`) — faces make ads human and stop thumbs
2. Increase the title/header to fill 40%+ of first viewport
3. Rewrite the headline from tool-name to experience-description
4. Rewrite button text from generic to domain-specific
5. Add one line of editorial subtext below the headline
6. Keep all existing functionality intact below the hero
