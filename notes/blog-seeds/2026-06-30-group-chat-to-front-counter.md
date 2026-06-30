# From the group chat to the front counter: repositioning without losing the voice

Source: `claude/messaging-smb-market-alignment-els8p7`

The whole front-door message was social-only — "make apps with your friends,"
"impress the group chat," six hobby/social use-cases on the About page, and ~95%
personal/expressive starter prompts. Meanwhile the real custom-software demand the
market actually buys is operational: take the order, take the payment, replace the
spreadsheet, show me the dashboard, give the customer a portal, count the inventory.
And the brand's own research says the *weakest* offer is the generic "we build apps"
— which "make apps" is a cousin of.

The fix was deliberately *additive, not a pivot.* We kept every owned line and the
informal voice intact, and anchored each beat to a job-to-be-done in the same tone:
"Impress the group chat. Run the front counter." / "Takes the order. Takes the
payment." / "Kill the spreadsheet." The biggest hole was money — nothing across any
surface mentioned commerce, the single most credible "real tool, not a toy" signal —
so a green "takes the order / takes the payment" beat went onto the About page and a
batch of SMB starter prompts (order form, specials board, invoicing, CRM, work
orders, inventory, time clock, dashboards) went into the homepage suggestion library,
tuned so ≥40% of prompts are operational.

The trade-off worth a post: the danger of chasing the spreadsheet-heavy SMB is
waking up sounding like every B2B SaaS page (workflow automation, digital
transformation). That register *is* the "we build apps" trap wearing a tie. The
guardrail we wrote into `how-to-talk-about-vibes.md`: two audiences, one voice, never
SaaS-speak — and note that "private by default, you choose who can read/write/open"
was already a latent SMB trust asset, framed socially. Same control, two audiences,
one sentence.

Gotcha for the next person: `landing-pages` has no `puppeteer` installed, so
`scripts/blog-card.js` can't run in a cloud session. Worked around it by driving the
Playwright Chromium binary (`/opt/pw-browsers/chromium-*/chrome-linux/chrome`)
directly with `--headless --screenshot --window-size=1600,900`, reusing the script's
exact card HTML with the photo inlined as base64. Output is PNG (chromium headless
has no JPEG flag and there's no ImageMagick/sharp), so the post references `card.png`
rather than the usual `card.jpg`.
