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

gen algorithmic-bias-explorer "Build an algorithmic bias case explorer. The user picks a domain — hiring (automated resume screening), consumer lending (credit scoring models), facial recognition (law enforcement databases), or predictive policing (risk assessment tools) — and sees how racial hierarchies get encoded in training data, feature selection, and model design. Show the feedback loops that amplify bias over time. Include documented cases: COMPAS recidivism scores, Amazon's abandoned hiring tool, facial recognition misidentification of Black faces. Help users understand algorithmic bias not as an accident but as the product of choices made by people with particular assumptions."
gen surveillance-timeline "Build a surveillance technology timeline. The user picks a surveillance system — COINTELPRO, the NSA metadata program, predictive policing tools, direct-to-consumer DNA testing, biometric border control, social media monitoring — and traces its origins, its stated public safety purpose, and its actual use as documented by courts, journalists, and oversight bodies. Show who the surveillance targets historically were (Black activists, labor organizers, Muslim communities, immigrants) and how targeting decisions were made. Help users see surveillance not as neutral data collection but as a political technology."
gen discriminatory-design-quiz "Build a discriminatory design analysis tool. The user examines a real interface or system — a public housing application form, a social media content moderation algorithm, a hospital triage tool, a university admissions interface — and identifies the assumptions encoded in its design: whose use case was centered, whose was treated as edge case, what data was collected and why, what outcomes the system was optimized for, and who reviews its decisions. Draw on Virginia Eubanks's automated poverty management and Ruha Benjamin's concept of the New Jim Code to frame the analysis."
gen carceral-capitalism-explainer "Build a carceral capitalism explainer. The user explores how mass incarceration intersects with economic structures: prison labor and the 13th Amendment exception, the bail bond industry and pretrial detention, private prison corporations and per-diem contracts, the school-to-prison pipeline and zero-tolerance discipline, and the debt spiral that follows release — fines, fees, restitution, revoked driver's licenses, employment barriers. Show how these systems interact and who profits. Help users understand mass incarceration not as a response to crime but as a political-economic system with its own constituencies."
gen acts-of-refusal-cases "Build an acts of refusal case study explorer. The user picks a community or institution that resisted surveillance or algorithmic control — San Francisco's facial recognition ban, the Detroit Community Technology Project, the Algorithmic Justice League, worker data rights organizing, or tenant organizing against landlord surveillance tech. Trace what the community was resisting, what tactics they used (legislation, litigation, technical countermeasures, public pressure, collective refusal), what they achieved, and what limitations their approach encountered. Help users think concretely about collective responses to surveillance capitalism."

wait
echo "ALL DONE" >> "$HERE/_status.log"
