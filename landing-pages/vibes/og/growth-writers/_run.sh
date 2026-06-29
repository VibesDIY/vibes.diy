#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/.claude/worktrees/growth-writers/vibes/growth-writers"
cd "$HERE"
USER_SLUG="og"

gen() {
  local slug="$1"; local theme="$2"; shift 2; local prompt="$*"
  local theme_spec; theme_spec=$(npx vibes-diy@latest themes --slug "$theme" 2>/dev/null)
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" \
    "Theme: $theme_spec

$prompt" \
    >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen "ai-content-brief" "recon" \
  "AI content brief generator for growth writers. Two inputs: topic (text field) and target reader (text field). On submit, use callAI (imported from 'call-ai' npm package) to generate a structured brief with these sections: Angle (the fresh take), Key Points (5 bullets), What to Avoid, Recommended Word Count, and CTA Suggestion. Show a loading state while generating. Display the brief in a clean card with a copy-to-clipboard button per section. Use plain, direct language — no grandiose content-strategy vocabulary."

gen "topic-cluster-map" "broadsheet" \
  "Topic cluster map for systematic content publishers. Users can create named content pillars (e.g., 'Email Marketing', 'SEO Basics'). Under each pillar, add topic ideas and mark each as: Published, In Queue, or Missing. Show a compact coverage summary per pillar (e.g., '3 published / 2 in queue / 4 missing'). Highlight the Missing ones in a distinct color. Sortable list within each pillar. Use plain, direct language — no fantasy or geographic vocabulary."

gen "idea-scoring-board" "proof" \
  "Topic idea scoring board for content prioritization. Users define up to 5 scoring criteria with custom names and weights (e.g., 'Audience Fit' weight 3, 'Effort' weight 1). Add topic ideas as cards. Score each idea 1-5 per criteria. App auto-calculates a weighted total score and stack-ranks the list in real time. Winner is visually highlighted. Loser ideas are dimmed. Snarky empty state: 'Twelve ideas enter. Add yours.'"

gen "reader-segment-mapper" "atlas" \
  "Audience segment mapper for content teams. Users define 2-4 reader segments (e.g., 'Beginners', 'Practitioners', 'Decision Makers'). Add topic ideas. For each topic, mark which segments it serves using checkboxes. Show a heatmap-style grid view: topics as rows, segments as columns, filled cells show coverage. Highlight topics that serve only one segment (risky) and topics that serve all segments (pillar candidates). Use plain, direct language."

gen "content-compound-tracker" "carbon" \
  "Content compounding tracker. Add published pieces: title, URL, cluster tag, and publish date. Draw connections between pieces by selecting 'this piece references that piece'. Visualize the result as a simple node graph — pieces as nodes, links as edges. Show which pieces are hubs (many connections) vs. orphans (no connections). Include a list view alongside the graph. Orphan count visible as a badge."

wait
echo "ALL DONE" >> "$HERE/_status.log"
