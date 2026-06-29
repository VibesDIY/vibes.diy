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

gen suburbanization-timeline "Build a suburbanization timeline and explainer (1945–1980). The user picks a US metropolitan area — Chicago, Detroit, Los Angeles, Atlanta, New York — and traces the postwar suburban expansion: federal mortgage guarantees (FHA, VA loans), highway construction and the Interstate system, white flight from cities, restrictive covenants and exclusionary zoning, and the fiscal consequences for the urban core. Show who was excluded from the suburban boom and how. Cover the role of real estate industry practices, local government decisions, and federal policy in producing racially segregated metropolitan areas."
gen redlining-explorer "Build a redlining explorer for urban history students. The user picks a US city and a decade (1930s–1960s) and sees how the Home Owners' Loan Corporation graded neighborhoods — A (green), B (blue), C (yellow), D (red) — and what those grades meant for mortgage access, investment, and wealth accumulation across generations. Show the demographic correlates of each grade. Trace how redlining interacted with blockbusting, urban renewal, and highway construction to concentrate poverty in Black neighborhoods. Help users see the present-day wealth gap as a product of mid-century policy decisions."
gen urban-reform-timeline "Build an urban reform timeline (1880s–1970s). The user picks a city problem — cholera epidemics, tenement overcrowding, machine politics, juvenile delinquency, highway displacement — and traces the reform movement that responded: who organized, what institutions they built (settlement houses, public health departments, city planning commissions), what they achieved, and what they failed to address. Show how progressive reform often served middle-class reformers' interests more than working-class residents'. Cover the tensions between reform as uplift and reform as social control."
gen ethnic-neighborhood-formation "Build an ethnic neighborhood formation explorer for urban history. The user picks a city and a period and traces the ethnic succession in a neighborhood: who came first (often a working-class European immigrant group), what economic niche enabled their foothold (peddling, garment work, construction), who replaced them as they moved up and out, and what structural forces drove each wave of succession. Cover how these patterns changed after the Great Migration as Black and Latino migration to Northern cities met exclusion from the paths to mobility that earlier European immigrants had used."
gen political-incorporation-tracker "Build a political incorporation tracker for urban history. The user picks an immigrant or minority group in a US city — Irish in Boston, Italians in New York, Black voters in Chicago, Puerto Ricans in Philadelphia, Mexicans in Los Angeles — and traces how they moved from political exclusion to electoral representation. Show the coalitions formed, the machine politics and patronage systems, the protest movements, and the independent electoral organizations that produced political incorporation. Cover both the gains and the limits of electoral politics as a tool for economic and social advancement."

wait
echo "ALL DONE" >> "$HERE/_status.log"
