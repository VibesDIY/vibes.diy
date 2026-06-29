#!/usr/bin/env bash
cd "$(dirname "$0")"
: > _status.log

USER_SLUG="og"
gen() {
  local slug="$1"; local theme="$2"; local prompt="$3"
  local theme_spec; theme_spec=$(npx vibes-diy@latest themes --slug "$theme" 2>/dev/null)
  npx vibes-diy@latest generate --user-slug "$USER_SLUG" --app-slug "$slug" \
    "Theme: $theme_spec

$prompt" \
    >> _status.log 2>&1 && echo "DONE $slug exit=0" >> _status.log \
    || echo "DONE $slug exit=1" >> _status.log &
}

gen "video-content-pipeline" "broadsheet" "YouTube content pipeline tracker. Each video: title, idea stage, script status, shoot date, editor, thumbnail status, review, publish date. Board view by stage."
gen "sponsor-deliverables-log" "proof" "Sponsor deliverable tracker for creators. Each deal: brand name, deliverable type, talking points, link to submit, deadline, status, proof capture. Never miss an obligation."
gen "video-metadata-library" "vault" "YouTube upload metadata library. Store reusable title formulas, description templates, tag lists, chapters format, pinned comment templates, and end screen CTAs by video type."
gen "creator-gear-inventory" "terminal" "Creator gear inventory and checkout. Each item: name, type, location, condition, who has it, return date. Track cameras, mics, lights, cards, batteries. Know what's packed."
gen "collab-outreach-crm" "poster" "Collaboration and outreach CRM for creators. Each contact: name, channel, outreach status, notes, last contact date. Track collabs, guests, brand pitches, and follow-ups."

wait
echo "ALL DONE" >> _status.log
