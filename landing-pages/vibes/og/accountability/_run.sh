#!/usr/bin/env bash
# Accountability partnership apps — batch generator
# Run from this directory. Tails _status.log when done.
set -euo pipefail

USER_SLUG="og"
LOG="_status.log"
> "$LOG"

gen() {
  local slug="$1"; local prompt="$2"
  npx vibes-diy@latest generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" \
    >> "$LOG" 2>&1 \
    && echo "DONE $slug exit=0" >> "$LOG" \
    || echo "DONE $slug exit=1" >> "$LOG" &
}

gen "goal-cohort-match" \
  "20 people with the same goal join a monthly cohort. Daily check-in, weekly group call, pair off into 1-on-1 partners naturally. Cohort closes at start; finishers recruit the next round."

gen "accountability-vouched" \
  "Voucher-based accountability matching. An existing user stakes reputation on you. Partner card shows voucher name and how many others they staked. Ghosting costs the voucher credibility."

gen "goal-slot-board" \
  "Post a goal slot, not a profile. 'Quit sugar, 30 days, one partner, starts Monday.' Others claim the slot. After week one, both decide to continue or part cleanly. Expired slots auto-close."

gen "slow-accountability-letters" \
  "Accountability partners exchange one long-form message per day. Rate-limited. Day 14 shows a fixed prompt: what does failing look like, and what do you want me to do? Letters become a change archive."

gen "accountability-pod" \
  "Four-person accountability pod with the same goal. 1-on-1 pairs can only form after a week in the pod together. Pods dissolve into pairs or stay whole. Pods recruit new members to replace leavers."

wait
echo "ALL DONE" >> "$LOG"
echo "--- All generators finished. Check $LOG for results. ---"
