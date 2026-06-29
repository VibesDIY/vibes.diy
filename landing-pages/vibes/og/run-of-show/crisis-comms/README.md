# crisis-comms

> Crisis Comms Live Playbook — choreography for the first 6 hours of a corporate crisis (PR, legal, exec). The user opens the app, names the incident, and the playbook auto-creates a fixed task list: T+0 ASSESS, T+15 LEGAL HOLD, T+30 EXEC ALIGN, T+45 EMPLOYEE NOTICE DRAFT, T+1H FIRST EXTERNAL STATEMENT, T+2H CUSTOMER NOTICE, T+4H PRESS BRIEFING, T+6H POST-MORTEM. Each row has owner (assigned at start), status, and a notes field. The clock starts immediately on incident open. Statuses are written as Fireproof docs with timestamps. A side panel decision log lets any role drop a one-line decision tagged with a category (LEGAL / EXEC / COMMS / HR). A second tab approved language stores the canonical drafted statements (Fireproof docs of statement-version + approver + timestamp). The home grid is two columns: incident timeline (left) and decision log (right), with a top banner showing TIME ELAPSED and OPEN DECISIONS count. STYLE — Broadsheet. Body font Helvetica Neue / Helvetica / Arial sans-serif. Background pure white #fff, foreground pure black #000, single hairline borders 1px solid #000 between every grid cell. NO rounded corners anywhere — every box, button, input, and card is sharp-cornered. Layout in a max-width 1000px column with a vertical 1px black border on the left and right of the page. Hero uses a 200px / 1fr / 200px three-column band with thin black borders, a giant outline-only display headline (font-size clamp(3rem,10vw,8rem), font-weight 900, -webkit-text-stroke 2px #000, color transparent, letter-spacing -0.04em, uppercase). Section headers are tiny: font-size 0.55rem–0.7rem, font-weight 700, uppercase, letter-spacing 0.08–0.12em. Filled section labels use background #000 / color #fff. Tables use a strict CSS grid: each row is a grid-template-columns line with 1px black row borders and 1px black cell borders; row hover inverts to bg:#000 color:#fff. Forms use bottom-bordered inputs only (border:none; border-bottom:1px solid #000; transparent bg) with tiny uppercase labels. Buttons are square: padding 0.75rem 1.5rem, background:#fff, 1px solid #000, color #000, uppercase 0.65rem 700-weight letter-spacing 0.08em, hover inverts to bg:#000 color:#fff. Checkboxes are 16px black-bordered squares that fill black when checked. Toggles are 36×18 black-bordered tracks with a 12×12 sliding knob. NO color outside #000, #fff, and #666 for muted secondary text. NO emoji or icons — use small black SVG strokes or simple unicode arrows (›, →, ▲) where needed. Persist all writes as Fireproof docs via useFireproof; render past entries below the form as a strict bordered table. Single-file React.

Live at [https://vibes.diy/vibe/theme/crisis-comms](https://vibes.diy/vibe/theme/crisis-comms)

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
