# Runbook: Keep about.hbs and index.hbs up to date

Run this after adding any new page to the site.

## What needs updating

### 1. `src/pages/about.hbs` — the site directory

Find the right section and add a `dir-card` or `list-item` entry:

| New page type | Section in about.hbs | Element to add |
|---|---|---|
| Top-level audience page (`src/pages/*.hbs`) | **Audience Pages** two-col list | `<a class="list-item" href="<slug>.html">` |
| Featured app gallery (`featured-apps/`) | **Featured App Galleries** dir-grid | `<a class="dir-card" href="featured-apps/<slug>.html">` |
| Edu cluster (`edu/<slug>.hbs`) | **Edu** dir-grid | `<a class="dir-card" href="edu/<slug>.html">` |
| Expressions cluster (`expressions/<slug>.hbs`) | **Expressions** dir-grid | `<a class="dir-card" href="expressions/<slug>.html">` |
| Mind Games category (`mind-games/<slug>.hbs`) | No about entry needed — hub handles it |
| New top-level section (games, arcade, mind-games, etc.) | **Games & Arcade** dir-grid or new section | `<a class="dir-card" href="<slug>/index.html">` |

**dir-card template:**
```html
<a class="dir-card" href="<path>">
  <div class="dc-label"><category or count></div>
  <div class="dc-title"><Display Name></div>
  <div class="dc-desc"><One sentence description.></div>
  <span class="dc-cta"><Action> →</span>
</a>
```

**list-item template (audience pages):**
```html
<a class="list-item" href="<slug>.html">
  <span class="li-name"><Display Name></span>
  <span class="li-desc"><Short phrase description></span>
  <span class="li-arrow">→</span>
</a>
```

### 2. `src/pages/index.hbs` — the homepage collection grid

Add a `collection-card` for any new **top-level section** (not for individual audience pages — those are already handled by the landing-card grid lower on the page).

Pick or add an accent color class. Existing classes: `cc-teal`, `cc-acid`, `cc-forest`, `cc-ruby`, `cc-signal`, `cc-orange`, `cc-bluey`, `cc-green`, `cc-tomato`, `cc-amber`, `cc-violet`.

To add a new accent color, insert a CSS block near line 250 in index.hbs:
```css
.cc-<name> .collection-card-accent { background: <hex>; }
.cc-<name> .collection-badge { background: <light-hex>; border-color: <hex>; color: <dark-hex>; }
.cc-<name> .collection-cta { color: <hex>; }
```

**collection-card template:**
```html
<a href="<path>/" class="collection-card cc-<color>">
    <div class="collection-card-accent"></div>
    <div class="collection-card-body">
        <div class="collection-card-top">
            <div class="collection-card-icon"><emoji></div>
            <span class="collection-badge"><N> <things> live</span>
        </div>
        <h2><Section Name></h2>
        <p><One or two sentence description.></p>
        <span class="collection-cta"><Action> →</span>
    </div>
</a>
```

### 3. `src/pages/mind-games/index.hbs` — the Mind Games hub

If adding a new Mind Games category, add a `.tile` card to the hub grid:
```html
<a href="<slug>.html" class="tile">
  <div class="thumb">
    <img src="https://<first-app-slug>--jchris.prod-v2.vibesdiy.net/screenshot.jpg" alt="<Category> preview" loading="lazy"/>
  </div>
  <div class="body">
    <h2><Category Name></h2>
    <p><One sentence tagline.></p>
    <span class="count">4 variations</span>
  </div>
</a>
```

## After making updates

```sh
pnpm check   # verify all pages build
```

Open the affected pages to spot-check links.
