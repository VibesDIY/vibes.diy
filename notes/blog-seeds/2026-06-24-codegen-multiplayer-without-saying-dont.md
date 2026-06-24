# Steering codegen toward multiplayer without ever saying "don't"

Source: `claude/prompt-per-object-collaboration` (follows the ratified access-model doc)

The design doc concluded that owner-only generated apps are a latent-surprise bug — they work
for the creator and are silently broken for every visitor. The interesting part is how you
encode that in a system prompt *without* naming the anti-pattern: telling a model "don't make
owner-only apps" both raises the salience of the bad shape (pink-elephant tokenization) and
violates the project's own "never enumerate limits" rule. The fix is to flip it to a positive,
intent-anchored litmus — "when a stranger opens the app, can they do the thing it's *for*?" —
which makes multiplayer the default *and* still permits the legit owner-published blog (the
stranger's job there is to read). Worth a post on negative-tokenization-as-prompt-smell and the
"examples bias / grammar enables" discipline: feature the targets as recipes, describe the
primitives as grammar, and let the model reach the messy edges only by composition.
