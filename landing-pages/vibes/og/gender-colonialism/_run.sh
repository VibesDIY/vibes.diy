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

gen settler-colonialism-explainer "Build a settler colonialism explainer. The user picks a settler colonial context — the United States, Australia, Palestine, South Africa, or Canada — and traces the logic of elimination that Patrick Wolfe describes: settler colonialism is a structure, not an event, organized around replacing rather than just exploiting indigenous populations. Show the specific mechanisms: land seizure, forced removal, assimilation policy (residential schools, boarding schools), legal erasure of indigenous title, and cultural suppression. Cover indigenous resistance and resurgence. Help users distinguish settler colonialism from other forms of colonialism and from racism as ordinarily understood."
gen intersectionality-case "Build an intersectionality case study tool. The user picks a historical figure or group — Black women in the antebellum South, Mexican farmworkers in the 1960s, queer immigrants in the 1980s AIDS crisis, Indigenous women facing environmental racism — and traces how gender, race, class, and sexuality intersect to shape their experience: not one axis of oppression alone but all of them at once, creating conditions that single-axis analysis misses. Draw on Crenshaw's original legal analysis and Collins's matrix of domination. Help users move from understanding intersectionality as a concept to applying it as an analytical method."
gen caribbean-diaspora-timeline "Build a Caribbean diaspora timeline. The user picks an island — Haiti, Jamaica, Puerto Rico, Trinidad, Cuba, Barbados — and traces the long arc: Atlantic slavery and the plantation economy, emancipation and its limits (apprenticeship, indenture, labor coercion), colonial rule and independence, and the diaspora migrations to the UK, the United States, Canada, and France. Show what was carried in diaspora — language, religion, music, food, political memory — and what was transformed. Cover creolization as a cultural process: how African, European, and indigenous elements blended under conditions of colonial violence to produce something new."
gen feminist-historiography-explorer "Build a feminist historiography explorer. The user picks a historical topic — war (women's roles in WWI and WWII), labor (women in industrial capitalism), empire (gender and colonial rule), religion (women's religious authority), or democracy (women's suffrage and its limits) — and sees what questions feminist historians asked that conventional history missed or minimized. Who was absent from the archival record, and why? Whose domestic labor was treated as natural rather than economic? Whose bodies were governed by colonial and racial policy? Cover the shift from women's history (recovering women's stories) to gender history (analyzing gender as a category of power)."
gen creolization-quiz "Build a creolization and cultural identity explorer. The user picks a Caribbean cultural practice — Haitian Vodou, Jamaican Rastafarianism, Cuban Santería, Trinidad Carnival, Surinamese Winti — and traces how it blended African, European, and indigenous elements under colonial conditions to create something new. Show the African religious retentions, the colonial pressures toward Christian conversion, the forms of cultural resistance and survival, and the contemporary expressions of the practice. Cover the debates among scholars: is creolization a story of loss, of resilience, or of creative transformation? Help users think about cultural mixture under conditions of violence and survival."

wait
echo "ALL DONE" >> "$HERE/_status.log"
