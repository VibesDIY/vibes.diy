#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
USER_SLUG="edu"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" \
    >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen cold-war-timeline "Build an interactive Cold War timeline from 1945 to 1991. The user picks any year and sees what was happening on both sides: key US and Soviet decisions, proxy conflicts, diplomatic breakthroughs, and cultural moments. Cover détente, the Cuban Missile Crisis, the Sino-Soviet split, Berlin crises, nuclear arms race milestones, and the proxy wars in Korea, Vietnam, Angola, and Afghanistan. Show how events on one side prompted responses on the other. Include the ideological framing each superpower used to explain its actions to its own citizens."
gen declassified-doc-analyzer "Build a declassified document analyzer for Cold War history students. The user pastes text from an NSC memo, a FRUS diplomatic cable, or a recently declassified CIA report. The app provides historical context: what crisis was underway, who authored the document and what their institutional role was, what vocabulary signals the era (containment, rollback, détente, NSC-68 framing), and what the document reveals that wasn't publicly known at the time. Help students read primary sources as historians rather than just as information consumers."
gen cold-war-historiography "Build a Cold War historiography comparison tool. The user selects two historiographical schools — orthodox, revisionist, post-revisionist, or new Cold War history — and sees how each interprets the same event: the origins of the Cold War, the Korean War decision, the Cuban Missile Crisis, détente, or the Soviet collapse. What evidence does each school emphasize? What does each school minimize or ignore? How did access to new archives after 1991 change the debate? Help students understand that historical interpretation is contested and evolves."
gen proxy-war-mapper "Build a proxy war mapper for Cold War history. The user picks a conflict — Korea, Vietnam, the Congo, Angola, Nicaragua, Afghanistan — and traces the superpower rivalry underneath it. Show the military aid flows, covert operations, and diplomatic maneuvering from both the US and Soviet sides. Include local actors and their own agendas, not just the superpower lens. Show what the proxy war cost in lives and resources for the local population versus what it cost the superpowers. Help students see proxy wars from multiple vantage points."
gen nuclear-deterrence-explainer "Build a nuclear deterrence explainer grounded in real Cold War crises. Cover key concepts: mutually assured destruction, first strike vs. second strike capability, escalation dominance, the stability-instability paradox, and arms control treaties. Then test these concepts against historical crises: the Berlin blockade, the Cuban Missile Crisis, the 1983 Able Archer exercise, and the Korean peninsula today. For each crisis, ask: did deterrence work as theorized? What role did misperception, domestic politics, and luck play? Help students evaluate deterrence theory against the historical record."

wait
echo "ALL DONE" >> "$HERE/_status.log"
