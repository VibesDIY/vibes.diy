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

gen foreign-policy-doctrine-quiz "Build a US foreign policy doctrine quiz and explainer. The user reads a historical scenario — a small nation seeking a US loan, a foreign revolutionary movement winning power, a European empire collapsing — and identifies which doctrine applied: Monroe Doctrine, Manifest Design, Big Stick, Dollar Diplomacy, Open Door, Wilson's Fourteen Points, containment, Nixon Doctrine, Reagan Doctrine. Show the logic of each doctrine, its domestic political context, and what actually happened when it was applied. Help students see foreign policy not as principled consistency but as evolving doctrine shaped by interests and ideology."
gen frus-document-explorer "Build a FRUS (Foreign Relations of the United States) document explorer for diplomatic history students. The user picks a crisis — the Cuban Missile Crisis, the 1953 Iran coup, Vietnam War escalation, the 1971 Bangladesh war — and steps through the archival record: State Department cables, NSC meeting transcripts, President's Daily Briefs, congressional testimony. Show what decision-makers knew versus what they told the public. Help students read diplomatic archives as historians — understanding what was deliberate, what was bureaucratic inertia, and what was genuine uncertainty."
gen american-imperialism-timeline "Build an American imperialism timeline from 1898 to the present. Trace US overseas expansion: the Spanish-American War and the Philippines, the Panama Canal, the Platt Amendment and Cuba, Dollar Diplomacy in Central America, Wilsonianism and its limits, the post-WWII empire of bases, covert interventions in Iran and Guatemala and Chile, Vietnam, and the post-9/11 wars. For each episode, show the justification used (civilizing mission, anticommunism, democracy promotion, counterterrorism) and the gap between justification and outcome. Help students evaluate continuity and change in US imperial practice."
gen transnational-history-mapper "Build a transnational history mapper for 20th-century social movements. The user picks a movement — anti-colonialism, the non-aligned movement, international human rights, global feminism, labor internationalism — and traces how it crossed borders: the ideas, the organizers, the institutions, the funding. Show how these movements shaped US foreign policy responses — sometimes forcing the US to reform, sometimes prompting covert suppression. Cover the Bandung Conference, the UN human rights system, the Helsinki Accords, and the transnational advocacy networks that emerged from the 1970s onward."
gen foreign-policy-decision-case "Build a foreign policy decision-making case study tool. The user picks a crisis — the Cuban Missile Crisis, the Gulf of Tonkin escalation, the 2003 Iraq War decision — and walks through the decision process: who was in the room, who advised what, what intelligence was available versus what was assumed, what domestic political pressures shaped the decision, and what alternatives were rejected. Help students apply the bureaucratic politics model, the groupthink hypothesis, and the rational actor model to the same case and see which fits best."

wait
echo "ALL DONE" >> "$HERE/_status.log"
