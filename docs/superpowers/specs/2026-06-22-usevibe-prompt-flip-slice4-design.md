# Prompt/guidance flip to `useVibe().can` — client access-helper, slice 4

**Date:** 2026-06-22
**Status:** Approved — ready to split into an implementation plan
**Parent spec:** [`2026-06-21-client-access-helper-design.md`](./2026-06-21-client-access-helper-design.md) (Plan A, step 2)
**Builds on:** slice 1 (client `access-runner`, #2503), slice 2a (`accessFnSource` RPC, #2505), slice 2c (source delivery, #2508), slice 3 (`useVibe()` hook, #2520)

## Summary

Flip the codegen guidance so new generations gate write surfaces on `useVibe(dbName).can.*` and render its `reason` as the fallback copy — **one rule** — instead of hand-combining `viewer` / `isOwner` / `access.hasRole()` / `access.hasChannel()`. `useViewer()` stays for identity and display (`ViewerTag`, avatars) only; the prompt stops teaching it as a gate.

This is the step that makes the slice-3 hook (shipped dormant, exported-but-unused) actually exercised. It is **prompt/guidance only** — no runtime, hook, or wire changes — so the whole experiment is reversible by reverting the prompt (the master spec's A→B kill-switch). It touches **no existing app**: the 197 live vibes keep running on the untouched runtime and the old `useViewer` surface, which stays fully importable.

## Why

The root-cause bug (a signed-in owner told "Sign in to compose") came from `App.jsx` hand-rolling a gate off identity. The prompt's own rule was the wrong gate: it said **"Gate write surfaces on `viewer`"** and "gate further with `access.hasRole()` / `access.hasChannel()`" — primitives the UI must correctly combine to re-implement, in a different vocabulary, whatever `access.js` does server-side. It drifts. Slice 3 shipped `useVibe().can`, which runs the app's own `access.js` in the client. Slice 4 makes the guidance teach that single surface, so the easy path is the correct path.

## The single rule

Replaces the gating clause at `system-prompt.md:20` ("Gate write surfaces on `viewer`…"). Expressed as a hard rule (per review — final text tuned during implementation), anchored to one worked line `const { me, can, ready } = useVibe("comments")` (pass the Fireproof db you're writing to):

- **Gate every write affordance/action on `useVibe(dbName).can.*`** — show the editor/compose UI when `can.create(draft).ok` (or `can.edit(doc)` / `can.delete(doc)`).
- **While `ready` is false, show neutral skeleton/disabled UI** (avoid a half-resolved flash).
- **If denied, render `reason` as the fallback copy** (e.g. the sign-in or join prompt).
- **Never derive write auth from `viewer` / `isOwner` / `access.*` in UI gates** — `can.*` runs the app's own `access.js`, the same function the server enforces.
- **`useViewer()` is identity/display-only** — `ViewerTag`, avatars, showing who's signed in.
- Writes can still be rejected server-side even when `can.*` allows — keep the optimistic-write + rollback handling.

Decisions baked in (from brainstorming):

- **`can.*` everywhere; `isOwner` display-only.** Owner-only management UI (settings, moderation) is gated on `can.*` too — the app's `access.js` encodes the owner-only rule (e.g. `requireRole` / an `isOwner` check), and the UI gates on the verdict. `me.isOwner` / `useViewer().isOwner` may be used for cosmetic hints, never as the gate.
- **Reads need no client gate.** Reads are server-filtered; there is no `can.see` yet, so the prompt teaches write gating only and does not tell authors to gate reads.
- **`unknown` → optimistic is invisible to the author.** The hook returns `{ ok: true }` on an unevaluable source; the existing optimistic-write + server-rejection + rollback pattern (already mandated by the prompt) is the seatbelt.

## File surface (full flip)

1. **New `prompts/pkg/llms/use-vibe.md`** — the doc injected into the system prompt. Teaches:
   - `const { me, can, ready } = useVibe(dbName)` and what `dbName` is (the db being written).
   - The verdict shape `{ ok: boolean, reason?: string }` for `can.create(draft)` / `can.edit(doc)` / `can.delete(doc)`.
   - The gate-and-render-`reason` pattern, with one worked micro-example (the garden-gnome `PromptBar`: gate the compose bar on `can.create`, render `reason` as the sign-in hint).
   - `ready` skeleton-gate.
   - Composition: identity/avatars come from `useViewer()` (`ViewerTag`), gating from `useVibe()`.
   - `access.js` is the source of truth `can.*` runs; owner-only management → encode it in `access.js`, gate UI on `can.*`.
   - Server stays authoritative — handle write rejection/rollback even when `can.*` is `ok`.
2. **New `prompts/pkg/llms/use-vibe.ts`** — `LlmConfig` (`name: "use-vibe"`, `label`, `description`, `importModule: "use-vibes"`, `importName: "useVibe"`). Registered in `prompts/pkg/llms/index.ts` (`allConfigs`).
3. **Skill injection — `use-vibe` + `use-viewer` must be force-injected on every generation** (`prompts/pkg/prompts.ts`). Gating and identity are universal, so both docs must always reach the assembled prompt. Two facts make this non-trivial:
   - `getDefaultSkills()` currently returns only `["fireproof", "callai", "image-gen", "web-audio"]` — **`use-viewer` is _not_ a default skill** (it is normally selected by the pre-allocation LLM via `active.skills`). So "add `use-vibe` to the defaults" is insufficient.
   - When a session provides a skills list, `selectedNames` is that list and the defaults are **bypassed** (`makeBaseSystemPrompt`: defaults apply only when `selectedNames.length === 0`). So a doc that must always appear cannot rely on the defaults path.
     Therefore: unconditionally include `use-vibe` and `use-viewer` in `selectedNames` (force-add after selection, dedup) so both the no-skills path and the pre-alloc path always inject the gating + identity docs and emit `import { useVibe, useViewer } from "use-vibes"`. Also add `use-vibe` to `getDefaultSkills()` for completeness.
4. **`prompts/pkg/llms/fireproof.md`** — a default skill, **always injected**, and it currently teaches the retired gate directly: "Write surfaces are gated with `viewer` (signed in?), `access.hasChannel()` (channel access), or `isOwner` (management)" plus `access.hasRole()` / `access.hasChannel()` UI-gating examples (the `Comments` example ~368–378, the summary ~387). Rewrite the **client UI write-gating** guidance here to the single `useVibe().can` rule, the same as `system-prompt.md`. Distinctions to preserve:
   - The **`access.js` examples are server-side code** (e.g. `if (!user.isOwner) throw { forbidden: "owner only" }`) — those stay; they are where the owner-only/channel rules are _authored_, which is exactly what `can.*` then runs.
   - The **`useFireproof().access` object stays a documented, available API** (it is not being removed from the runtime) — but it is no longer _taught as the write-surface gate_; write gating redirects to `useVibe().can`, with a one-line pointer.
5. **`prompts/pkg/system-prompt.md`** — rewrite:
   - the main gating rule (line ~20),
   - the scaffold / output-format guidance (lines ~52–56, ~344) — keep the `useViewer` destructure for `ViewerTag`/identity, add the `useVibe` gate, drop "gate with `access.hasRole()` / `access.hasChannel()`",
   - the worked examples (lines ~328–432) — flip `Compose`/`Feed` gating from `if (!viewer)` / `access.hasRole()` to `can.create(...)`, keeping `ViewerTag` from `useViewer`.
6. **`prompts/pkg/prompts.ts`** — update the pre-allocation vocabulary (line ~50) and the enrichment sentences (lines ~125, ~141) that currently teach `useViewer().can('write')` (the old ACL boolean) → `useVibe().can` (in addition to the force-inject change in item 3).
7. **`prompts/pkg/llms/use-viewer.md`** — trim gating guidance to identity/`ViewerTag`; add a one-line pointer: for write gating, see use-vibe.
8. **`prompts/pkg/system-prompt-initial.md`** and **`notes/vibes-app-jsx.md`** — align any gating guidance to the single rule (scan-and-fix; both are author-facing).

(Items 1–2 add the `use-vibe` doc + its `LlmConfig`; item 3 makes it — and `use-viewer` — always injected; item 4 stops `fireproof.md` from re-teaching the old gate.)

## Testing

Prompt assembly is deterministic and there are existing tests in `prompts/tests/` (`prompt-builder.test.ts`, `initial-system-prompt.test.ts`). Add assertions that the assembled base system prompt:

- **contains** the new rule surface — `useVibe(` and the `can.create` / `.reason` gating phrasing;
- **always injects both the `use-vibe` and `use-viewer` docs** — assert it on **both** the no-skills path (`getDefaultSkills()`) **and** a provided-skills path (a non-empty `skills` list that omits them), proving the force-inject (item 3), not just the default. Check for both `<…-docs>` blocks and the generated `import { useVibe, useViewer } from "use-vibes"`;
- **no longer contains the retired gating text** anywhere in the assembled default prompt — a regression guard for the literals: "Gate write surfaces on `viewer`", `useViewer().can('write')`, **and `fireproof.md`'s "Write surfaces are gated with `viewer`…"** (this last one is the catch Codex flagged — `fireproof.md` is always injected, so the test must assert against the _assembled_ prompt, not just `system-prompt.md`).

Plus a small unit assertion that `useVibeConfig` is present in `allConfigs` / the catalog with the right `importModule`/`importName`, so the generated import statement is emitted.

_Optional (per review), deferred:_ a single smoke/golden generation check that real generated code uses `useVibe(...).can` + `reason` and does not emit `useViewer().can('write')`. Deferred because it requires a live model call (slow, non-deterministic) — better suited to the A→B evaluation gate (where generation-quality is the actual signal) than to this slice's deterministic prompt-assembly tests.

## Scope / non-goals

- **No migration** of the ~197 live vibes (Plan B). Old apps keep running on the untouched runtime + `useViewer` surface.
- **No `can.see`** / read gating (reads are server-filtered; the hook has no `can.see` yet).
- **No telemetry wiring** (the slice-3 dev-warn seam stays; full `unknown`-rate metrics are a later Plan-A item).
- **No hook/runtime/wire changes** — slice 3 shipped the hook; this slice only changes what the model is taught.
- **`useViewer()` is not removed or deprecated in code** — it stays exported and fully working; the prompt just stops teaching it as a gate.

## Rollout & reversibility

Prompt-only and additive. New generations start authoring against `useVibe().can`; existing apps are untouched. This is the A-side experiment that decides whether the approach is worth migrating to (the master spec's A→B gate: proceed to migration only when new apps gate correctly and read cleanly, `unknown` telemetry stays near ~0%, and the parity matrix is green). If generation quality disappoints, **revert the prompt change** and new apps return to the old surface immediately — the dormant helper can stay shipped (additive, unused) or be removed; either way nothing breaks.
