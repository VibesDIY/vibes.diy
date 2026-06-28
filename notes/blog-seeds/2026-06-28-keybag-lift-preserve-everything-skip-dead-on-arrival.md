# Lifting a credential store in-repo: preserve every live moving part, skip only what's dead on arrival

Source: de-fireproof Task 6.1, branch `claude/defireproof-keybag-lift-2716`, gated by the golden harness from #2723. The meatiest lift of the epic — the device-id keybag (`vibes-diy login` writes the key + cert to `~/.fireproof/keybag/<id>.json`).

The harden-first harness (#2723) made this lift almost boring in the best way: copy the upstream code in-repo, repoint imports, and the golden harness has to pass **with zero edits** — that's the proof it's byte-faithful. It did (the on-disk format, the two-phase write, the strict-cert read, the throw-on-corrupt behavior, memory parity, the deno branch). But the *interesting* part was a principle that crystallized through three reviewer corrections in a row.

The principle: **what you preserve in a risk-sensitive lift is not just runtime logic — it's the entire rollout surface.** Dependency shape (caret-vs-exact, direct-vs-peer, bundled-vs-type-only), build/publish mechanics, on-disk/env contracts — every moving part that could break a deploy. Minimize churn to *all* of them. Cleanup (narrowing, dep minimization, find-up removal) is a separate later pass.

What that meant concretely, and where I got it wrong before getting it right:

- **Don't swap the filesystem layer for `node:fs`.** My first instinct was "the upstream fs wrapper is just `node:fs/promises` under a thin shell — I'll call `node:fs` directly." That's a *reimplementation*, not a lift — a different moving part with its own error semantics. Lift the wrapper verbatim instead; it happens to call `node:fs`, but byte-for-byte as upstream did.
- **Keep deno.** The fs factory branches node/deno. Deno looks like dead code from the CLI's node path — but it's *used* (it anchors cross-runtime correctness), just not by me. "Is it used by *anything live*?" not "is it used by *this package*?" So both fs runtimes are lifted verbatim, and `@types/deno` comes along as a (type-only) devDep, exactly as upstream had it.
- **Use the real vendor type, not a fabricated stand-in.** (This was the sibling clerk PR.) A hand-rolled minimal interface that "just compiles" is a soft cast — and it was masking a real `@clerk/shared` version skew. The real type forced the skew into the open, fixed honestly by constraining a generic.

The one thing you *do* skip: **dead on arrival** — code no live path reaches once the boundary moves. The keybag's general-keystore methods (`getNamedKey`/`getJwt`/`setRawObj`) are dead in identity's keybag: nothing calls them through identity's `getKeyBag` (the database-key path is firefly's own keybag). So the lift carries only the device-id slice. That's not "narrowing for cleanliness" — it's declining to copy code into a package that can never run it.

Net: `@fireproof/core-keybag` drops out of identity *and* seven other packages that only declared it vestigially (the data layer went all-firefly months ago, so those were tangle, not dependency). The harness — untouched — is what let the whole thing move with a small blast radius.
