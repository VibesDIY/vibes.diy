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

gen reconstruction-timeline "Build a Reconstruction timeline and explainer (1865–1877). Cover the three Reconstruction amendments — 13th (abolition), 14th (citizenship and equal protection), 15th (Black male suffrage) — what each promised, what freedpeople organized to claim, and how each promise was dismantled. Show the political timeline: Radical Reconstruction, the rise of the Freedmen's Bureau, Black officeholding, the Compromise of 1877, and the rise of Jim Crow. Help users understand Reconstruction not as a failure but as a political achievement that was violently overthrown."
gen great-migration-tracker "Build a Great Migration explorer (1910–1970). The user picks a Southern city of origin — Natchez, Birmingham, New Orleans, Atlanta — and traces the migration routes north and west. Show what pushed people out: sharecropping debt, lynching, Jim Crow humiliation, and the boll weevil. Show what drew them: wartime industrial jobs, Black newspapers like the Chicago Defender, letters from relatives. Show what they found in Chicago, Detroit, New York, Los Angeles: industrial opportunity alongside redlining, housing segregation, and white ethnic hostility. Cover the Second Great Migration after WWII as well."
gen civil-rights-movement "Build a civil rights movement interactive timeline (1954–1968). The user picks a year and sees the key events, the organizations involved (NAACP, SCLC, SNCC, CORE), and the government responses at local, state, and federal levels. Show the tensions inside the movement: SNCC versus SCLC, nonviolent direct action versus armed self-defense, integrationism versus Black nationalism. Cover Montgomery, Little Rock, Greensboro, Birmingham, the March on Washington, Freedom Summer, the Civil Rights Act, the Voting Rights Act, and the turn toward Black Power."
gen racial-capitalism-cases "Build a racial capitalism case study explorer. The user picks an era — chattel slavery, Reconstruction and its overthrow, sharecropping and convict leasing, urban redlining, mass incarceration — and sees how racial hierarchy was encoded into economic structures. Show how these weren't aberrations from capitalism but integral to capital accumulation: slave labor as primitive accumulation, convict leasing as coerced labor, redlining as wealth extraction, mass incarceration as labor control. Help users see racial capitalism as a system across time, not a series of isolated injustices."
gen black-feminist-thought "Build a Black feminist thought reader and concept explorer. The user selects a concept — intersectionality (Crenshaw), the matrix of domination (Collins), the politics of respectability (Higginbotham), the erotic as power (Lorde), or situated knowledge (hooks) — and gets a clear explanation with historical examples. Show how each concept emerged from specific political and intellectual contexts: civil rights, second-wave feminism, the academy in the 1980s–1990s. Help users understand these not as abstract theory but as tools for analyzing power that emerged from lived experience."

wait
echo "ALL DONE" >> "$HERE/_status.log"
