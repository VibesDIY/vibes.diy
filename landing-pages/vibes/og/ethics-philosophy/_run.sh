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

gen philosophy-of-mind "Build a philosophy of mind explainer. The user explores the mind-body problem: what is the relationship between the physical brain and conscious experience? Walk through the major positions — Cartesian substance dualism, property dualism, identity theory, functionalism, eliminative materialism — and the arguments for and against each. What is the hard problem of consciousness? What would it mean to solve it? Use thought experiments — Mary's Room, the Chinese Room, philosophical zombies, the brain-in-a-vat — to make the positions concrete. Help users understand why this problem has resisted solution and what is genuinely at stake."
gen applied-ethics-cases "Build an applied ethics case study tool. The user picks a moral dilemma — factory farming and animal welfare, wealthy nation obligations to global poverty, climate change and future generations, autonomous weapons development, AI in criminal sentencing — and works through it using three normative frameworks. Utilitarian analysis: what action maximizes overall welfare? Deontological analysis: what duties or rights are at stake? Virtue ethics: what would a person of good character do? Show where the frameworks agree, where they diverge, and why the divergence matters. Help users reason through moral complexity without reaching for easy answers."
gen free-will-moral-responsibility "Build a free will and moral responsibility tool. The user reads a scenario — someone raised in poverty commits a crime, a person under coercion makes a harmful choice, an addict harms their family, a CEO makes a decision that harms workers — and works through two questions: Is the person morally responsible? Should they be held legally accountable? Trace the compatibilist argument (free will is compatible with determinism), the hard incompatibilist argument (determinism eliminates moral responsibility), and the libertarian free will position. Apply each to the same case and see what changes."
gen epistemology-challenge "Build an epistemology challenge. The user picks an everyday belief — the external world exists, other minds exist, memories are reliable, scientific consensus is trustworthy — and traces its justification. What would Descartes say — can this belief survive radical doubt? What would Hume say — is it grounded in reason or habit? What would Kant say — is it a precondition of experience rather than a conclusion from it? What skeptical challenge can be raised and how has the tradition responded? Help users see epistemology not as abstract speculation but as the examination of the foundations of all knowledge."
gen metaethics-explainer "Build a metaethics explainer. The user explores the foundational question: are moral facts objective or socially constructed? Walk through the major positions — moral realism (moral facts exist independently of opinion), expressivism (moral statements express attitudes, not facts), constructivism (moral facts are constructed by rational agreement), and error theory (moral statements are all false because nothing has intrinsic moral value). What are the stakes? If moral realism is wrong, does anything go? If expressivism is right, what does moral argument accomplish? Help users understand metaethics as the study of what morality itself is."

wait
echo "ALL DONE" >> "$HERE/_status.log"
