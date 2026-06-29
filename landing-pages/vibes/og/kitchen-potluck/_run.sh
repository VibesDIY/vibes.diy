#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/kitchen-potluck"
cd "$HERE"
gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}
: > "$HERE/_status.log"

gen "potluck-who-brings-what" "Build a single-file React app called Potluck Sign-Up Board. Use Fireproof via useFireproof from 'use-fireproof' so multiple guests sharing the link see live updates instantly. The screen shows five fixed category columns: Appetizer, Main, Side, Dessert, Drink. Each column lists current claims as cards: who is bringing it (name) and what dish, plus optional dietary tags chosen from chips: Vegan, GF, Nut-free, Dairy-free. Empty columns display a subtle italic placeholder 'needs claimer' in muted grey. At the bottom of each column is a small inline form: name input, dish input, dietary chip toggles, and an 'add' button that saves a doc shaped { type:'claim', category, name, dish, diet:[], createdAt }. Each card has a tiny X to remove your claim. Use a warm friendly tone, soft cream background, hand-written serif headings, simple flat colors per category. Show a count like '12 dishes claimed' at top. No login. Mobile-friendly single screen."

gen "pyrex-return-tracker" "Build a single-file React app called Pyrex Return Tracker — 'whose tupperware is this?'. Use Fireproof via useFireproof from 'use-fireproof' for live sync across the host's family devices. Top of the screen has an add form: a file/camera input for a photo (store as Fireproof _files attachment), a short dish description text field ('lasagna pan, glass lid'), and an owner name field. Submit saves a doc shaped { type:'pyrex', desc, owner, photo, returned:false, createdAt }. Below, a responsive grid shows all unreturned containers as polaroid-style cards: photo thumbnail, owner name in bold, dish description, and a big green 'Mark Returned' button. Returned items move to a collapsible 'Returned ✓' section at bottom showing struck-through entries. Tone: a little weary, a little funny — header subtitle 'the fridge graveyard solver'. Friendly kitchen palette, rounded cards, mobile-first."

gen "leftover-claim-board" "Build a single-file React app called Leftover Claim Board for the end of a potluck or dinner party. Use Fireproof via useFireproof from 'use-fireproof' for live realtime sync — host posts, guests claim, everyone sees instantly. Host form at top: dish name, approximate size/portions ('half a tray', 'about 3 cups'), and 'post leftover' button. Saves doc { type:'leftover', dish, size, claims:[{name, portion}], thumbsUp:[names], resolved:false, createdAt }. Each leftover renders as a card with dish name, size, a thumbs-up button (toggle your name in thumbsUp), a 'Claim a portion' inline form (name + how much), and a list of current claimants. Host can mark resolved which greys it out. Bright friendly palette, casual tone — copy like 'who wants the rest of the pasta?'. Single screen, mobile-first, no login, just type your name each time."

gen "recipe-crowd-multiplier" "Build a single-file React app called Recipe Crowd Multiplier. Use Fireproof via useFireproof from 'use-fireproof' so saved recipes persist and sync across devices. Top: a big textarea where the user pastes a recipe (assume base 4 servings), and a number input 'I'm feeding ___ people'. Parse each line for quantity + unit + ingredient using a regex covering decimals, fractions (1/2, 1 1/2), cups, tbsp, tsp, oz, lb, g, ml. Multiply by feeding/4 and re-round sensibly: convert decimals back to nearest common fraction (¼, ⅓, ½, ⅔, ¾) so '2.67 cups' renders '2¾ cups'. Show two side-by-side panels: left = original parsed recipe, right = scaled recipe with rounded amounts highlighted. A 'Shopping List' button below produces a clean printable list grouped by ingredient with totals. Save current recipe as doc { type:'recipe', text, servings, scaledFor, createdAt } via a 'save' button; show a sidebar list of saved recipes to reopen. Warm cookbook tone, serif type, ivory paper background."

wait
echo "ALL DONE" >> "$HERE/_status.log"
