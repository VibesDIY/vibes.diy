# A coding-standard earns its keep when the next bug it predicts lands days later

Source: #2627 (fixes the empty-jsonb `()` syntax error; confirms `agents/coding-standards.md` § "Robustness over bit-twiddling")

After the NUL-byte advisory-lock incident (#2557/#2590) we didn't just fix the
bug — we generalized it into a rule in
[`agents/coding-standards.md`](../../agents/coding-standards.md) § *Robustness over
bit-twiddling*: prefer the boring encoding that's obviously correct at every layer
over a clever trick that leans on a local invariant, and **test against the real
engine, not the convenient one**. #2627 is the rule's first real-world
confirmation, and it's almost the same bug wearing a different hat.

This time there was no clever trick at all — just drizzle quietly expanding an
interpolated JS array into a parenthesized param list. A populated `fileSystem`
became `($6, $7, $8, $9, $10)`; an empty `meta: []` became `()` → Postgres
`42601 syntax error at or near ")"`. Since an empty `meta` is the common case for a
fresh generate, this broke essentially *every* new-app INSERT on pg. And — exactly
as the rule warns — it was invisible in CI, because tests run on libsql whose
`jsonParam` branch already used `JSON.stringify`; the array-expansion only ever
manifested on real Postgres. The fix is the same boring-but-portable move:
`JSON.stringify(value)::jsonb`, one param per column regardless of array length.

The post writes itself: **the half-life of a well-generalized rule.** A debugging
war story is worth one blog post; a *rule* extracted from it that catches the next
instance within the week is worth more. The throughline across both bugs is a
single failure mode — "it works on libsql, it breaks on the engine that matters" —
and the standing fix is structural: serialize to a self-describing value at the
boundary, and make the real engine part of the test loop (this is also what the
new PG concurrency CI lane, #2623, is buying us).
