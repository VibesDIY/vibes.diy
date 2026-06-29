#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/briefing-books"
cd "$HERE"

# Pin the publishing namespace explicitly so a stale `vibes-diy login`
# default (account swap, re-auth, CLI upgrade) cannot land deploys at the
# wrong user-slug. See src/pages/featured-apps/README.md for context.
USER_SLUG="og"

STYLE='STYLE — Dossier Card. Load Google Fonts: Archivo Black, Roboto Mono (display=optional). Body Roboto Mono 1rem (monospace). Display headings Archivo Black, uppercase, letter-spacing -0.02em (heavy slab-bold). Background bg oklch(0.16 0 0) (near-black). Card surfaces oklch(0 0 0) (pure black). Foreground oklch(1 0 0) (pure white). Border oklch(0.28 0.03 257) (cool blue-gray) 1px hairline. NO color outside black/white plus the cool blue-gray border tint and a single subtle accent stripe (use border tone for it). Sharp corners. Layout is a numbered briefing book: each section labeled "EXHIBIT 01 / EXHIBIT 02 / ..." in Archivo Black. Tables in Roboto Mono with clear cell borders. Buttons render as bordered rectangles "[ FILE ]" with Archivo Black uppercase text; hover inverts to white-bg black-text. Inputs: transparent with cool-blue-gray bottom border, mono caret. Tone: an executive briefing dossier — confidential, weighty, paper-binder feel. NO playful elements. Single-file React with useFireproof; persist briefings as numbered exhibit entries.'

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen recruiter-pipeline "Recruiter Pipeline Tracker — flat ATS doesn't fit each recruiter's flow. Each recruiter customizes their own stages (e.g. SOURCED / PHONE-SCREEN / TAKE-HOME / ONSITE / OFFER / CLOSED-WIN / CLOSED-LOSS). Add candidates with name, role, source, current stage, last-touch-date, next-action. Each stage move is a Fireproof doc. The home view: a strict pipeline table sorted by stage, with stale-candidates (no touch >7 days) flagged. A weekly metrics block: total in pipeline, moved this week, lost this week. Per-candidate detail page shows full audit log of stage moves. $STYLE"

gen account-plan-template "Sales Rep Account Plan Template — top 10 accounts, owned by the rep, not Salesforce. Each account has: company, contacts (with role + relationship strength), key dates, deal-size, current opp-stage, recent-touches, threats, opportunities. The home view: top-10 ranked grid of account cards. Click for the full plan: contact map, key-dates timeline, threat/opp list, recent-touch log. Each touch is a Fireproof doc. Quarterly review export: all 10 plans into a single PDF-ready briefing. Tone: this is the rep's tool, not management's reporting. $STYLE"

gen csm-health-scorecard "CSM Customer Health Scorecard — bespoke per CSM, syncs back nightly. Each customer has a health score 0-100 derived from rep-tunable signals: usage trend, last-exec-touch, NPS-from-internal, ticket-volume, contract-renewal-window. The CSM defines the weights for their customers. Health = weighted sum. The home view: customers ranked by health (red <50, amber 50-75, green >75). Click for detail: signal breakdown, last 5 touches, scheduled tasks. Each signal-update is a Fireproof doc. A weekly digest: who moved up/down. $STYLE"

gen campaign-retro "Marketing Campaign Retro — owned per campaign, dies in 90 days. After a campaign ships, create a retro doc: campaign name, goal, actual results, what worked, what didn't, lessons, owner-rotation. Multiple contributors can add notes (each contribution is a Fireproof doc tagged to the retro). The retro auto-archives at 90 days but remains searchable. The home view: list of active retros (not yet archived) plus an archive search. Tone: brief, blame-free, learning-oriented. Export a retro as a one-page briefing PDF. $STYLE"

gen finance-close "Finance Close Checklist — line items per ledger, signoff trail. Each month's close has a list of tasks per ledger (AR, AP, GL, PAYROLL, REVENUE, etc), each with owner, due-date, status (PENDING / IN-PROGRESS / DONE / BLOCKED). Status changes are Fireproof docs (audit trail with timestamp + actor). The home view: this month's close as a hierarchical checklist sorted by due-date. Blocked items flagged. A signoff workflow: when all tasks done, controller marks the ledger CLOSED — a final Fireproof doc with their handle. Past months browsable as numbered exhibits. $STYLE"

gen nda-triage "Legal NDA Triage — bucketed by risk, replaces folder-based queue. Incoming NDAs are added with counterparty, type (MUTUAL / ONE-WAY-IN / ONE-WAY-OUT), risk-level (auto-suggested by counterparty type, paralegal-overridable), redline-required-flag. Paralegals can [ TRIAGE ] each NDA — assign to attorney or self-handle. Each triage decision is a Fireproof doc. The home view: queue sorted by risk DESC, then arrival-date ASC. Filters by status (pending / triaged / signed / withdrawn). SLA tracker: time-from-arrival-to-triage. $STYLE"

gen rfp-comparison "Procurement RFP Comparison — buyer-specific weighting matrix. The user defines criteria for an RFP (e.g. PRICE 30%, FEATURES 25%, SECURITY 20%, SUPPORT 15%, ROADMAP 10%) — weights sum to 100%. Add vendors with their bid: each criterion gets a score 1-5. The matrix calculates each vendor's weighted total live. Vendors auto-rank. Each scoring update is a Fireproof doc. Notes per (vendor × criterion) for justification. Export the matrix as a one-page summary. Past RFPs catalogued by date + winning vendor. $STYLE"

gen exec-briefing-book "Exec Briefing Book — one EA, recurring content cadence. The EA assembles a weekly briefing for one executive: key meetings this week (with attendees + objectives), travel logistics, decisions pending, follow-ups needed, news clips. Each section is a Fireproof doc. The book renders as a numbered exhibit list — EXHIBIT 01 SCHEDULE, EXHIBIT 02 DECISIONS, etc. The exec-view: read-only access via shared link. Past weeks archived. The EA-view: drag-drop content blocks, mark sections as DELIVERED when handed to exec. $STYLE"

gen board-prep-packet "Board Prep Packet — chair-specific narrative, materials cued. The corporate secretary builds a per-board-meeting packet for the chair: agenda items with materials links, expected discussion duration, prepared talking points per item, decisions sought. Each item is a Fireproof doc. The packet renders for the chair as a sequential read with [ MARK READ ] checkboxes per item. The chair can add private notes (separate Fireproof docs visible only to them). Past meetings catalogued. Export as a printable PDF. $STYLE"

gen post-mortem-template "Service Post-Mortem Template — SRE/eng-owned, not generic. Each incident gets a post-mortem with: summary, timeline (events with timestamps), root-cause, contributing-factors, action-items (with owners + due-dates), customer-impact, severity. Multiple contributors add timeline events (each is a Fireproof doc). The home view: list of post-mortems by severity DESC then date DESC. Click for detail: full timeline rendered chronologically, action-item table with status, embedded chat-log if pasted. Tone: blameless, narrative. Export as a numbered exhibit. $STYLE"

wait
echo "ALL DONE" >> "$HERE/_status.log"
