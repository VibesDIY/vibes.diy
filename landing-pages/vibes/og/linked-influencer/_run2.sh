#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/fp/vibes.diy/vibes-diy/linked-influencer"
cd "$HERE"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status2.log" ) &
}

: > "$HERE/_status2.log"

# === READERS ===

gen li-bingo-board 'LinkedIn cringe bingo board. Render a 5x5 bingo card pre-filled with 25 famous LinkedIn cringe phrases such as "Day 1 of...", "Not gonna lie", "Game-changer", "CEO of...", "Buckle up", "🧵 1/", "Hot take", "Unpopular opinion", "Quick reminder", "Folks", "Hire her", "Humbled to announce", "Big news", "I almost cried", "Excited to share", "Onwards and upwards" — pick a good list of 25. User pastes a real LinkedIn post into a textarea. App scans the text and highlights any matching squares (case-insensitive substring match). When any row, column, or diagonal lights up, show a "BINGO!" celebration banner. Save scanned posts as Fireproof docs with hit count. List past posts with their score. No AI calls needed — just string matching. Cringe-corporate parody tone for all UI copy.'

# === SINCERE INVERSION ===

gen li-haiku-reducer 'LinkedIn-to-haiku reducer. User pastes any long corporate LinkedIn post or manifesto into a textarea. App uses AI to compress it down to a sincere 3-line haiku (5-7-5 syllables) that captures what the post is actually saying — stripped of buzzwords, flattery, and filler. Display haiku in elegant serif typography below the input. Save each haiku as a Fireproof doc alongside the original source text. List past haikus, click to expand and see the original verbose post. Quiet, contemplative UI in contrast to the source material.'

gen li-corporate-haiku 'Corporate-to-haiku translator. Paste a bloated LinkedIn post, get back a short haiku that strips the buzzwords and exposes the actual message. Use AI to do the reduction. The haiku should be sincere, not parody. Show before/after side by side with a word-count diff (e.g., "247 words → 17 syllables"). Save as Fireproof docs and list past reductions. Minimalist zen UI, lots of whitespace.'

# === RANKED OUTPUT / CHART ===

gen li-headline-leaderboard 'LinkedIn headline A/B tester. User types a topic into a textarea. App uses AI to generate exactly 10 LinkedIn-style parody headlines about that topic, each with a simulated engagement score from 0 to 99. Display them as a ranked leaderboard with horizontal bar chart visualization (longer bars = higher scores). #1 gets a confetti emoji burst. Save the topic + ranked list as a Fireproof doc. List past leaderboards in a sidebar with click-to-view. Cringe-corporate parody tone for headlines.'

gen li-headline-ranker 'Cringe headline ranker. User enters a topic. AI produces 10 absurd LinkedIn-influencer headlines ranked by simulated viral potential (a number from 0 to 100). Render as a podium for top 3 and a bar chart for the remaining 7. Save each ranking session as a Fireproof doc with the topic. Browse past sessions. Tone: parody "headline lab" with playful ranking labels (FIRE / MID / FLOPS).'

# === VISUAL MOCKUP ===

gen li-post-mockup 'LinkedIn post visual mockup generator. User types a topic for a parody post. App uses AI to generate: post author name, parody headline (e.g., "VP of Forward Synergy at Acme"), post body text, fake reaction counts (likes/loves/celebrate), and a fake comment count. Render the result as a styled visual card that LOOKS like an actual LinkedIn post — circular avatar with author initials, name + dot + "2nd", "Promoted" or timestamp, post body with line breaks, reaction emoji row with counts (👍 ❤️ 🎯 4.2K), "234 comments · 89 reposts" footer. Save mockups as Fireproof docs with all fields. List past mockups, click to render and copy as text.'

gen li-fake-post-card 'Fake LinkedIn post card generator. Generate parody posts as visual cards that mimic LinkedIn UI: author avatar circle with initials, parody name, parody title, body text, reaction strip (thumbs up + heart + handshake icons with counts), comment count. AI fills in all fields from a single user prompt. Card styled close to real LinkedIn aesthetic (Inter font, blue accent, rounded corners, subtle shadow). Save as Fireproof, list past cards.'

gen li-post-screenshot 'LinkedIn post screenshot maker. AI generates a parody post (author + content + reactions + comment count) from a one-line user prompt, then renders it as a screenshot-ready card with full LinkedIn styling so users can save the image. Add a "copy as image" button using html2canvas if possible, or just present the styled card large and clean. Save Fireproof docs of past generated posts.'

# === MULTI-INPUT NARRATIVE ===

gen li-network-roaster 'LinkedIn network roaster. User pastes 5 connection names with their job titles (one per line, like "Sarah Chen — VP Marketing at Initech"). App uses AI to write a comedic "network analysis" of the user, grading their orbit. Output: a letter grade (A+ to F), a stats breakdown ("73% middle managers, 27% MLM recruiters"), and a 3-paragraph roast. Save analyses as Fireproof docs. List past roasts with their grades shown like a transcript.'

gen li-network-grader 'Connection network analyzer parody. Paste 5-10 LinkedIn connections (name + title each line). AI grades the network and produces: 1) overall vibe score (0-100) with a gauge visualization, 2) a pie chart breakdown of connection categories ("buzzword bros", "actual humans", "MLM recruiters", "ghost profiles"), 3) a roast paragraph. Save and list past analyses.'

# === GAMIFIED HABIT ===

gen li-streak-tracker 'LinkedIn thought-leader streak tracker. Each day the app shows a fresh AI-generated cringe writing prompt of the day (e.g. "Reflect on a coffee spill that taught you about scaling teams"). User writes a parody post in response. Mark today as completed. Track daily streaks with a calendar grid showing days completed in green. Award badges at 3, 7, 14, 30 day milestones (display badge wall at top). Save daily entries as Fireproof docs. Show current streak count, longest streak, and badge collection prominently. UI gamified, retro arcade vibe.'

gen li-thought-leader-streak 'Daily LinkedIn parody habit tracker. Each day a new AI-generated cringe topic prompt appears. User writes a short parody response. Calendar heatmap (like GitHub contributions) shows their streak over time. Badges unlock at 3, 7, 14, 30 days. Past entries saved in Fireproof, browsable by date. Tone: encouraging-but-deranged motivational coach.'

wait
echo "ALL DONE" >> "$HERE/_status2.log"
