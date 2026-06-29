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

gen close-reading-practice "Build a close reading practice tool for literature students. The user pastes a paragraph of fiction — any text works — and the app generates structured prompts to guide analysis: What is the narrative voice and point of view? Where does the syntax do something unexpected? What figurative language appears, and what does it do? What does this passage reveal about character, theme, or setting? What word or phrase would change the meaning most if swapped? Help students slow down and read with a critic's attention rather than a reader's speed. Include a vocabulary of literary terms as a reference panel."
gen literary-theory-lens "Build a literary theory lens selector. The user picks a text and a critical lens — Marxist criticism, psychoanalytic criticism, feminist criticism, postcolonial criticism, New Historicism, ecocriticism, queer theory — and sees what questions each approach would ask of the same passage. What does a Marxist reading find in the description of a great house? What does a feminist reading notice about who speaks and who is silent? What does a postcolonial reading see in the description of a foreign landscape? Help students understand that critical lenses reveal different aspects of the same text."
gen postcolonial-reading-guide "Build a postcolonial reading guide for canonical British and European literature. The user selects a canonical text — Conrad's Heart of Darkness, Kipling's Kim, Forster's A Passage to India, Defoe's Robinson Crusoe, Brontë's Jane Eyre — and sees what a postcolonial reading reveals: the Orientalist representations, the civilizing mission ideology, the subaltern characters whose perspectives are absent or distorted, and the colonial economic structures that underpin the narrative. Draw on Said's Orientalism, Spivak's 'Can the Subaltern Speak?', and Achebe's critique of Conrad. Help students read against the grain."
gen genre-identification-quiz "Build a genre identification quiz for literature students. The user reads excerpts from fiction and identifies the genre markers: Gothic (sublime landscape, ancestral secrets, psychological horror, the uncanny), Bildungsroman (the protagonist's development through experience, the coming-of-age journey), modernist stream of consciousness (fragmented syntax, interior monologue, nonlinear time), or postmodern metafiction (self-referential narration, unreliable narrator, genre parody). For each genre, show the conventions, the historical context in which it emerged, and canonical examples. Help students use genre as an analytical category."
gen feminist-literary-criticism "Build a feminist literary criticism explainer and practice tool. The user picks a canonical text and traces how feminist critics — Woolf, Gilbert and Gubar, Showalter, hooks — have read it differently from the mainstream critical tradition. What female characters were dismissed or ignored? What woman writer's tradition was erased by the male-dominated canon? What does a feminist reading recover — a character's interiority, a subplot, a silenced voice? Cover the gynocritical approach (recovering women's writing traditions) and the critique of male texts (identifying misogynist structures in canonical literature). Help students apply feminist reading in practice."

wait
echo "ALL DONE" >> "$HERE/_status.log"
