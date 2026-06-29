#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/hero-at-work"
cd "$HERE"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen standup-status-board 'Team standup status board for small engineering teams — beat the daily Zoom by writing it up async. Each teammate fills a card with three text fields (Yesterday, Today, Blockers) plus a one-tap mood emoji at the top of their card (six choices: 🚀 🔥 😅 😬 🧠 🌧). Names are remembered via localStorage so people do not retype. The board renders as a responsive 2-3 column grid sorted most-recently-edited first; each card shows name, mood, the three fields, a relative timestamp ("posted 14 min ago"), and a small 7-day streak strip (filled-in dots for each day that teammate posted). Above the grid: a header with today’s date, a "team check-in" donut chart showing the percentage of the team that has posted today, and a "Clear board for tomorrow" button that archives the current day to history. Below the grid: a collapsed "Past standups" panel showing one row per archived day, expandable to view that day’s board read-only. Blockers field gets a red border glow when non-empty. Use Fireproof useLiveQuery for sync so the whole team sees updates live. Single-file React. Tone: fast, friendly, async-team-energy — no clutter, big readable type, the empty board prompts "first one to post sets the tone".'

gen icp-prospect-tracker 'Pipeline tracker for a small B2B sales team — a focused ICP (ideal customer profile) sheet that beats living in spreadsheets. Quick-add form at the top: company name, contact name, stage picker (Lead → Qualified → Demo → Closed-Won → Closed-Lost), fit score (1-5 stars, click to set), deal value in dollars (number input, optional), last-touch date (date picker defaulting to today). Below the form, a horizontal funnel bar visualizing how many prospects sit in each stage, color-coded — bigger bars for fuller stages — with the conversion percentage between adjacent stages overlaid. Below the funnel, the prospect list as a sortable table with chip filters at the top (toggle stages on/off, sort dropdown for "Fit score", "Staleness — oldest last-touch first", "Deal value", "Company A-Z"). Each row shows all fields plus a "Touched today" button that resets last-touch to now and a "Next step" smart suggestion ("Send a check-in" if stale > 14 days, "Schedule demo" if Qualified > 7 days, "Close it!" if Demo > 5 days). Stale prospects get a subtle red dot. Footer summary tiles: total pipeline value, deals closed-won this month, average fit score. Fireproof useLiveQuery for sync. Tone: clean B2B internal tool, no fluff, sortable-table-with-superpowers. Single-file React.'

gen tool-request-queue 'Internal tool request queue — coworkers submit "I wish we had X" requests, and the team votes them up. Header tagline: "Beats waiting for IT." Quick-add form: title (one line), description (textarea, optional), requester name (saved in localStorage so people do not retype), urgency chip picker (Nice to have / Needed / Blocking, color-coded). Below the form: a filter row toggling status (Open / In Progress / Shipped) and a search field. The list renders as cards sorted by votes descending, each showing title, description, requester, urgency badge, vote count, and status badge. A thumbs-up button casts one vote per browser (tracked via localStorage). When a request hits 5 votes a small "trending 🔥" badge appears; at 10 votes the card briefly celebrates with a confetti emoji burst. Anyone can press "I am building this" to mark a request In Progress (yellow highlight + the builder is recorded), or "Mark shipped" with a link field that becomes a clickable URL on the card. Shipped cards can earn a "speed-run ⚡" badge if they shipped within 7 days of being filed. At the bottom, a "Hall of fame" section shows the most recent 5 shipped requests as a small read-only changelog with builder credits. Use Fireproof useLiveQuery for sync. Tone: tongue-in-cheek but functional — real lightweight kanban energy, the tool a coworker would actually open daily. Single-file React.'

wait
echo "ALL DONE" >> "$HERE/_status.log"
