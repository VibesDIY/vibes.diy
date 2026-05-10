# Standalone `fireproof()` for Node.js / Wrangler consumers

Issue: [#1438](https://github.com/VibesDIY/vibes.diy/issues/1438)

## Problem

External Node.js and Wrangler scripts can't currently use the Firefly database
API. The pieces exist:

- [`@vibes.diy/api-impl`](../../../vibes.diy/api/impl/) has [`VibesDiyApi`](../../../vibes.diy/api/impl/index.ts) — the WebSocket transport. Methods accept request objects (`{appSlug, userSlug, doc, docId, dbName}`).
- [`@vibes.diy/vibe-runtime`](../../../vibes.diy/vibe/runtime/) has [`FireflyDatabase`](../../../vibes.diy/vibe/runtime/firefly-database.ts) and [`fireproof("name")`](../../../vibes.diy/vibe/runtime/use-firefly.ts) — but typed against `VibeSandboxApi`, the postMessage bridge interface used inside vibe iframes.

The shapes don't line up: `VibesDiyApi.putDoc({appSlug, doc, ...})` vs.
`VibeSandboxApi.putDoc(doc, docId, dbName)` (with `appSlug`/`userSlug` baked in
via `svc.vibeApp`). And `VibesDiyApi` requires the caller to know `userSlug`
explicitly, which most Node consumers won't.

The desired ergonomics — matching what users already do via the
[`vibes-diy` CLI](../../../vibes-diy/cli/) login flow — is:

```js
import { fireproof } from "use-vibes";
const db = fireproof("todos");
await db.put({ text: "hello" });
```

If you're logged in via `npx vibes-diy login`, that's who your scripts run as.
Auth, `userSlug`, and `appSlug` all auto-resolve from local state.

## Goals

1. `import { fireproof } from "use-vibes"` works in a plain Node script with no React, no iframe, no postMessage.
2. The bare form `fireproof("todos")` Just Works when the user has already run `npx vibes-diy login`.
3. Explicit overrides available for non-CLI environments (Wrangler, CI, service accounts).
4. The full FireflyDatabase document API: `put` / `get` / `del` / `query` / `allDocs` / `subscribe` / `bulk` — i.e. the surface covered by [`firefly-nodejs.test.ts`](../../../vibes.diy/tests/app/firefly-nodejs.test.ts).
5. Iframe code paths and the existing `firefly-database.test.ts` / `use-firefly.test.tsx` suites are unaffected.

## Non-goals (v1)

- File / Blob uploads (`_files` entries, `putAsset`). Pure-doc workflows only.
- Changing `useFireproof` (the React hook) — it stays as-is.
- Real-time WS reconnection semantics beyond what `VibesDiyApi` already provides.

## Architecture

Three pieces, three packages, unidirectional deps:

```
use-vibes
   │
   │ imports
   │
   ├─→ @vibes.diy/api-impl
   │       VibesDiyApi  (existing)
   │       FireflyApiAdapter  (NEW)
   │
   └─→ @vibes.diy/vibe-runtime
           FireflyDatabase  (existing, retyped)
           FireflyTransport  (NEW interface)
```

### `FireflyTransport` interface (new, in [`vibe-runtime/firefly-database.ts`](../../../vibes.diy/vibe/runtime/firefly-database.ts))

The structural subset of `VibeSandboxApi` that `FireflyDatabase` actually
calls. Extracted so api-impl can implement it without depending on
vibe-runtime.

```ts
export interface FireflyTransport {
  readonly svc: { readonly vibeApp: { readonly userSlug: string; readonly appSlug: string } };
  putDoc(doc: Record<string, unknown>, docId?: string, dbName?: string): Promise<Result<ResPutDoc>>;
  getDoc(docId: string, dbName?: string): Promise<Result<ResGetDoc | ResGetDocNotFound>>;
  queryDocs(dbName?: string): Promise<Result<ResQueryDocs>>;
  deleteDoc(docId: string, dbName?: string): Promise<Result<ResDeleteDoc>>;
  subscribeDocs(dbName?: string): Promise<Result<ResSubscribeDocs>>;
  onMsg(fn: (event: { data: unknown }) => void): void;
}
```

`FireflyDatabase`'s constructor signature changes from
`(name: string, vibeApi: VibeSandboxApi)` to
`(name: string, vibeApi: FireflyTransport)`. `VibeSandboxApi` already
satisfies the structural shape, so existing in-iframe call sites compile
unchanged.

### `FireflyApiAdapter` (new, in `@vibes.diy/api-impl`)

Wraps `VibesDiyApi` to expose the `FireflyTransport` interface. Lives in
api-impl because it's WS-shape translation; no fs / Node-only deps.

```ts
export class FireflyApiAdapter implements FireflyTransport {
  readonly svc: { vibeApp: { userSlug: string; appSlug: string } };

  constructor(api: VibesDiyApi, appSlug: string, opts?: { userSlug?: string });

  // Lazy: resolves userSlug from ensureUserSettings({}) -> defaultUserSlug
  // setting on first call. Throws if no defaultUserSlug exists for the user.
  // Caller may bypass by passing opts.userSlug to the constructor.
  private resolveUserSlug(): Promise<string>;

  // FireflyTransport methods translate (positional, dbName) calls into
  // VibesDiyApi request objects. Each awaits resolveUserSlug() before
  // building the request payload.
  putDoc(doc, docId?, dbName?): Promise<Result<ResPutDoc>>;
  getDoc(docId, dbName?): Promise<Result<ResGetDoc | ResGetDocNotFound>>;
  queryDocs(dbName?): Promise<Result<ResQueryDocs>>;
  deleteDoc(docId, dbName?): Promise<Result<ResDeleteDoc>>;
  subscribeDocs(dbName?): Promise<Result<ResSubscribeDocs>>;

  // Bridges VibesDiyApi.onDocChanged((userSlug, appSlug, dbName, docId) => ...)
  // into the {data: {type: "vibes.diy.evt-doc-changed", ...}} shape that
  // FireflyDatabase's onMsg listener expects.
  onMsg(fn: (event: { data: unknown }) => void): void;
}
```

### `fireproof()` factory (in [`use-vibes/base/index.ts`](../../../use-vibes/base/index.ts))

Sugared entry point. Replaces the legacy `fireproof` re-export from
`@fireproof/use-fireproof` (a breaking change for external npm consumers, but
no internal callers exist — verified via repo-wide grep).

```ts
export interface FireproofOpts {
  apiUrl?: string;
  appSlug?: string;
  userSlug?: string;
  getToken?: () => Promise<Result<DashAuthType>>;
}

export function fireproof(name: string, opts?: FireproofOpts): FireflyDatabase;
```

Inside an iframe, `use-vibes` is rewritten by the import map to
`@vibes.diy/vibe-runtime`, which exports its own `fireproof("name")` (the
existing pattern requiring a prior `registerFirefly()` call). The factory
defined here is only reached by Node / Wrangler consumers.

### Module-level singletons + multi-database caching

The factory is a module-singleton with a per-name database cache, mirroring
the legacy [`@fireproof/core-base` factory](../../../../fireproof/core/quick-silver/fireproof.ts)
and the existing `dbCache` in `vibe-runtime/use-firefly.ts`. Real apps call
`fireproof(name)` repeatedly (the SOIP browser example claims one db per
domain plus a registry db) and expect:

1. Two calls with the same `name` return the same `FireflyDatabase` instance.
2. N calls with different names share **one** underlying `VibesDiyApi`
   (one WebSocket, one cached `getToken`, one resolved `userSlug`).

Implementation uses cement's [`Lazy`](../../../../fireproof/core/keybag/key-bag-setup.ts)
and [`KeyedResolvOnce`](../../../../fireproof/core/quick-silver/fireproof.ts)
primitives:

```ts
import { Lazy, KeyedResolvOnce, ResolveOnce } from "@adviser/cement";

// Resolved once per process. First fireproof() call's opts win; later
// opts arguments are ignored (matches the legacy fireproof() mental model
// where opts are config-time, not call-time).
const sharedAdapter = Lazy((resolved: ResolvedOpts): FireflyApiAdapter => {
  const api = new VibesDiyApi({
    apiUrl: resolved.apiUrl,
    getToken: resolved.getToken,
  });
  return new FireflyApiAdapter(api, resolved.appSlug, resolved.userSlug ? { userSlug: resolved.userSlug } : undefined);
});

// One FireflyDatabase per name, all sharing sharedAdapter.
const databasesByName = new KeyedResolvOnce<FireflyDatabase>();

export function fireproof(name: string, opts?: FireproofOpts): FireflyDatabase {
  const resolved = resolveOptsSync(opts); // env + cwd + wrapped lazy getToken
  return databasesByName.get(name).once(() => new FireflyDatabase(name, sharedAdapter(resolved)));
}
```

`resolveOptsSync` synchronously assembles `apiUrl` / `appSlug` from env or
overrides, and wraps `getToken` so that a missing `opts.getToken` lazy-loads
the keybag module on first invocation:

```ts
const lazyKeybagGetToken = Lazy(async () => {
  const mod = await import("./firefly-defaults.node.js");
  return mod.loadDeviceIdGetToken(ensureSuperThis());
});

function resolveOptsSync(opts?: FireproofOpts): ResolvedOpts {
  return {
    apiUrl: opts?.apiUrl ?? process.env.VIBES_DIY_API_URL ?? "https://vibes.diy/api",
    appSlug: opts?.appSlug ?? process.env.VIBES_APP_SLUG ?? path.basename(process.cwd()),
    userSlug: opts?.userSlug,
    getToken:
      opts?.getToken ??
      (async () => {
        const inner = await lazyKeybagGetToken();
        return inner();
      }),
  };
}
```

The `userSlug` resolution itself is one more level deep — `FireflyApiAdapter`
holds a `ResolveOnce<string>` that calls `ensureUserSettings({})` exactly
once on first request and caches the result for the lifetime of the process.

**First-call-wins for opts.** If a script calls `fireproof("a", {appSlug: "x"})`
then later `fireproof("b", {appSlug: "y"})`, the second `appSlug` is silently
ignored because `sharedAdapter` is `Lazy`. This matches `Lazy`'s semantics and
the legacy fireproof factory. Documenting this in the JSDoc — callers who
need different `appSlug` values in one process must construct
`VibesDiyApi` + `FireflyApiAdapter` + `FireflyDatabase` directly without the
sugar.

## Defaults pipeline

When `fireproof("todos")` is called with no overrides:

| Field      | Default source                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------- |
| `apiUrl`   | env `VIBES_DIY_API_URL`; fallback to built-in constant `https://vibes.diy/api`                     |
| `appSlug`  | env `VIBES_APP_SLUG`; fallback to `path.basename(process.cwd())`                                   |
| `getToken` | dynamic-imported keybag loader (Node-only)                                                         |
| `userSlug` | lazy via `ensureUserSettings({})` → `defaultUserSlug` setting (handled inside `FireflyApiAdapter`) |

### Keybag loader

A new Node-only module — proposed at
`use-vibes/base/firefly-defaults.node.ts` — that imports
`@fireproof/core-keybag` and `@fireproof/core-device-id`. Lifted essentially
verbatim from `vibesDiyApiFactory` in [`vibes-diy/cli/main.ts`](../../../vibes-diy/cli/main.ts) (lines 25–69):

```ts
export async function loadDeviceIdGetToken(sthis: SuperThis): Promise<() => Promise<Result<DashAuthType>>> {
  const kb = await getKeyBag(sthis);
  const devid = await kb.getDeviceId();
  if (devid.cert.IsNone()) {
    throw new Error("Run 'npx vibes-diy login' to authenticate this device");
  }
  const rDevkey = await DeviceIdKey.createFromJWK(devid.deviceId.Unwrap());
  // ... build DeviceIdSignMsg, return Lazy() getToken with 60s reset ...
}
```

The factory imports this via `await import("./firefly-defaults.node.js")` only
when `opts.getToken` is undefined. Browser bundlers tree-shake the dynamic
import; SSR/Slack code never calls `fireproof()` so they don't pull it.

## Data flow

### Construction (synchronous)

```
fireproof("todos", opts?)
  └─ databasesByName.get("todos").once(() => {
        ├─ resolveOptsSync(opts) — env/cwd lookups, wrap getToken in Lazy
        ├─ sharedAdapter(resolved) — Lazy: first call builds VibesDiyApi
        │                            + FireflyApiAdapter; later calls return
        │                            the cached adapter
        └─ return new FireflyDatabase("todos", adapter)
     })
```

The factory returns synchronously. Repeated calls with the same name return
the cached `FireflyDatabase`; calls with different names build new database
instances against the same shared adapter. The `FireflyApiAdapter` holds a
`ResolveOnce<string>` for `userSlug` that resolves on first use via
`ensureUserSettings({})`. The `FireflyDatabase` constructor's existing
fire-and-forget `subscribeDocs(name)` naturally awaits the userSlug
internally.

If `opts.getToken` is omitted, `resolveOptsSync` returns a `getToken`
function that on its first invocation `await import("./firefly-defaults.node.js")`
to load the keybag module, then mints a token. `Lazy` ensures the dynamic
import and keybag read happen at most once per process.

### Request

```
db.put(doc)
  └─→ FireflyDatabase.put
        └─→ uploadFiles(doc) — pass-through if no _files
        └─→ adapter.putDoc(doc, undefined, this.name)
              └─→ await resolveUserSlug()    // first call only
              └─→ VibesDiyApi.putDoc({appSlug, userSlug, dbName, doc, ...})
                    └─→ WS message, awaits ResPutDoc
```

### Subscription

```
db.subscribe(listener, true)
  └─→ adds to FireflyDatabase listeners

VibesDiyApi.onDocChanged((userSlug, appSlug, dbName, docId) => ...)
  └─→ adapter synthesizes {data: {type: "vibes.diy.evt-doc-changed", ...}}
  └─→ FireflyDatabase.onMsg handler fires, filters dbName, notifies listeners
```

## Error handling

| Condition                                               | Behavior                                                                                                                                |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Keybag has no device-id cert                            | First request throws `"Run 'npx vibes-diy login' to authenticate this device"`                                                          |
| `appSlug` not resolvable (no env, cwd basename invalid) | Factory throws synchronously with `"Set VIBES_APP_SLUG or pass {appSlug}"`                                                              |
| `ensureUserSettings({})` returns no `defaultUserSlug`   | First request throws `"No defaultUserSlug — pass {userSlug} or run vibes-diy login"`                                                    |
| Doc has `_files` entries                                | `uploadFiles` calls `adapter.putAsset` which throws `"file uploads not supported in standalone fireproof — coming in a future release"` |
| WS request times out / errors                           | `FireflyDatabase` already throws on `Result.Err` — unchanged                                                                            |

## Testing

### `firefly-nodejs.test.ts` — extend, not rewrite

The existing suite uses `createMockVibeApi` + `asSandboxApi` to inject a fake
`VibeSandboxApi`. Two new describe blocks are added:

1. **`fireproof() factory with explicit opts`** — exercises the same patterns
   from llms/fireproof.md but constructs via `fireproof("name", {apiUrl,
appSlug, userSlug, getToken})` against an injected fake `VibesDiyApi`.
   Validates that `FireflyApiAdapter` translates positional → request-object
   correctly.

2. **`fireproof() bare form`** — same patterns, called as `fireproof("name")`
   with `VIBES_APP_SLUG` set in process env. `getToken` is monkeypatched onto
   the dynamic-import module via vi.mock. Validates the env-fallback path.

3. **Multi-database caching** — explicit tests that:
   - `fireproof("a") === fireproof("a")` (same instance)
   - `fireproof("a")` and `fireproof("b")` are different instances but observably share one underlying `VibesDiyApi` (via a counter on the injected fake)
   - First call's opts win: `fireproof("a", {appSlug: "x"})` then `fireproof("b", {appSlug: "y"})` results in both routing to `appSlug: "x"` (matches the SOIP browser pattern of opening a registry db then opening many site dbs)

### `firefly-defaults.node.test.ts` — new

Thin tests for the keybag loader:

- "no cert in keybag → helpful error mentioning `npx vibes-diy login`"
- "cert present → returns a function that mints DashAuthType tokens"

Uses an in-memory keybag URL so tests don't touch the real `~/.fireproof/`.

### `firefly-database.test.ts` / `use-firefly.test.tsx` — unchanged

Still run against the postMessage `VibeSandboxApi`. The `FireflyTransport`
interface extraction is purely a type narrowing — no runtime behavior change.

### Reference

The legacy `fireproof()` API contract from `~/code/fp/fireproof/core/tests/fireproof/`
serves as the API-shape reference (per user direction): we make sure put /
get / query / del / subscribe / bulk match the legacy ergonomics where
applicable. We don't run those tests against our impl; the existing
`firefly-nodejs.test.ts` patterns already mirror llms/fireproof.md, which
itself reflects the legacy shape.

## Migration / breaking change

`use-vibes` no longer re-exports `fireproof` from `@fireproof/use-fireproof`
(local IndexedDB). External npm consumers who imported it for local-only
storage need to switch to `import { fireproof } from "@fireproof/use-fireproof"`
directly.

Internal callers verified clean via:

```bash
grep -rn 'from "use-vibes"' --include='*.ts' --include='*.tsx' | grep fireproof
# (no matches in the workspace)
```

`useFireproof` from `use-vibes` is unchanged.

## Future work (out of scope)

- File uploads via `putAsset` + the `requestAssetUploadGrant` HTTP grant flow.
- A `connectFireproof()` / multi-app variant that lets one Node process talk
  to several `(userSlug, appSlug)` pairs over one WS.
- `useFireproof` rework to also auto-route to the WS backend outside iframes
  (currently still bound to the legacy library).
