# earnings-rehearsal

> Earnings Call Rehearsal Cards — for IR teams prepping the CEO/CFO for an earnings call. The user creates a deck of Q&A cards: each card has a question, a short answer (the prepared reply), a key talking points list (3 bullets), and a difficulty 1–5. Cards are saved as Fireproof docs. Rehearsal mode: shuffles the deck, shows one card front (just the question) with a [ REVEAL ] button; tapping shows the answer and bullets. Below: [ NAILED IT ] / [ NEEDS WORK ] / [ SKIP ] buttons that record outcomes per card per session. After running through, the app shows a session summary: nailed/needs-work counts, the questions still flagged needs-work, and average self-score. A persistent left rail lists all cards by difficulty, sortable. Filter by topic tag. Export the full deck to clipboard as plain text. Tone: dry IR rehearsal tool — not gameified, just clear. STYLE — Broadsheet. Body font Helvetica Neue / Helvetica / Arial sans-serif. Background pure white #fff, foreground pure black #000, single hairline borders 1px solid #000 between every grid cell. NO rounded corners anywhere — every box, button, input, and card is sharp-cornered. Layout in a max-width 1000px column with a vertical 1px black border on the left and right of the page. Hero uses a 200px / 1fr / 200px three-column band with thin black borders, a giant outline-only display headline (font-size clamp(3rem,10vw,8rem), font-weight 900, -webkit-text-stroke 2px #000, color transparent, letter-spacing -0.04em, uppercase). Section headers are tiny: font-size 0.55rem–0.7rem, font-weight 700, uppercase, letter-spacing 0.08–0.12em. Filled section labels use background #000 / color #fff. Tables use a strict CSS grid: each row is a grid-template-columns line with 1px black row borders and 1px black cell borders; row hover inverts to bg:#000 color:#fff. Forms use bottom-bordered inputs only (border:none; border-bottom:1px solid #000; transparent bg) with tiny uppercase labels. Buttons are square: padding 0.75rem 1.5rem, background:#fff, 1px solid #000, color #000, uppercase 0.65rem 700-weight letter-spacing 0.08em, hover inverts to bg:#000 color:#fff. Checkboxes are 16px black-bordered squares that fill black when checked. Toggles are 36×18 black-bordered tracks with a 12×12 sliding knob. NO color outside #000, #fff, and #666 for muted secondary text. NO emoji or icons — use small black SVG strokes or simple unicode arrows (›, →, ▲) where needed. Persist all writes as Fireproof docs via useFireproof; render past entries below the form as a strict bordered table. Single-file React.

Live at [https://vibes.diy/vibe/theme/earnings-rehearsal](https://vibes.diy/vibe/theme/earnings-rehearsal)

Single-file React app built with [vibes.diy](https://vibes.diy). Visit the live url to manage access.

## Run it

```sh
npx vibes-diy push     # uploads App.jsx, prints a live HTTPS URL
```

Edit [App.jsx](App.jsx) and push again to iterate.

## Commands

- `npx vibes-diy push` — deploy the current directory
- `npx vibes-diy push --instant-join` — deploy with auto-accept sharing
- `npx vibes-diy generate "prompt"` — generate a new app from a prompt
- `npx vibes-diy help` — full command list
