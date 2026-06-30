# Teaching the codegen model when *not* to reach for the backend

Source: `claude/backend-js-b9-codegen-prompt` (B9 of #2856; the codegen-docs slice)

The backend.js codegen doc (`prompts/pkg/llms/backend-js.md`) is the primary delivery mechanism for
the whole feature — LLMs learn an API from worked examples, not type signatures — so the doc is built
around complete, copy-adaptable handlers (signature-verified webhook, OAuth code exchange, polling
`scheduled`, type-filtered `onChange`). But the load-bearing line in the doc isn't an example, it's a
*prohibition*: "emit `backend.js` ONLY when the app genuinely needs server-side logic; a calculator or
gallery needs none — don't emit one." The interesting bit is the prompt-engineering shape: it's an
**opt-in skill** (not in `getDefaultSkills`, no import line in its `LlmConfig`), so the doc only enters
the prompt when the app actually wants a backend — keeping it out of the 90% of prompts that don't, and
avoiding the failure mode where a model, handed a shiny new capability, sprinkles it everywhere. Worth
a post: (1) the "features as recipes, but say when NOT to use them" principle — the same instinct that
makes `requireAccess` guidance spend as much ink on when it *over-blocks* as on when to use it; (2) why
the codegen prompt is the real product surface for a server runtime (the model writes the backend, so
the doc is the API's UX); and (3) the sequencing tension — you can draft the teaching doc before the
runtime is live, but you can't *eval* it until handlers actually run, so the prompt change ships
hold-for-human and gated behind its own codegen eval.
