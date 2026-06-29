#!/usr/bin/env bash
set -u
HERE="/Users/jchris/code/landing-pages/vibes/dating"
cd "$HERE"

# Pin the publishing namespace explicitly so a stale `vibes-diy login`
# default (account swap, re-auth, CLI upgrade) cannot land deploys at the
# wrong user-slug. See src/pages/featured-apps/README.md for context.
USER_SLUG="og"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( npx vibes-diy@latest generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen dating-season "Cohort dating app. 30 strangers join a six-week season together. Daily prompts, weekly group activities. Pair off through real interaction or don't. Pool closes at season start — you can't browse, only meet your cohort. Alumni recruit the next season. Save in Fireproof."

gen vouched-dating "Sponsored-entry dating. You can't sign up — an existing user nominates you. They stake reputation; bad behavior costs them visibility too. Every match shows 'introduced by [name], who has vouched for 7 others, all still active.' Trust-graph pool. Save in Fireproof."

gen date-slot-board "Activity-as-listing dating. Post a specific date you want to take this week — 'ramen Tuesday 9pm Mission, I'll be wearing red.' People claim the slot, not the person. After, both decide if there's a second. Unclaimed slots disappear. Save in Fireproof."

gen slow-dating-letters "Async deep-correspondence dating. Write to one person at a time, long-form, over two weeks. No photos exchanged until both agree to meet. App rate-limits to one reply per day. Day-7 prompt: 'what would surprise me about you.' Save letters as Fireproof docs."

gen group-dating-mixer "Group-date-first dating. 1:1 dates are forbidden until you've been on a four-person hangout — you, your match, and one trusted friend each. First contact is a curated mixer of two pairs. Friends are required to participate. Save in Fireproof."

wait
echo "ALL DONE" >> "$HERE/_status.log"
