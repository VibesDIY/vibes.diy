# Vibes.diy – Fireproof Rules-Bag

Never use `export default`, nor `import X from 'y'`
Every Never has an exception — but this has to be discussed and decided.

Never write JS, always TS

Never use `any`

Avoid casts — use at least 10 minutes to decide on one cast — better to ask others.

Use arktype(zod) if you do `const x = type({ x: "string" })(JSON.parse(y))`

Never use mocking — that means your architecture is wrong; any code with mocking will never be accepted by me/us.

Write the test first without the AI and use this to ask the AI how to implement. If you discover untestabilities change your implementation.

Do not use `new URL()` → use URI — URL is not stable in all aspects.

Our implementation never throws — use `Result`.

Avoid `if (!x)` // falsy check → Use Option `if (x.isSome())` → `if (x === true || x === "")` means you expected x to be a particular type; you are not looking for some falsy state.

Never use `try/catch` → `exception2Result()`

Never implement a Singleton — use `ResolveOnce`/`Lazy`

Never Never Never use `Proxy` from ECMA

Avoid `instanceof`

Use `switch (true)` for dynamic filtering

Read https://en.wikipedia.org/wiki/Design_Patterns — but don't get obsessed with it. It's old, but it answers the OO aspect of today's hybrid model of OO + Functional.

Use `const`, `readonly attribute: string` as your default — it helps you not create a mutation without knowing.

Every side effect/mutation is expensive (debug cost, testing cost) — the best strategy is to avoid it at all costs.

Decide on ownership. Avoid `const list = [Element]`; if Element offers a `removeFromList`, you are in trouble.

Our codebase uses `undefined` as a falsy state. Bridge between React `null` → `undefined` or `Option.from()`.

Do not use `const fn = () => {}` as long as you don't need the implicit `this` binding. (Short notation is ok for inline use: `[].map(() => {})`)

Every transferred object needs implicit type matching like `{ type: "mytype", ... }` and an envelope like `{ id, src, dst, payload: { type: xxx } }`.

Never write optimized code — write code that other people/AI could understand.

Never use `new TextEncoder` or `new TextDecoder` — use `this.txt.encode`.

Use for CLI utils → `cmd-ts`

Use for script-like things → `zx`

Never write encoders/decoders yourself — use libraries, multiformats, cement.

Do not reimplement public knowledge like mime type mapping to extensions.

Build an architecture where integration tests are not needed and will never hit the actual infrastructure. Every regression test runs against the integration test infrastructure (building a regression test could take very long).

No overrides of packages — we need a very simple dependency structure due to nobuild requirements.

All `@fireproof/*` packages must be on the same patch version across the entire monorepo. A version split creates duplicate runtime stacks under pnpm, which can cause subtle storage/serialization mismatches between packages that share keybag, device-id, or runtime state.

Never use `constructor(private db: VibesSqlite) {}` — this is very bundle-unfriendly.

Never pass more than 3 parameters to a function; use typed objects instead. This is stricter when passing 3 parameters of the same type — that avoids mixing them up, like `setFullName(firstName, lastName)` → use `setFullName({ lastName, firstName })`.

Don't be shy about making things good — if you see `any[]` leaking from a JSON column, validate it with arktype. If a type is wrong, fix it now. Cutting corners on types creates debt that compounds silently.

Evento is an architectural boundary, not a convenience wrapper. When handlers from one package need to run in another package's evento, unify the message types — don't cast around the mismatch. If a cast is needed to register a handler, the envelope types are wrong.

## Good Patterns

### Typed message bridge (CLI → Evento)

cmd-ts command = thin adapter. Parse args, spread into typed Req DTO, enqueue. Handler reads `ctx.validated` — no casts.

```ts
handler: ctx.cliStream.enqueue((args) => {
  return { type: "core-cli.build", ...args };
});
```
