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

gen colonial-latin-america "Build a colonial Latin America timeline and institution explorer. The user picks a colonial institution — the encomienda, the mita labor tribute, the hacienda, the castas racial classification system, the Bourbon Reforms — and traces how it shaped labor, race, and land from the Spanish conquest through independence. Show who designed each institution, who benefited, who bore the costs, and how colonized people resisted, adapted, and subverted it. Cover both the Andean and Mesoamerican contexts. Help users see colonial institutions not as static impositions but as contested systems constantly negotiated."
gen latin-american-revolution "Build a Latin American revolution explorer. The user picks a 20th-century revolution — the Mexican Revolution (1910), the Bolivian Revolution (1952), the Cuban Revolution (1959), the Nicaraguan Revolution (1979), the Salvadoran Civil War — and traces the causes: land concentration, oligarchic rule, US economic intervention, and the emergence of peasant and labor organizing. Compare the revolutionary programs, the US responses, and the outcomes: which revolutions achieved land reform, which were overthrown, which survived but transformed. Show the regional interconnections between these movements."
gen land-reform-case "Build a land reform case study explorer for Latin American history. The user picks a country and an era — Mexico 1917 (ejido system), Bolivia 1952, Guatemala 1952 (Arbenz's agrarian reform and the CIA coup), Cuba 1959, Chile 1970–1973 (Allende and the coup). Trace the agrarian reform: who received land, how much, under what conditions; who resisted (landed oligarchies, US fruit companies, Cold War planners); and what happened when reform was reversed. Help students see land reform as the central political question of 20th-century Latin America."
gen indigenous-sovereignty "Build an indigenous sovereignty timeline for Latin America. The user picks a region — the Andes, Mesoamerica, the Amazon basin, Patagonia — and traces indigenous resistance to colonial and postcolonial states from the conquest through the present: the Andean rebellions of the 18th century, 19th-century indigenous land loss after independence, 20th-century organizing under liberation theology, and the contemporary Zapatista movement, Ecuadorian indigenous confederations, and Bolivian political mobilization. Show how indigenous communities defined sovereignty and used multiple strategies — legal, cultural, armed — to defend it."
gen historical-memory-quiz "Build a historical memory and erasure explorer for Latin American history. The user picks a historical event — La Matanza in El Salvador (1932), the Guatemalan genocide (1981–1983), Argentina's dirty war (1976–1983), Chile under Pinochet, Peru's internal conflict — and traces how it was suppressed, partially acknowledged, and eventually named. What role did truth commissions, international human rights tribunals, exhumations, and survivor testimony play? How did states manage memory — denying, minimizing, ritualizing — and how did communities insist on remembrance? Help students understand memory as a political contest."

wait
echo "ALL DONE" >> "$HERE/_status.log"
