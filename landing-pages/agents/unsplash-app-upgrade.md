# Unsplash App Upgrade

Add a relevant Unsplash background photo to a deployed vibes.diy app, making it visually richer for direct-to-app ad campaigns (no landing page in front).

**Read [`agents/direct-to-app-design-note.md`](direct-to-app-design-note.md) first** — it documents the gap between our landing pages (big heroes, fun copy, editorial personality) and our apps (small headers, tool-first, generic buttons). The photo is just one piece; the hero also needs a bigger headline, experience-first copy, and specific action text.

## Why

Apps going straight into Meta ads need to look polished on first load. A topical Unsplash hero photo gives immediate visual context — the viewer understands what the app is about before reading a word.

## Prerequisites

- App.jsx pulled locally to `vibes/direct-ads/<slug>/App.jsx`
- CLI tools available:
  ```
  TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
  MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
  ```

## Step 1 — View current app

```sh
curl -sfL "https://<slug>--<author>.prod-v2.vibesdiy.net/screenshot.jpg" -o /tmp/<slug>.jpg
wc -c /tmp/<slug>.jpg && file /tmp/<slug>.jpg
```

Read `/tmp/<slug>.jpg` visually. Note: what the app does, current color scheme, whether it already has imagery.

Read the App.jsx to understand the component structure and current styling.

## Step 2 — Find an Unsplash photo

Search for a photo that matches the app's real-world context (the activity, not the UI):

```
WebSearch "unsplash <keyword> photo" (allowed_domains: ["unsplash.com"])
→ get search page URL like unsplash.com/s/photos/<keyword>

WebFetch that search page
→ get short IDs (e.g. bAf3r92aewQ) + alt text descriptions

WebFetch unsplash.com/photos/<short-ID> for the best candidate
→ get the REAL CDN URL: images.unsplash.com/photo-<numeric-id>
```

**Critical:** Short IDs from search results are NOT valid CDN paths — they 404. You must fetch the individual photo page to get the numeric CDN ID (e.g. `photo-1501631957818-9f4b96ca2b0f`).

**Photo selection criteria:**
- Match the real-world activity (camping gear → photo of a campsite, not a checklist)
- **Use photos with people/faces** — one person per app, doing the activity the app is about (reading a book, grilling at a campsite, setting up a party). Faces make ads feel human and stop thumbs.
- Dark or muted tones work best as backgrounds (bright photos need heavy overlay)
- Landscape orientation — these apps are viewed on phones and laptops

## Step 3 — Add attribution (required)

Unsplash requires photographer credit. Add this as the last child inside the hero section (which must have `position: 'relative'`):

```jsx
<div style={{
  position: 'absolute', bottom: '0.75rem', right: '1rem',
  fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)',
  textShadow: '0 1px 3px rgba(0,0,0,0.5)'
}}>
  Photo by <a href="https://unsplash.com/@USERNAME?utm_source=vibes_diy&utm_medium=referral"
    style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }}
    target="_blank" rel="noopener noreferrer">PHOTOGRAPHER NAME</a> on <a
    href="https://unsplash.com/?utm_source=vibes_diy&utm_medium=referral"
    style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }}
    target="_blank" rel="noopener noreferrer">Unsplash</a>
</div>
```

Get the photographer name and @username from the photo's Unsplash page (Step 2). Both links must include UTM referral params.

## Step 4 — Edit App.jsx

Add the Unsplash photo as a hero background or ambient visual. Three patterns, pick the one that fits:

### Pattern A: Full-page background (best for simple apps)

Add to the root container's style:

```jsx
backgroundImage: `linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.65)), url('https://images.unsplash.com/photo-<NUMERIC-ID>?w=1920&q=80&fit=crop')`,
backgroundSize: 'cover',
backgroundPosition: 'center',
backgroundAttachment: 'fixed',
```

Adjust text colors for contrast on dark overlay.

### Pattern B: Hero banner (best for apps with a header section)

Add a hero div above the main content:

```jsx
<div style={{
  background: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.7)), url('https://images.unsplash.com/photo-<NUMERIC-ID>?w=1920&q=80&fit=crop') center/cover`,
  padding: '3rem 1.5rem',
  color: 'white',
  textAlign: 'center'
}}>
  <h1>{title}</h1>
  <p>{subtitle}</p>
</div>
```

### Pattern C: Accent image (best for apps with existing strong design)

Add a `<img>` element in a natural spot (card header, sidebar, empty state):

```jsx
<img
  src="https://images.unsplash.com/photo-<NUMERIC-ID>?w=800&q=80&fit=crop&h=400"
  alt="descriptive alt text"
  style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px' }}
/>
```

### Editing guidelines

- Don't rewrite the whole component — add the photo integration to the existing structure
- Keep functional UI elements visible and usable
- Use `?w=1920&q=80&fit=crop` for backgrounds, `?w=800&q=80&fit=crop&h=400` for smaller images
- Always include a dark overlay on backgrounds for text readability
- Match overlay opacity to photo brightness: dark photo → 0.5, bright photo → 0.7+

## Step 5 — Push

```sh
cd /Users/jchris/code/landing-pages/vibes/direct-ads/<slug>
"$TSX" "$MAIN" push --user-slug <author>
```

Must run from inside the app directory.

## Step 6 — Verify

Wait ~8 seconds for screenshot to regenerate, then re-read:

```sh
sleep 8
curl -sfL "https://<slug>--<author>.prod-v2.vibesdiy.net/screenshot.jpg" -o /tmp/<slug>-after.jpg
wc -c /tmp/<slug>-after.jpg && file /tmp/<slug>-after.jpg
```

Read `/tmp/<slug>-after.jpg` to verify the photo is visible and the app still looks functional.

## Common pitfalls

| Symptom | Cause | Fix |
|---------|-------|-----|
| Photo not visible | Used short ID instead of numeric CDN ID | Re-fetch the photo page for the real URL |
| Text unreadable | Overlay too light for a bright photo | Increase overlay opacity to 0.7+ |
| App layout broken | Overwrote existing styles instead of extending | Revert; add photo styles alongside existing ones |
| Push no-op | File content identical (whitespace-only change) | Make a real change to the file |
| Photo loads slowly | Image too large | Use `?w=1200` instead of `?w=1920`; add `loading="lazy"` |
