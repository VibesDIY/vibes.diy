# use-fireproof to zero: the last real importer was a smoke test asserting the package resolves

Source: #2971 (`claude/design-spec-2905-au2501`)

After the SDK (#2957) and host (#2947) migrated onto Firefly, `use-fireproof`
(scoped `@fireproof/use-fireproof` + bare `use-fireproof`) was declared in 9
packages but *really* imported in exactly one file — `tests/app/mock-check.test.ts`,
whose entire body was `expect(typeof fireproof).toBe("function")`. A test that
asserts the raw npm package resolves, in a world where vibes never load it (the
import map rewrites `use-fireproof` → `@vibes.diy/vibe-runtime` at serve time).
Delete the vestigial smoke test, drop 8 nominal declarations, and it's at zero.

Two angles worth a post:

1. **Template-string fixtures look like imports to grep.** `eval/codegen-matrix`
   and the `normalizeComponentExports` tests contain `import { useFireproof } from
   "use-fireproof"` — but inside `` const passing = `...` `` template literals fed
   to the codegen normalizer/rubric. An anchored `^import` grep flags them as real
   imports; they resolve nothing. The declaration-vs-import method only works if
   you distinguish real imports from fixture strings, or you'll invent a hoist
   dependency that doesn't exist (I did, briefly).

2. **The lockfile delta tells you the risk class.** The protocol-type pin drops
   (#2970) removed only importer refs — 51 lines, zero `resolution:` entries. This
   one removed 705 lines *including* `resolution:`/`integrity` entries: dropping the
   last `use-fireproof` declaration evicted its entire transitive graph
   (core-runtime/keybag/gateways) from the lockfile. That package-graph eviction is
   the #2947 signature — safe here only because every one of those transitive
   packages is now at zero real imports (verified), with CI's docker test matrix as
   the actual gate rather than a local build.
