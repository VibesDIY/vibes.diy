import { beforeAll, describe, expect, it } from "vitest";
import { Result } from "@adviser/cement";
import { rewriteBareSpecifiers } from "@vibes.diy/vibe-runtime";
import { lockedGroupsVersions, lockedVersions } from "@vibes.diy/api-svc/intern/grouped-vibe-import-map.js";
import { Dependencies, render_esm_sh } from "@vibes.diy/api-svc/intern/import-map.js";

// The fireproof group must intercept *every* import path that resolves to the
// real `use-fireproof` package. A bare `use-fireproof` specifier hits the
// exact-key alias and routes to Firefly. But a subpath import like
// `use-fireproof/dist/foo` only matches via the trailing-slash prefix rule —
// without a `use-fireproof/` key it falls through `shouldRewrite` and lands on
// `https://esm.sh/use-fireproof/dist/foo`, which loads real fireproof CRDT
// inside the iframe and throws `CRDT is not ready`. Same for the legacy
// `@fireproof/use-fireproof` package name.

// Resolve every SYMBOLIC version offline via the locked-versions table. No
// network, no cache. lockedGroupsVersions only uses `version:<key>`, `alias:`,
// or `privateNpm:`, so this is sufficient to drive renderImportMap end-to-end.
const offlineResolveFn = async (dep: { pkg: { givenPkg: string }; version: { ver: { version: unknown } } }) => {
  const v = dep.version.ver.version as { value?: unknown };
  const sym = typeof v.value === "string" ? v.value : undefined;
  const resolved = sym && (lockedVersions as Record<string, string>)[sym];
  if (!resolved) {
    return Result.Err<{ src: string; version: string }>(new Error(`no locked version for ${dep.pkg.givenPkg} (symbol=${sym})`));
  }
  return Result.Ok({ src: "locked", version: resolved });
};

describe("locked fireproof group blocks use-fireproof subpath leak to esm.sh", () => {
  let imap: Record<string, string>;
  beforeAll(async () => {
    const deps = Dependencies.from({ ...lockedGroupsVersions });
    imap = await deps.renderImportMap({
      resolveFn: offlineResolveFn,
      renderRHS: render_esm_sh({ privateUrl: "https://example.test/private/" }),
    });
  });

  it("renderImportMap defines bare + trailing-slash entries for both package names", () => {
    expect(imap["use-fireproof"]).toBeDefined();
    expect(imap["use-fireproof/"]).toBeDefined();
    expect(imap["@fireproof/use-fireproof"]).toBeDefined();
    expect(imap["@fireproof/use-fireproof/"]).toBeDefined();
  });

  it("trailing-slash entries end with `/` so the browser prefix rule fires", () => {
    // The native importmap spec requires both key and value to end with `/`
    // for the prefix-substitution rule to apply. If `BuildURI` ever stripped
    // the trailing slash off the rendered value, `use-fireproof/foo` would
    // not match and fall through to esm.sh again.
    expect(imap["use-fireproof/"]).toMatch(/\/$/);
    expect(imap["@fireproof/use-fireproof/"]).toMatch(/\/$/);
  });

  it("does not rewrite bare `use-fireproof` to esm.sh", () => {
    const out = rewriteBareSpecifiers(`import { fireproof } from "use-fireproof";`, imap);
    expect(out).not.toContain("https://esm.sh/use-fireproof");
  });

  it("does not rewrite `use-fireproof/<subpath>` to esm.sh", () => {
    const out = rewriteBareSpecifiers(`import x from "use-fireproof/dist/something.js";`, imap);
    expect(out).not.toContain("https://esm.sh/use-fireproof");
  });

  it("does not rewrite bare `@fireproof/use-fireproof` to esm.sh", () => {
    const out = rewriteBareSpecifiers(`import { fireproof } from "@fireproof/use-fireproof";`, imap);
    expect(out).not.toContain("https://esm.sh/@fireproof/use-fireproof");
  });

  it("does not rewrite `@fireproof/use-fireproof/<subpath>` to esm.sh", () => {
    const out = rewriteBareSpecifiers(`import x from "@fireproof/use-fireproof/react";`, imap);
    expect(out).not.toContain("https://esm.sh/@fireproof/use-fireproof");
  });
});
