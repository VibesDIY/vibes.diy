# The credential can't touch the transcript — so the agent can't be the one holding it

Source: `claude/clerk-signin-token-qa-login` (live end-to-end verification + main-path promotion)

The Clerk sign-in-token design (mint a one-time ticket, consume it in the browser)
was authored against Clerk's docs but unproven. This session proved it end-to-end
on **both** instances (prod `clerk.vibes.diy`, dev/preview `*.clerk.accounts.dev`):
ticket → `signIn.create({ strategy: "ticket" })` → `setActive` → a real Clerk
session (httpOnly `__session` cookie + a valid session JWT), `window.Clerk` exposed
and reliable, zero Turnstile challenge. The mechanism is exactly what the docs
promised.

The interesting part was *how* it had to be driven. The original plan: the agent
runs `TOKEN=$(mint …)`, then pastes `$TOKEN` into a chrome-devtools `evaluate_script`
body. That can't work — and not for a flaky reason. The minted token is a
credential, and the harness security classifier **blocks materializing it into the
agent's transcript or any tool-call argument**. It refused a plain `cat` of the
token. Which means the entire "agent interpolates the token into a script" flow is
structurally impossible, not just discouraged.

So the fix wasn't a workaround — it *was* the main path. A single script
(`clerk-qa-login.mjs`) mints and consumes in one process: the token is born,
passed to the page as a function argument, and consumed, **never crossing the
agent's context**. The agent only ever sees `{ "PASS": true, "clerkUserId": "…" }`.

Angles worth a full post:

1. **"The agent must not see the secret" is an architectural constraint, not a
   logging rule.** We usually phrase secret-hygiene as "don't print it." But when
   the agent is an LLM whose every tool call is transcribed, "don't print it"
   escalates to "the agent cannot be the component that holds it." That flips the
   design: anything touching a live credential moves *out* of the agent loop into a
   process the agent only starts and reads a sanitized result from. The classifier
   enforcing this turned a soft guideline into a hard interface boundary — and the
   resulting design is cleaner for it.

2. **A blocked action can be a design signal, not an obstacle.** The denial on
   `cat token` wasn't friction to route around; it was the system telling us the
   token-handling belonged somewhere else. The right response to "you may not
   materialize this" is "then make it the script's job," not "find another way to
   materialize it."

3. **Verifying a thing teaches you the docs about it were wrong.** Reading
   `window.Clerk.frontendApi` on each origin to confirm instance-match surfaced a
   latent error: the spec lumped `cli` with the *preview* instance. `cli-v2` is an
   *exact prod clone* — same Clerk — so it's the **prod** instance. The spec/skill
   said the opposite. You don't find that by reasoning about the design; you find
   it by running it against reality and reading what the runtime actually reports.

4. **Promote the proof to the tool.** The script that proved the flow *is* the
   shipping login mechanism — not a throwaway verifier beside a "real" one. When a
   verification harness keeps a credential in-process and emits only evidence,
   that's not scaffolding; that's the production shape. Ship it as the main path.
