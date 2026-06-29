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

gen capitalism-timeline "Build a history of capitalism timeline. The user picks an era — mercantile capitalism (1500s–1700s), industrial capitalism (1780s–1900s), corporate capitalism (1900s–1970s), or financialized capitalism (1970s–present) — and sees how capital, labor, and the state related to each other. What was produced and how? Who owned the means of production? How was labor recruited, disciplined, and compensated? What role did the state play in protecting property and managing class conflict? Cover the transitions between eras: what drove the shift from merchant to industrial to financial capitalism, and who won and lost in each transition."
gen labor-conflict-case "Build a labor history case study explorer. The user picks a labor conflict — Homestead Strike (1892), the Triangle Shirtwaist fire (1911), the Ludlow Massacre (1914), the Flint Sit-Down Strike (1936–37), the Memphis Sanitation Strike (1968), the PATCO strike (1981) — and traces what workers wanted, what employers did, how the state intervened, what the public and press said, and what changed in law, practice, or the balance of power as a result. Help students understand labor conflict not as disruption but as the mechanism through which workers shaped the terms of their employment."
gen racial-capitalism-feature "Build a racial capitalism explainer. The user explores how racial hierarchy was integral to capital accumulation across US history — not a distortion of capitalism but a feature. Trace the evidence: slave labor as the foundation of antebellum capitalism, convict leasing as a coerced labor system after emancipation, racial wage differentials and occupational segregation in the 20th century, redlining and the racialized geography of wealth, mass incarceration as labor discipline and revenue extraction. Draw on Robinson, Du Bois, and Roediger. Help users see racial capitalism as a system rather than a series of isolated injustices."
gen primitive-accumulation-cases "Build a primitive accumulation case study explorer. The user picks an enclosure or dispossession — the English enclosure movement (15th–18th centuries), Spanish colonial land seizure through the encomienda, the dispossession of Native American land through treaty violation and allotment, or contemporary land grabs in the Global South — and traces how pre-capitalist resources (common land, communal territory, subsistence economies) were converted into private property and capital. Cover the violence involved and the resistance mounted. Help students understand that capitalism doesn't emerge spontaneously — it requires prior acts of dispossession."
gen financialization-quiz "Build a financialization explainer and quiz. The user picks a financial instrument or crisis — mortgage-backed securities and the 2008 crisis, private equity buyouts and their effect on workers, credit default swaps, hedge fund activism, or sovereign debt crises in the Global South — and traces how it connects to the real economy: who profits from the financial activity, who bears the risk, and what happens to workers, pensioners, and communities when the instrument fails. Cover the deregulation history that enabled each instrument. Help users understand financialization not as abstract finance but as a set of choices with redistributive consequences."

wait
echo "ALL DONE" >> "$HERE/_status.log"
