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

Replaces the gating clause at `system-prompt.md:20` ("Gate write surfaces on `viewer`…"). Canonical wording (final text tuned during implementation):

> **Gate every write surface on `useVibe(dbName).can`.** `const { me, can, ready } = useVibe("comments")` — pass the Fireproof database name you're writing to. Show the editor/compose UI when `can.create(draft).ok` (or `can.edit(doc)` / `can.delete(doc)`); otherwise render its `.reason` as the fallback copy (e.g. the sign-in or join prompt). `can.*` runs the app's own `access.js` — the same function the server enforces — so never re-derive permissions from `viewer`, `isOwner`, or document fields. Gate access-sensitive UI on `ready` to avoid a half-resolved flash. Use `useViewer()` only for identity display: `ViewerTag`, avatars, and showing who's signed in. Writes can still be rejected server-side even when `can.*` allows — keep the optimistic-write + rollback handling.

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
3. **`getDefaultSkills()`** — add `"use-vibe"` so the doc is always injected (gating "applies to every app", same rationale that keeps `use-viewer` default). `use-viewer` stays in the defaults (identity is still universal).
4. **`prompts/pkg/system-prompt.md`** — rewrite:
   - the main gating rule (line ~20),
   - the scaffold / output-format guidance (lines ~52–56, ~344) — keep the `useViewer` destructure for `ViewerTag`/identity, add the `useVibe` gate, drop "gate with `access.hasRole()` / `access.hasChannel()`",
   - the worked examples (lines ~328–432) — flip `Compose`/`Feed` gating from `if (!viewer)` / `access.hasRole()` to `can.create(...)`, keeping `ViewerTag` from `useViewer`.
5. **`prompts/pkg/prompts.ts`** — update the pre-allocation vocabulary (line ~50) and the enrichment sentences (lines ~125, ~141) that currently teach `useViewer().can('write')` (the old ACL boolean) → `useVibe().can`.
6. **`prompts/pkg/llms/use-viewer.md`** — trim gating guidance to identity/`ViewerTag`; add a one-line pointer: for write gating, see use-vibe.
7. **`prompts/pkg/system-prompt-initial.md`** and **`notes/vibes-app-jsx.md`** — align any gating guidance to the single rule (scan-and-fix; both are author-facing).

## Testing

Prompt assembly is deterministic and there are existing tests in `prompts/tests/` (`prompt-builder.test.ts`, `initial-system-prompt.test.ts`). Add assertions that the assembled base system prompt:

- **contains** the new rule surface — `useVibe(` and the `can.create` / `.reason` gating phrasing;
- **injects the use-vibe doc by default** — when no skills are selected (default-skills path), the concatenated llms text includes the `use-vibe` doc block (e.g. its `<…-docs>` label), proving `getDefaultSkills()` carries it;
- **no longer contains** the retired gating text — the literal "Gate write surfaces on `viewer`" and `useViewer().can('write')` strings are gone (a regression guard against the old guidance creeping back).

Plus a small unit assertion that `useVibeConfig` is present in `allConfigs` / the catalog with the right `importModule`/`importName`, so the generated import statement (`import { useVibe } from "use-vibes"`) is emitted.

## Scope / non-goals

- **No migration** of the ~197 live vibes (Plan B). Old apps keep running on the untouched runtime + `useViewer` surface.
- **No `can.see`** / read gating (reads are server-filtered; the hook has no `can.see` yet).
- **No telemetry wiring** (the slice-3 dev-warn seam stays; full `unknown`-rate metrics are a later Plan-A item).
- **No hook/runtime/wire changes** — slice 3 shipped the hook; this slice only changes what the model is taught.
- **`useViewer()` is not removed or deprecated in code** — it stays exported and fully working; the prompt just stops teaching it as a gate.

## Rollout & reversibility

Prompt-only and additive. New generations start authoring against `useVibe().can`; existing apps are untouched. This is the A-side experiment that decides whether the approach is worth migrating to (the master spec's A→B gate: proceed to migration only when new apps gate correctly and read cleanly, `unknown` telemetry stays near ~0%, and the parity matrix is green). If generation quality disappoints, **revert the prompt change** and new apps return to the old surface immediately — the dormant helper can stay shipped (additive, unused) or be removed; either way nothing breaks.
