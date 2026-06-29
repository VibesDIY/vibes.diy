#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/run-the-place"
cd "$HERE"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

gen listing-pipeline-board 'Real estate listing pipeline tracker. Stages: Lead, Showing, Offer Submitted, Under Contract, Closed. Each card shows property address, lead name, agent assigned, last touched date. Click a card to advance it to the next stage. Add new prospects with a quick form. Per-stage totals shown above each column. Use Fireproof useFireproof for live sync between agents in the office. Single-file React. Tone: clean B2B internal tool, no fluff.'

gen shift-reconciliation 'End-of-shift cash and tip reconciliation board for restaurants and retail. Each closer enters: cash counted, card sales total, tip pool, voids, comps. App computes the deposit envelope number and flags discrepancy vs the POS total entered by the manager. Each closer signs off with their initials before finishing the shift. Saved Fireproof docs become a daily ledger. Single-file React, useFireproof for sync. Tone: utilitarian, end-of-night, slightly tired.'

gen sunday-school-roster 'Sunday school class roster and lesson schedule for religious education admin. List of classes with grade, teacher, room number. Per-week lesson plan column with curriculum reference. Attendance check-off per Sunday saved as Fireproof docs with date and class id. Add new students or teachers via a quick form. useFireproof for sync. Single-file React. Tone: warm, organized, parish-bulletin friendly.'

gen trade-desk-handoff 'End-of-day desk handoff log for trading desks. Each trader posts: open positions held overnight, pending orders, key client conversations, anything the next-shift trader must know. Each entry has a "read and acknowledged" checkbox the incoming trader checks. Filter by date or trader. useFireproof for live sync. Single-file React. Tone: serious, concise, audit-trail clean.'

gen front-desk-queue 'Walk-in and reservation queue for salons, Pilates studios, and dental offices. Today as a timeline; tap to add a name + phone + service + duration; check in or no-show buttons; "running late" auto-highlight after the slot start time passes. Drag to reschedule. useFireproof for live sync between front-desk and stylist views. Single-file React. Tone: clean booking-page feel, mobile-first.'

wait
echo "ALL DONE 2" >> "$HERE/_status.log"
