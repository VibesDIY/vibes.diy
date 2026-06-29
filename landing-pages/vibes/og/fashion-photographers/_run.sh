#!/bin/bash
set -e
LOG=vibes/fashion-photographers/_status.log
> "$LOG"

gen() {
  local slug="$1"
  local prompt="$2"
  npx vibes-diy@latest generate \
    --user-slug=og \
    --app-slug="$slug" \
    "$prompt" >> "$LOG" 2>&1 &
  echo "STARTED $slug pid=$!" >> "$LOG"
}

gen "photo-bid-pipeline" \
  "Photography bid tracker. Each job: client name, shoot type, quoted rate, submission date, status (sent / negotiating / won / lost / ghosted). Pipeline view of all active bids."

gen "insta-inquiry-crm" \
  "Instagram inbound lead tracker for photographers. Log each inquiry: username, date, what they want, rough budget, follow-up status. Know who's warm, who needs a nudge, who's gone cold."

gen "shoot-client-log" \
  "Freelance client record for photographers. Each entry: name, contact, shoot history, day rate agreed, usage rights, notes, next steps. Never forget what you charged or what you promised."

gen "daily-wins-log" \
  "Daily confidence log for creative freelancers. Write down a win, a compliment received, or a moment you're proud of. Builds a running feed of good things to read on the hard days."

gen "crew-shoutout-board" \
  "Shoot crew appreciation board. After each job, post a shout-out for an assistant, stylist, MUA, or grip. Name, shoot, what they did. Shared with the team."

gen "model-collab-notes" \
  "Post-shoot collaboration notes per model. Date, shoot, what direction landed, what felt off, what to explore next session. Builds your personal creative record."

wait
echo "ALL DONE" >> "$LOG"
