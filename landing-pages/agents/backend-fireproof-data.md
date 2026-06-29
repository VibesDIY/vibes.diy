# Backend Fireproof Data — Pattern Runbook

Use this pattern when a Vibes app needs a substantial read-only dataset without shipping an API key in the deployed app.

## When to Use

- Data comes from an external API that requires a key
- Dataset is too large to type by hand but small enough to embed in a prompt after trimming (~10–15KB max)
- Users need offline access after first load
- Data changes infrequently (update by re-seeding + re-generating the app)

## Pattern

### 1. Local seed script (never deployed)

- Reads API key from env var only — never hard-code it
- Fetches from the external API, normalizes to a lean schema (only fields the app needs)
- Writes two files:
  - `scripts/<name>-data.json` — full dataset for reference
  - `scripts/<name>-data-slim.json` — top N records, trimmed fields, target under 15KB

### 2. Build the Vibes app prompt

Embed the slim JSON into the app prompt:

```bash
cat > vibes/<cluster>/app-prompt.txt << 'HEADER'
<App description>. Hard-code this exact array as a JavaScript const DATA:
HEADER
cat scripts/<name>-data-slim.json >> vibes/<cluster>/app-prompt.txt
cat >> vibes/<cluster>/app-prompt.txt << 'FOOTER'
<Rest of prompt: Fireproof seeding instructions, UI, design skin>
FOOTER
```

Then generate:
```bash
npx vibes-diy@latest generate --user-slug=og --app-slug="<slug>" \
  "$(cat vibes/<cluster>/app-prompt.txt)"
```

### 3. Fireproof seeding in the app

Tell the app in the prompt:

> On first render, check Fireproof for a "__seeded" record. If absent, bulk-insert all DATA records with `db.put(item.id, item)`, then `db.put("__seeded", {v:1})`. All queries run against Fireproof — no runtime network calls.

### 4. Verification

After generate + deploy, confirm the app is real (not a stub):

```bash
curl -sL https://<slug>--og.prod-v2.vibesdiy.net/ | grep -oE '"fsId":"[^"]+"'
# Must show "fsId":"z<CID>" — not "pending"
```

Then open the app and verify data loads (filter/search works with real records).

## Prompt Size Limits

The vibes-diy CLI handles long prompts but performance can degrade above ~20KB total.
Keep the embedded JSON under 15KB by:
- Limiting to top 40 records in the slim file
- Truncating descriptions to 150 chars
- Dropping redundant or unused fields

## Example: NPS Park Finder

- **Seed script:** `scripts/seed-parks.js` — fetches from `developer.nps.gov/api/v1/parks`
- **Full output:** `scripts/parks-data.json` (63 parks, ~80KB)
- **Slim output:** `scripts/parks-data-slim.json` (40 parks, ~12KB)
- **App:** `national-park-search` — park finder, topo map skin, filters by state and activity
- **API key in app?** No — key only in `NPS_API_KEY` env var for the seed script
