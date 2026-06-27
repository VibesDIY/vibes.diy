# De-fireproofing auth: extracting an identity/PKI runtime out of a dependency without changing a single call site

Source: #2661 (plan), #2667, #2670, #2672

Dropping `@fireproof/*` from the identity surface wasn't a delete — it was a
lift. The earlier "facade" work only relocated *where* the imports lived (into
`@vibes.diy/identity`); the actual runtime values — device-id key/sign/CSR/verify
crypto, the server CA, the keybag, the Clerk token verifier and dashboard client,
the auth wire-types — were still `export … from "@fireproof/*"`. The interesting
engineering is how you pull a live PKI runtime in-house *safely*:

- **Lift-verbatim behind an unchanged facade.** No call site changes — the extraction
  is invisible above the package boundary, so the blast radius is one package, not the repo.
- **A byte-compat gate, not a trust-me.** The plan extends the golden harness with an
  extracted ⇄ fireproof *cross-verification* step, so the lifted crypto is proven
  identical to the original before the dependency is cut, not after.
- **Source-lock provenance per symbol.** The extraction plan requires per-symbol
  provenance tracking — each lifted symbol annotated with the upstream it was copied
  from — so a future upstream fix is a deliberate re-sync, not a silent drift.

Worth a post on the discipline of *managed-fork extraction*: the trade-off between
vendoring a dependency's security-critical code (you own the PKI, you own the bugs)
and the gates that make it not-reckless — byte-compat cross-checks, an unchanged
facade as the seam, and provenance tables so "we forked this" never becomes "we
forgot where this came from." Bonus framing nugget from the plan: how a mis-filed
"coordinate with upstream" issue (#2649) was actually *our* code to fix, because
mid-extraction the boundary had already moved in-repo.
