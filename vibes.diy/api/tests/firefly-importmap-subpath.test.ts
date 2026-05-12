import { describe, expect, it } from "vitest";
import { rewriteBareSpecifiers } from "@vibes.diy/vibe-runtime";
import { lockedGroupsVersions } from "@vibes.diy/api-svc/intern/grouped-vibe-import-map.js";

// The fireproof group must intercept *every* import path that resolves to the
// real `use-fireproof` package. A bare `use-fireproof` specifier hits the
// exact-key alias and routes to Firefly. But a subpath import like
// `use-fireproof/dist/foo` only matches via the trailing-slash prefix rule —
// without a `use-fireproof/` key it falls through `shouldRewrite` and lands on
// `https://esm.sh/use-fireproof/dist/foo`, which loads real fireproof CRDT
// inside the iframe and throws `CRDT is not ready`. Same for the legacy
// `@fireproof/use-fireproof` package name.

describe("locked fireproof group blocks use-fireproof subpath leak to esm.sh", () => {
  // Synthesize the import map shape the iframe would see: every key in the
  // fireproof group materialized to *some* non-empty URL. We don't care what
  // URLs resolve to; we only care that `shouldRewrite` finds a match and
  // refuses to send the bare specifier to esm.sh.
  const imports: Record<string, string> = {};
  for (const k of Object.keys(lockedGroupsVersions.fireproof)) {
    imports[k] = k.endsWith("/") ? "https://example.test/resolved/" : "https://example.test/resolved";
  }

  it("does not rewrite bare `use-fireproof` to esm.sh", () => {
    const out = rewriteBareSpecifiers(`import { fireproof } from "use-fireproof";`, imports);
    expect(out).not.toContain("https://esm.sh/use-fireproof");
  });

  it("does not rewrite `use-fireproof/<subpath>` to esm.sh", () => {
    const out = rewriteBareSpecifiers(`import x from "use-fireproof/dist/something.js";`, imports);
    expect(out).not.toContain("https://esm.sh/use-fireproof");
  });

  it("does not rewrite bare `@fireproof/use-fireproof` to esm.sh", () => {
    const out = rewriteBareSpecifiers(`import { fireproof } from "@fireproof/use-fireproof";`, imports);
    expect(out).not.toContain("https://esm.sh/@fireproof/use-fireproof");
  });

  it("does not rewrite `@fireproof/use-fireproof/<subpath>` to esm.sh", () => {
    const out = rewriteBareSpecifiers(`import x from "@fireproof/use-fireproof/react";`, imports);
    expect(out).not.toContain("https://esm.sh/@fireproof/use-fireproof");
  });
});
