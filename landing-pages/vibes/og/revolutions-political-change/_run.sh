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

gen atlantic-revolutions "Build an Atlantic revolutions comparison tool. The user picks any two of the four revolutions — American (1776), French (1789), Haitian (1791), and Latin American independence movements (1810s–1820s) — and sees how their causes, ideologies, and outcomes compare. What Enlightenment ideas animated each? Who was included in the new political order, and who was excluded? What role did the other revolutions play in inspiring or alarming each? How did each handle slavery? Cover the historians' debates: were these revolutions a coherent Atlantic movement or distinct national events? Help students think comparatively across cases."
gen revolutionary-document-reading "Build a revolutionary founding document close reading tool. The user picks a founding document — the US Declaration of Independence (1776), the French Declaration of the Rights of Man (1789), the Haitian Declaration of Independence (1804), or a Latin American independence proclamation — and sees who was included in its universalist claims and who was excluded in practice. Where does the language of rights contradict the social order the document helped create? How did enslaved people, women, and indigenous populations respond to documents that claimed universal rights while excluding them? Help students read founding texts critically."
gen causes-of-revolution "Build a causes of revolution analyzer. The user picks any revolution — the French Revolution, the Russian Revolution, the Chinese Revolution, the Iranian Revolution, the Cuban Revolution, the Arab Spring — and traces the structural conditions that made it possible: economic crisis and fiscal collapse, political exclusion and legitimacy deficit, ideological challenge to the existing order, state weakness or split within the ruling coalition, and the role of contingency and leadership. Apply the classic frameworks — de Tocqueville, Skocpol, Goldstone — to the same case and see which fits. Help students think causally about political rupture."
gen decolonization-timeline "Build a decolonization timeline (1945–1980). The user picks a region — sub-Saharan Africa, South and Southeast Asia, the Middle East and North Africa, the Caribbean — and traces how colonized peoples won independence: negotiated transfer of power, armed anti-colonial struggle, Cold War leverage (playing US and Soviet against each other), and international pressure through the UN. Cover the French in Algeria and Indochina, the British in India and Kenya, the Portuguese in Angola and Mozambique. Show what independence did and didn't change: formal sovereignty often coexisted with neocolonial economic dependence."
gen revolutionary-aftermath "Build a revolutionary aftermath analyzer. The user reads about the outcome of a revolution and traces what happened in the years following: consolidation of power, factional struggle, Thermidorian reaction, foreign intervention, or new revolution. Apply the historiographical framework of the 'second revolution' — the moment when radical possibility gives way to stabilization or repression. Cover France after 1789, Russia after 1917, China after 1949, Cuba after 1959, Iran after 1979. What patterns repeat? What contingencies mattered? Help students see revolution as a process, not a single event."

wait
echo "ALL DONE" >> "$HERE/_status.log"
