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

gen oulipo-constraint-generator "Build an Oulipo constraint generator and workshop. The user picks a writing constraint — lipogram (writing without a specific letter, as in Perec's A Void), N+7 (replace every noun with the noun 7 entries later in the dictionary), snowball (each line one word longer than the last), prisoner's constraint (using only letters without ascenders or descenders), or acrostic — and gets a clear explanation of the rule, an example from Oulipo literature, and a writing prompt to try the constraint themselves. Show how each constraint reveals something about language that unconstrained writing hides. Include the Oulipo manifesto's argument that constraint enables rather than restricts creativity."
gen aleatoric-writing-tool "Build an aleatoric writing workshop. The user picks a chance operation for generating text — Burroughs cut-up (physical cutting and rearranging of text), dice-roll word selection, random selection from a word list, found text from a newspaper opened to a random page, or I Ching hexagram prompts — and the app walks them through applying the operation to produce a short piece. After the piece is made, explore the question of authorship: what did the chance operation decide, what did the writer decide, and who is the author of the result? Cover Cage, Burroughs, Tzara, and Fluxus as practitioners."
gen language-model-authorship-quiz "Build a language model authorship quiz and discussion tool. The user reads a series of excerpts — some human-written, some AI-generated, some co-written — and makes their best guess about the origin of each. After revealing the answers, the app prompts a deeper question: what markers did you use to judge? What do those markers reveal about what we value in writing — intentionality, voice, surprise, emotional authenticity? Cover the Turing Test and its limitations, the concept of the implied author, and the legal and ethical questions around AI authorship. Help users think rigorously about what authorship means."
gen generative-text-workshop "Build a generative text workshop for writers interested in procedural and computational approaches. The user describes a text generation pattern — every third word must be a color, each sentence must begin where the previous one ended (using its last word), each line must have exactly 10 syllables, or the text must use only words from a specific source text — and the app helps them apply the pattern to generate a short piece. Explore how the constraint shapes what can and can't be said. Cover the relationship between proceduralism in writing and in computation. Reference Oulipo, Language Poetry, and contemporary generative literature."
gen divinatory-language-explorer "Build a divinatory language explorer for students interested in the linguistics and semiotics of interpretation. The user picks a divinatory system — Tarot, I Ching, Norse runes, Yoruba Ifá, Tibetan mo divination — and traces how its language creates meaning: the semantic field of the symbols, the interpretive tradition that has accumulated around them, the role of the querent in shaping the reading, and the relationship between the divinatory text and the interpreter's context. Cover how divinatory language is structurally different from propositional language and why that difference matters for thinking about meaning, agency, and knowledge."

wait
echo "ALL DONE" >> "$HERE/_status.log"
