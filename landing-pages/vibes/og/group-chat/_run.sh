#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/.claude/worktrees/group-chat/vibes/group-chat"
USER_SLUG="og"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen group-reply-picker "Reply Roulette — a group chat reply assistant. Given an incoming message, the app generates four reply options ranked from smart to saucy: A (Thoughtful — articulate and genuine), B (Agreeable — casual and affirming), C (Playful — has some edge), D (Unhinged — chaotic and funny). Optional human input: a second field lets the user type their own draft; buttons POST IT (sends draft as-is to the thread) or USE AS SEED (generates four A/B/C/D variations of the draft). Auto mode toggle: in auto mode two players alternate — Player 1 pastes an incoming message, app auto-selects B or C and posts it, that reply becomes Player 2's incoming message, repeat. Result is a full conversation neither person typed. Conversation thread accumulates in Fireproof with each entry showing player label, message text, and option badge (A/B/C/D/YOURS). Session shared by URL. Data model: turn doc { id, player: 'p1'|'p2', incoming, option: 'a'|'b'|'c'|'d'|'human', text, ts }. The A/B/C/D labels should be visually distinct — a gradient from calm/cool for A to chaotic/red for D. Auto mode toggle should feel satisfying. Whole app should feel alive and fast, like a messaging app with personality."

gen pirate-chat-filter "Paste a message, get back a pirate translation. Shared session where the thread shows both the original and pirate version side by side. One-tap copy button to grab the pirate version and paste back to your real chat."

gen colbert-room "Drop any group chat topic or paste a recent message. The app responds as Stephen Colbert — a short satirical monologue with a build and a punchline. Works on anything: dinner plans, drama, sports takes. Stores past takes in Fireproof."

gen ambient-chat-art "Paste the last few messages from your group chat. The app generates an ambient image that captures the current vibe — non-literal, abstract color field and texture, not a scene illustration. Full-width display. Paste new messages to refresh. Stores past generations."

echo "ALL DONE" >> "$HERE/_status.log"
