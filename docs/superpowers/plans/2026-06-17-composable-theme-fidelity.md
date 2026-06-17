# Composable theme fidelity — implementation plan

> **For agentic workers:** implement task-by-task. Steps use checkbox (`- [ ]`)
> syntax. Land tasks 1–3 (composer + data) before 4–6. Do NOT start until the
> spec's open questions are resolved by review — Q1 (data source), Q2
> (`secondary`), Q3 (discipline strictness), Q5 (architecture) can each reshape
> tasks 1–3.

**Goal:** Recover pre-#2199 generation quality while keeping full live palette
swap, by making the canonical-only `:root` contract complete and theme-accurate
for every theme and stopping the prompt from fighting the model.

**Architecture:** Keep the canonical-only `:root` swap contract. Rebuild every
`colors/<slug>.yaml` from its exemplar `:root` (complete canonical light+dark +
structural + bespoke extras), harden `deriveCanonical` so no slot is ever
missing, fix the invalid-JS `classNames` example, reframe the discipline block
from "VERBATIM/FORBIDDEN" to "canonical is the swap contract; build richness on
top of it," scoped prose re-enrichment, and a catalog-wide completeness test
that locks all of it in.

**Tech Stack:** TypeScript, Node ESM scripts, vitest. No new deps.

**Spec:** `docs/superpowers/specs/2026-06-17-composable-theme-fidelity-design.md`
**Issue:** VibesDIY/vibes.diy#2356
**Branch:** `claude/youthful-edison-rxswrb`

---

## File Map

**Create:**

- `prompts/scripts/rebuild-colorsets-from-exemplars.mjs` — deterministic yaml rebuilder.
- `prompts/tests/theme-completeness.test.ts` — catalog-wide guardrail suite.

**Modify:**

- `prompts/pkg/themes/colorsets.ts` — `deriveCanonical` backfill; valid-JS `classNames`; discipline-block reframing.
- `prompts/pkg/themes/colors/*.yaml` — rebuilt (44 files, script output).
- `prompts/pkg/themes/colorsets-bundle.ts` — regenerated.
- `prompts/pkg/themes/*.md` — scoped prose enrichment (task 4).
- `prompts/tests/themes.test.ts` — update any snapshot/assertions affected by the discipline reframe.
- `eval/codegen-edit/prompts/seed.jsonl` — theme-stressing entries.

**Commit cadence:** one commit per task. Run from repo root unless noted.

---

## Task 1: Harden the composer (backfill + valid JS) — TDD

**Files:** `prompts/pkg/themes/colorsets.ts`, `prompts/tests/themes.test.ts`

- [ ] **Step 1 — failing tests.** In a new `describe("deriveCanonical backfills every core slot")` in `themes.test.ts`, assert that for a yaml with only `background` + `text-primary`, the composed `:root` contains `--surface`, `--secondary`, `--border`, `--text-secondary`, `--primary`, `--accent` (non-empty) **and that each value is a valid CSS color** (e.g. `CSS.supports('color', value)` under jsdom, or assert the derived `text-secondary` matches `/^color-mix\(in srgb, var\(--text-primary\)/`). A non-empty check alone is insufficient — a malformed `color-mix` would pass it while breaking `text-[var(--text-secondary)]`. Add a test that the emitted `classNames` example parses: `expect(() => new Function(exampleBlockJs)).not.toThrow()` (extract the ```js block). Run from the prompts-test workspace: `cd prompts/tests && pnpm vitest run themes.test.ts`(equivalently`pnpm --filter @vibes.diy/prompts-test exec vitest run themes.test.ts`). The `vibes.diy/tests`dir is a different workspace and has no`vitest` bin for these files. → expect FAIL.
- [ ] **Step 2 — implement backfill** in `deriveCanonical()`: add `surface←background`, `secondary←accent??primary`, `border←text-primary??neutral`, and `text-secondary` as a **valid CSS color expression built from `var()` refs**, not bare identifiers: `out["text-secondary"] = "color-mix(in srgb, var(--text-primary) 60%, var(--background))"` (only when both source slots exist; else fall back to a concrete neutral mid). Using `var(--…)` (rather than the resolved values) keeps the derived secondary correct under a live palette swap, since `:root` re-resolves it when `--text-primary`/`--background` change. Add last-resort `background`/`text-primary` neutrals so the `:root` is never empty. Keep existing primary↔accent + state fills. Order matters — fill `primary/accent` first, then `secondary`, then surface/border/text-secondary.
- [ ] **Step 3 — fix `classNames` keys** in `renderTokenDisciplineBlock`'s `tokenList`: quote each key — `  '${k}': 'bg-[var(--${k})]',`. (Also fixes `container`/`body` consistency — those are already valid.)
- [ ] **Step 4 — run** the themes test → expect PASS. Then `pnpm --filter @vibes.diy/prompts build`.
- [ ] **Step 5 — commit:** `fix(prompts): backfill every canonical slot + valid-JS classNames example (#2356)`.

## Task 2: Rebuild colorsets from exemplars

**Files:** `prompts/scripts/rebuild-colorsets-from-exemplars.mjs`, `prompts/pkg/themes/colors/*.yaml`, `prompts/pkg/themes/colorsets-bundle.ts`

> Gated on spec Q1/Q2. If review rejects the exemplar source, swap the input
> here; the rest of the plan is unchanged.

- [ ] **Step 1 — write the script.** For each `exemplars/<slug>/App.jsx`: parse the light `:root {…}` and the `@media (prefers-color-scheme: dark){ :root {…} }` block; collect `--name: value` pairs; map names through `TOKEN_ALIASES` from `colorsets.ts` (import it) into canonical `colors`/`colorsDark`; route unaliased names to `extras`/`extrasDark`; pull `font-family` from the catalog `bodyFont` (import `vibesThemes`), and `radius*/spacing/border-width` from the theme `.md` frontmatter (`rounded:`/`spacing:`) when present; emit `colors/<slug>.yaml` in the exact format `renderColorBlock` expects (quoted values). Deterministic ordering (canonical order then extras).
- [ ] **Step 2 — dry-run + eyeball.** Run with a `--dry-run` that prints, for each slug, the canonical slots filled vs. derived. Confirm no theme is missing a core color from a real exemplar value (only `secondary` should commonly derive). Spot-check aether/desktop/neon/edge/terminal (the worst pre-fix offenders).
- [ ] **Step 3 — write the 44 yamls** and regenerate the bundle (existing `extract-colorsets.mjs` / bundle step — reuse its bundle writer, or add bundle emission to the new script). `git diff --stat prompts/pkg/themes/colors` → 44 files.
- [ ] **Step 4 — verify** with the scan from #2356: every colorset now reports `MISSING: -` (or only `secondary`, which `deriveCanonical` fills). Compose aether and confirm the `:root` now carries `--background:#dcbfa6`, `--surface`, `--accent:#cfa562`, `--border`, real fonts.
- [ ] **Step 5 — commit:** `fix(prompts): rebuild all 44 colorsets complete from exemplars (#2356)`.

## Task 3: Rebalance the discipline block

**Files:** `prompts/pkg/themes/colorsets.ts`, `prompts/tests/themes.test.ts`

> Gated on spec Q3. If review wants strict-only, skip the "encourage richness"
> reframe and instead lean on task 4.

- [ ] **Step 1 — reframe** `renderTokenDisciplineBlock` prose: replace "copy VERBATIM / DO NOT introduce … FORBIDDEN to add anything" with the positive framing from the spec §3 — canonical `:root` is the swap contract; express core surfaces/text/actions/borders through it; build richness _on top_ (gradients/shadows/decorative pseudo-elements/`color-mix(...,var(--canonical))`); bespoke flourish values may be inlined locally, never in `:root`. Keep the "no color literals in bracket classes" + dark-mode rules.
- [ ] **Step 2 — update** any `themes.test.ts` assertions that pinned the old wording (e.g. checks for `"VERBATIM"` / `"DO NOT introduce theme-specific tokens"`). Replace with assertions on the new contract language; keep the structural-bracket and no-`bg-[#hex]` checks.
- [ ] **Step 3 — run** themes test → PASS. `pnpm --filter @vibes.diy/prompts build`.
- [ ] **Step 4 — commit:** `feat(prompts): reframe token-discipline block as swap contract, not gag (#2356)`.

## Task 4: Scoped prose re-enrichment

**Files:** `prompts/pkg/themes/*.md`

> Gated on spec Q4. Default: light touch on the thinnest themes; expand only if
> review asks. Token fixes (1–3) are the primary quality lever.

- [ ] **Step 1 — pick targets:** the thinnest bodies (broadsheet, specimen, chrono, signal, palate, dossier, nexus, slab — ~100–170 words) plus any theme whose generated output the eval (task 6) flags as still weak.
- [ ] **Step 2 — enrich** each with concrete component recipes (nav/hero/card/table/buttons), decoration, and interaction, using canonical `{{token}}` names only (mirror brutalist.md's depth, scaled down). No inline hex/oklch in prose.
- [ ] **Step 3 — verify** no new unresolved `{{token}}` (task 5 test covers this). Commit: `feat(prompts): re-enrich thin theme prose with canonical token recipes (#2356)`.

## Task 5: Catalog-wide completeness guardrail

**Files:** `prompts/tests/theme-completeness.test.ts`

- [ ] **Step 1 — write the suite.** `it.each(vibesThemes)` → load `themes/<slug>.md` + `colors/<slug>.yaml`, `composeDesignMd`, then assert:
  - all 8 core canonical color tokens present + non-empty in the emitted `:root`;
  - all 8 structural tokens present;
  - structural is not the all-defaults set for themes expected to differ (assert at least one of font-family/radius ≠ generic default across the catalog; allow a small explicit allow-list of genuinely-default themes);
  - the ```js classNames example parses (`new Function`);
  - no `{{…}}` placeholders remain in the composed body;
  - when `colorsDark` present, its key set ⊇ the core canonical set.
- [ ] **Step 2 — run** `cd prompts/tests && pnpm vitest run theme-completeness.test.ts` (the `@vibes.diy/prompts-test` workspace — not `vibes.diy/tests`) → all 44 PASS (this is the proof tasks 1–2 worked). Fix data/derivation until green.
- [ ] **Step 3 — commit:** `test(prompts): catalog-wide theme completeness guardrail (#2356)`.

## Task 6: Eval + full check + ship

- [ ] **Step 1 — cheap diff loop.** Script-compose every theme before/after (git stash) and diff `:root` blocks; attach the aether/desktop/neon/edge before→after to the PR.
- [ ] **Step 2 — generation eval.** Add 2–3 theme-stressing entries to `eval/codegen-edit/prompts/seed.jsonl` (historic-tour-ish, story-crossroads-ish); run with pinned `theme`/`colorTheme`; render + screenshot output; compare to pre-#2199 look. (Requires `vibes-diy login` + eval access — run wherever creds exist; capture artifacts in the PR.)
- [ ] **Step 3 — full check.** `pnpm check` green. Rerun flaky suites in isolation per `agents/flaky-tests.md` before treating a failure as real. Run `pnpm run rules-bag:constructors`.
- [ ] **Step 4 — prettier** changed files; commit any formatter-only diff separately.
- [ ] **Step 5 — update the PR** body with before/after screenshots + the completeness scan, then post the `Rollout watch 🔭` comment and add `ready-to-merge` (per `agents/pr-lifecycle.md`). Do NOT merge without explicit confirmation.

---

## Self-review notes

- **Quality-vs-swap trade** lives in tasks 2 (complete data) + 3 (discipline
  reframe); both are gated on review (Q2/Q3/Q5). Land 1+5 first if review
  stalls — the composer backfill + guardrail alone removes the color-less
  `:root` failure even before the data rebuild.
- **Determinism:** task 2's script is the reviewable artifact; yaml diffs must
  be reproducible by re-running it.
- **No silent placeholders:** task 5 fails on any unresolved `{{token}}`.
