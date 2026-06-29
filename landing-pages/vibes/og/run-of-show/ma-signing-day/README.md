# ma-signing-day

> M&A Signing-Day Script — choreography for signing day, when lawyers, bankers, PR, and EAs are on a 4-hour clock. The user sets up the day as a numbered task list: each task has a description, owner, dependencies (which task IDs must complete first), expected duration in minutes, and current status (PENDING / IN PROGRESS / BLOCKED / DONE). Saving writes a Fireproof doc per task. The home view is a tightly-bordered grid: column 1 task number, 2 description, 3 owner, 4 deps satisfied? (✓ or ✗), 5 status, 6 elapsed. Tasks unlock in real-time as their deps complete. Owners click a [ START ] button on their row which writes a status doc and starts an elapsed timer; clicking [ DONE ] writes a completion. A live banner across the top shows: NEXT BLOCKED, TASKS REMAINING, ELAPSED OF 4:00. A drift alarm fires (visual, not audio) if total elapsed exceeds budget. Below: a chronological audit log of every status change with timestamp and actor. STYLE — Broadsheet. Body font Helvetica Neue / Helvetica / Arial sans-serif. Background pure white #fff, foreground pure black #000, single hairline borders 1px solid #000 between every grid cell. NO rounded corners anywhere — every box, button, input, and card is sharp-cornered. Layout in a max-width 1000px column with a vertical 1px black border on the left and right of the page. Hero uses a 200px / 1fr / 200px three-column band with thin black borders, a giant outline-only display headline (font-size clamp(3rem,10vw,8rem), font-weight 900, -webkit-text-stroke 2px #000, color transparent, letter-spacing -0.04em, uppercase). Section headers are tiny: font-size 0.55rem–0.7rem, font-weight 700, uppercase, letter-spacing 0.08–0.12em. Filled section labels use background #000 / color #fff. Tables use a strict CSS grid: each row is a grid-template-columns line with 1px black row borders and 1px black cell borders; row hover inverts to bg:#000 color:#fff. Forms use bottom-bordered inputs only (border:none; border-bottom:1px solid #000; transparent bg) with tiny uppercase labels. Buttons are square: padding 0.75rem 1.5rem, background:#fff, 1px solid #000, color #000, uppercase 0.65rem 700-weight letter-spacing 0.08em, hover inverts to bg:#000 color:#fff. Checkboxes are 16px black-bordered squares that fill black when checked. Toggles are 36×18 black-bordered tracks with a 12×12 sliding knob. NO color outside #000, #fff, and #666 for muted secondary text. NO emoji or icons — use small black SVG strokes or simple unicode arrows (›, →, ▲) where needed. Persist all writes as Fireproof docs via useFireproof; render past entries below the form as a strict bordered table. Single-file React.

Live at [https://vibes.diy/vibe/theme/ma-signing-day](https://vibes.diy/vibe/theme/ma-signing-day)

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
