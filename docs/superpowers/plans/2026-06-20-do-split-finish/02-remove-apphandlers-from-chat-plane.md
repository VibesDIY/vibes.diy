# A2 — DM home + remove `appHandlers` from the chat plane

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development or executing-plans. Steps use checkbox (`- [ ]`) syntax. **Deploy/verify gate:** A1 must be merged and (ideally) preview-smoked before this.

**Goal:** Give DMs an AppSessions home, then make ChatSessions chat-only by
removing `appHandlers` from `chatMsgEvento`, and remove the default
`invokeAccessFn` that calls `env.ACCESS_FN_DO`. After this PR, no doc-write
handler runs on a non-overriding DO, so `env.ACCESS_FN_DO` is dead code —
clearing the way for A3 to delete the class.

**Architecture:** DMs (`owner=channelUserSlug`, `appSlug="dm"`) are vibe-style
doc ops with no vibe page, so they currently use `chatApi`. We open an
AppSessions connection keyed by the DM pseudo-vibe (`<channelUserSlug>--dm`) and
hand it to the DM components. With doc ops (A1) and DMs both off `chatApi`,
`appHandlers` can leave the chat evento.

**Tech Stack:** TypeScript, React, Vitest, Cloudflare Workers (Durable Objects).

**Spec:** `../../specs/2026-06-20-do-split-finish-design.md` (Track A2).

---

## File Map

| File                                                                                | Change                                                                                   |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `vibes.diy/pkg/app/vibes-diy-provider.tsx`                                          | add a `dmApi` factory (or generalize `vibeApi` builder) keyed by `<channelUserSlug>--dm` |
| `vibes.diy/pkg/app/components/DmThread.tsx`, `DmInbox.tsx`                          | accept the DM AppSessions connection instead of `chatApi`                                |
| `vibes.diy/pkg/app/routes/messages.tsx`, `messages.$ownerHandleA.$ownerHandleB.tsx` | pass the DM connection                                                                   |
| `vibes.diy/api/svc/chat-msg-evento.ts`                                              | drop `...appHandlers` → `sharedHandlers + chatHandlers`                                  |
| `vibes.diy/api/svc/cf-serve.ts`                                                     | remove the default `invokeAccessFn` that calls `env.ACCESS_FN_DO`                        |
| `vibes.diy/api/svc/evento-handler-manifest.ts`                                      | update the "until #2263" comments on `appHandlers`/`sharedHandlers`                      |
| `vibes.diy/api/tests/evento-handler-parity.test.ts`                                 | assert `appHandlers` no longer in the chat evento set                                    |

> **Decide first — `vibesMsgEvento`.** It also bundles `appHandlers` and is
> `cfServe`'s default (`cf-serve.ts:530`). Confirm whether any **production**
> entrypoint serves it (grep the worker `fetch` handlers + `processRequest`).
>
> - If test-only: leave it (tests rely on the combined evento) and document
>   that in a comment; the default `invokeAccessFn` removal below still applies.
>   To keep tests passing, give test setups an explicit `invokeAccessFn` mock
>   (most already do — see `api/tests/*` `invokeAccessFn:` stubs).
> - If live: it must lose `appHandlers` too, and its consumer needs an explicit
>   `invokeAccessFn` override. Resolve this in Step 0 before coding.

---

## Task 0: Resolve the `vibesMsgEvento` question

- [ ] **Step 1: Determine if `vibesMsgEvento` is a live production path**

```bash
rg -n "vibesMsgEvento|eventoFactory" vibes.diy/pkg vibes.diy/api/svc --type ts
```

Confirm the only non-test consumers are the two DOs (which pass `chatMsgEvento`
/ `appMsgEvento` explicitly) and `cfServe`'s default. If the default is reached
only by tests, record that finding in the PR description and proceed treating
`vibesMsgEvento` as the test harness evento. If a production `fetch` serves it,
stop and extend this plan (give that path an explicit evento + access override).

---

## Task 1: DM connection on AppSessions

**Files:**

- Modify: `vibes.diy/pkg/app/vibes-diy-provider.tsx`
- Modify: `vibes.diy/pkg/app/components/DmThread.tsx`, `DmInbox.tsx`
- Modify: `vibes.diy/pkg/app/routes/messages.tsx`, `messages.$ownerHandleA.$ownerHandleB.tsx`

- [ ] **Step 1: Write the failing test**

Add `vibes.diy/tests/app/dm-thread-vibeapi.test.tsx`: render `DmThread` with a
spy DM connection and assert `queryDocs`/`putDoc` target it, not `chatApi`.

```tsx
it("DmThread uses the AppSessions DM connection for doc ops", async () => {
  const calls: string[] = [];
  const dmApi = {
    queryDocs: async () => {
      calls.push("queryDocs");
      return Result.Ok({ docs: [] });
    },
    putDoc: async () => {
      calls.push("putDoc");
      return Result.Ok({});
    },
    markDmRead: async () => Result.Ok({}),
  } as unknown as VibesDiyApiIface;
  render(<DmThread myUserSlug="me" otherUserSlug="you" chatApi={dmApi} />);
  await waitFor(() => expect(calls).toContain("queryDocs"));
});
```

(`DmThread` already takes its connection as a prop named `chatApi`. The minimal
change is the _prop value the route passes_; rename the prop to `dmApi` for
clarity in Step 3.)

- [ ] **Step 2: Run it to confirm it fails or passes-by-accident**

Run: `cd vibes.diy/tests && pnpm test dm-thread-vibeapi -- --run`
Expected: PASS for the prop wiring (the component is connection-agnostic). The
behavioral change is which connection the **route** supplies — that is asserted
in Step 4.

- [ ] **Step 3: Build the DM AppSessions connection in the provider**

In `vibes-diy-provider.tsx`, factor the existing `vibeApi` URL builder into a
helper that takes a vibe key, and expose a `dmApiFor(channelUserSlug)` the
messages routes can call (or build a `dmApi` when the route matches
`/messages/:a/:b`). Reuse `vibesDiyApis.get(url).once(...)` with
`skipShard: true` and the shared `getToken`, exactly like `vibeApi`:

```tsx
const buildAppApi = (vibeKey: string) => {
  const url = BuildURI.from(apiUrl).pathname("/api/app").cleanParams().setParam("vibe", vibeKey).toString();
  const tok = sharedGetToken ?? realCtx.getToken;
  return vibesDiyApis.get(url).once(
    () =>
      new VibesDiyApi({
        apiUrl: url,
        skipShard: true,
        getToken: tok ?? (() => Promise.resolve(Result.Err("token not available"))),
      })
  );
};
```

Call `buildAppApi` with the vibe key `<owner>--<appSlug>` for `vibeApi`, and
expose `buildAppApi` (or a memoized `dmApi`) for the messages routes via the
context. The DM vibe key is `<channelUserSlug>--dm`.

- [ ] **Step 4: Rename the DM prop and wire the routes**

Rename `DmThread`/`DmInbox`'s `chatApi` prop to `dmApi`. In
`messages.$ownerHandleA.$ownerHandleB.tsx` compute
`channelUserSlug = directChannelUserSlug(ownerHandleA, ownerHandleB)` and pass
`dmApi` built from `buildAppApi` with the `<channelUserSlug>--dm` key. Update the
route test to assert the DM connection's `apiUrl` contains `/api/app` and
`vibe=…--dm`.

- [ ] **Step 5: Build + test**

Run: `pnpm build && cd vibes.diy/tests && pnpm test dm -- --run`
Expected: clean build; DM tests pass.

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/pkg/app/vibes-diy-provider.tsx vibes.diy/pkg/app/components/DmThread.tsx vibes.diy/pkg/app/components/DmInbox.tsx vibes.diy/pkg/app/routes/messages.tsx vibes.diy/pkg/app/routes/messages.\$ownerHandleA.\$ownerHandleB.tsx vibes.diy/tests/app/dm-thread-vibeapi.test.tsx
git commit -m "feat(dm): route DM doc ops through an AppSessions connection (#2265)"
```

---

## Task 2: Remove `appHandlers` from the chat plane

**Files:**

- Modify: `vibes.diy/api/svc/chat-msg-evento.ts`
- Modify: `vibes.diy/api/svc/cf-serve.ts`
- Modify: `vibes.diy/api/svc/evento-handler-manifest.ts`
- Test: `vibes.diy/api/tests/evento-handler-parity.test.ts`

- [ ] **Step 1: Write/extend the failing parity test**

In `evento-handler-parity.test.ts`, add an assertion that the chat evento's
handler set excludes `appHandlers`:

```ts
it("chatMsgEvento serves only sharedHandlers + chatHandlers (no appHandlers)", () => {
  const chatSet = new Set(hashes([...sharedHandlers, ...chatHandlers]));
  for (const h of hashes(appHandlers)) {
    expect(chatSet.has(h)).toBe(false);
  }
  // and the produced evento must not register any appHandler hash
  // (assert via the manifest the chat evento is built from)
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd vibes.diy/tests && pnpm test evento-handler-parity -- --run`
Expected: FAIL while `chat-msg-evento.ts` still spreads `...appHandlers`.

- [ ] **Step 3: Drop `appHandlers` from `chatMsgEvento`**

In `chat-msg-evento.ts`:

```ts
// Before
evento.push(...sharedHandlers, ...appHandlers, ...chatHandlers, { …WildCard }, { …Error });
// After — ChatSessions is chat-only; doc ops live on AppSessions (vibeApi).
evento.push(...sharedHandlers, ...chatHandlers, { …WildCard }, { …Error });
```

Remove the now-unused `appHandlers` import.

- [ ] **Step 4: Remove the default `env.ACCESS_FN_DO` invoker**

In `cf-serve.ts`, delete the default `invokeAccessFn` block (the one calling
`env.ACCESS_FN_DO.idFromName(...)`, ~lines 430–462) so it is **not** part of
`callbackOverrides`-less app contexts. AppSessions already supplies its own
`localInvokeAccessFn`; leaving the default would keep a live reference to a DO
A3 deletes. With it gone, a stray doc-write on a non-overriding DO simply has
no access invoker (`process-access-bindings` already early-returns when
`invokeAccessFn === undefined`, see `process-access-bindings.ts:131`).

- [ ] **Step 5: Update manifest comments**

In `evento-handler-manifest.ts`, replace the
`// Registered on both DOs until client routing is fully split (#2263).`
comments on `appHandlers` (and the grants block in `sharedHandlers`) with a note
that `appHandlers` now lives only on AppSessions (`appMsgEvento`) and the chat
plane is chat-only (#2265 Track A2).

- [ ] **Step 6: Run the suite**

Run: `cd vibes.diy/tests && pnpm test evento app-documents access-fn dm -- --run`
Expected: parity test passes; doc/access/dm tests pass (they use
`vibesMsgEvento` + explicit `invokeAccessFn` mocks, unaffected).

- [ ] **Step 7: Commit**

```bash
git add vibes.diy/api/svc/chat-msg-evento.ts vibes.diy/api/svc/cf-serve.ts vibes.diy/api/svc/evento-handler-manifest.ts vibes.diy/api/tests/evento-handler-parity.test.ts
git commit -m "refactor(do-split): make ChatSessions chat-only; drop default AccessFnDO invoker (#2265)"
```

---

## Task 3: Gate, check, PR

- [ ] **Step 1: Grep gate — no live `env.ACCESS_FN_DO`**

```bash
rg -n "env\.ACCESS_FN_DO|ACCESS_FN_DO\b" vibes.diy --type ts -g '!**/tests/**'
```

Expected: only the binding in `api/types/cf-env.ts` (deleted in A3) and
wrangler.toml. No call sites.

- [ ] **Step 2: `pnpm check`**

Run: `pnpm check`
Expected: green (rerun flaky per `agents/flaky-tests.md`).

- [ ] **Step 3: Push + PR + preview smoke**

Open the PR (label, @-mention `@CharlieHelps`, subscribe). Run `qa-pr` against
the preview: doc ops, comments live-update, DMs send/receive, access-gated
writes all still work — this is the behavioral gate before A3 deletes the DO.
