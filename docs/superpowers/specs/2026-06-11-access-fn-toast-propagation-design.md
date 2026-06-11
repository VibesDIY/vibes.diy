# Surface access.js denial reasons in the write-fail toast

**Date:** 2026-06-11
**Issue:** [VibesDIY/vibes.diy#2330](https://github.com/VibesDIY/vibes.diy/issues/2330)
**Status:** Approved (Charlie review on PR #2331) — implementing

## Problem

When a vibe app write is denied by a custom `access.js` function, the user sees the
generic toast **"Failed to save your changes. Please try again."** instead of the reason
the access function returned (e.g. `forbidden("Only the author can edit this post")`).
App authors writing access rules get no feedback about _why_ a write was rejected, which
makes access.js hard to debug from the running app.

## Root cause

The original issue writeup guessed the reason was _lost in transit_. It is not. Tracing
the full path shows the reason already arrives at the toast handler — the handler then
throws it away.

Flow for a denied write:

1. iframe app → `srv-sandbox.ts` `vibePutDoc` → `api.putDoc(...)` (generates a `tid`).
2. Server write evento denies via `vibes.diy.res-error` carrying the reason as
   `error.message`
   — [app-documents-write-eventos.ts:316-322](../../../vibes.diy/api/svc/public/app-documents-write-eventos.ts#L316-L322).
3. The transport correlates the response by `tid` at the `MsgBase` level (not the
   payload), accepts `isResError`, and resolves `putDoc` as `Result.Err` with
   `message = invokeResult.forbidden`
   — [vibes-diy-api-transport.ts:106-135](../../../vibes.diy/api/impl/vibes-diy-api-transport.ts#L106-L135).
4. `vibePutDoc` receives that error. `errMessage` **is** the `forbidden` reason — but the
   toast logic discards it and substitutes hardcoded copy, special-casing only the literal
   `"Access denied"` via a regex
   — [srv-sandbox.ts:359-374](../../../vibes.diy/vibe/srv-sandbox/srv-sandbox.ts#L359-L374):

   ```ts
   const isAccessDenied = /access\s+denied/i.test(errMessage);
   sandbox.args.errorLogger(
     isAccessDenied ? "You have read-only access to this app." : "Failed to save your changes. Please try again."
   );
   ```

A custom reason does not match `/access denied/`, so it falls through to the generic
message. (`errMessage` _is_ already forwarded to the iframe as the `res-put-doc` `message`
field — just never into the toast.)

## Why this needs a server-side signal

To show a custom reason **verbatim** we must distinguish an access denial from a genuine
DB/infra failure. Free text cannot do this: a denial reason (`"Only the author can edit"`)
and an infra error (`"db write failed"`, `"Request idle for 30000ms"`) are
indistinguishable strings. Both currently surface as a no-code `Result.Err`.

So we add a dedicated `code` on the denial path rather than sniffing message text. This
follows the type-hygiene rule: do not overload one field (`message`) with a second meaning
("is this a user-facing denial?") — add a dedicated field.

`ResError` already supports an optional `code`
([common.ts:118-121](../../../vibes.diy/api/types/common.ts#L118-L121)), and
`VibesDiyError = ResError & Error`, so the code rides through the transport untouched
(`mkResError(e.error.message, e.error.code)`) and is readable at `err.error.code` in the
handler. No protocol type change is required.

## Decision: toast copy behavior

(Confirmed with the driver.)

| Source                                                  | Toast                                              |
| ------------------------------------------------------- | -------------------------------------------------- |
| Custom `forbidden("reason")` or access-fn helper denial | the reason, **verbatim**                           |
| Platform default denial (bare `"Access denied"`)        | `"You have read-only access to this app."`         |
| Genuine DB / network / infra failure                    | `"Failed to save your changes. Please try again."` |

The platform's default ACL denials all emit the literal `"Access denied"` from five sites
in the write evento (lines 153, 158, 170, 175, 209). These keep their friendly read-only
copy and stay **unchanged** (no code added) — handled by the exact-match branch below.

## Changes

### 1. Server — `api/svc/public/app-documents-write-eventos.ts` (additive)

Add `code: "access-denied"` to the two access-_function_ denial `res-error` sends:

- the access-fn `forbidden` path
  ([:316-322](../../../vibes.diy/api/svc/public/app-documents-write-eventos.ts#L316-L322)) —
  carries both custom `forbidden(...)` reasons and access-fn helper messages
  (`not in channel: X`, `not in role: Y`, `authentication required`, produced in
  [cf-serve.ts:274-293](../../../vibes.diy/api/svc/cf-serve.ts#L274-L293) and returned as
  `{ forbidden }`).
- the `enforceAllowAnonymous` path
  ([:328-331](../../../vibes.diy/api/svc/public/app-documents-write-eventos.ts#L328-L331)).

```ts
// forbidden path
error: { message: invokeResult.forbidden, code: "access-denied" }

// enforceAllowAnonymous path
error: { message: reason, code: "access-denied" }
```

The five platform ACL default denials are **not** touched — they keep emitting bare
`"Access denied"` with no code. The `code: "unreadable"` channel-less-doc denial and the
`Invalid file reference` send are out of scope and unchanged.

### 2. Client — `vibe/srv-sandbox/srv-sandbox.ts` `vibePutDoc`

Replace the toast selection
([:362-365](../../../vibes.diy/vibe/srv-sandbox/srv-sandbox.ts#L362-L365)):

```ts
// App-authored reasons land directly in the toast UI; trim and cap so a long
// access.js string can't overwhelm it (Charlie review, PR #2331).
const ACCESS_REASON_MAX = 200;
const capReason = (s: string): string => {
  const trimmed = s.trim();
  return trimmed.length > ACCESS_REASON_MAX ? `${trimmed.slice(0, ACCESS_REASON_MAX - 1)}…` : trimmed;
};

const code = typeof err === "string" ? undefined : err?.error?.code;
const toast =
  code === "access-denied"
    ? capReason(errMessage) // custom reason / helper message, verbatim (trimmed + capped)
    : errMessage === "Access denied"
      ? "You have read-only access to this app." // platform default
      : "Failed to save your changes. Please try again."; // infra/DB fallback
sandbox.args.errorLogger(toast);
```

- Tighten the platform-default match from `/access\s+denied/i` to an exact
  `errMessage === "Access denied"`: the platform always emits exactly that string, and
  exact match avoids a genuine infra error that merely _contains_ "access denied" being
  mislabeled read-only.
- Per Charlie's review: trim the verbatim reason and cap it at 200 chars (ellipsis on
  overflow) so an app-authored string can't overwhelm the toast. Plain-string render, so
  no HTML/XSS concern. The capping applies only to the verbatim `access-denied` branch.
- The `console.debug("vibePutDoc failed", ...)` call and the `res-put-doc` error message
  forwarded to the iframe (`message: errMessage`) are unchanged — the iframe still receives
  the full, uncapped reason.

### 3. Tests — `api/tests/srv-sandbox-put-doc.test.ts`

- existing `"db write failed"` (no code) → still generic ✓ (unchanged assertion)
- existing `"Access denied"` (no code) → still `"You have read-only access to this app."` ✓
- **new:** error `{ message: "Only the author can edit this post", error: { code: "access-denied" } }`
  → toast equals `"Only the author can edit this post"`, and the forwarded `res-put-doc`
  still carries `message: "Only the author can edit this post"`.
- **new (cap):** a coded denial whose message exceeds 200 chars → toast is trimmed and
  capped to 200 chars with a trailing `…`, while the forwarded `res-put-doc` still carries
  the full uncapped message.
- if an evento-level test covers the forbidden path, assert the emitted `res-error` now
  carries `code: "access-denied"`.

## Out of scope

- The five platform ACL default denials (keep friendly read-only copy).
- The `unreadable` channel-less-doc denial and `Invalid file reference` send.
- Any change to `ResError`/`ResPutDoc` shapes (the optional `code` already exists).
- Adding granular per-cause codes (`access-fn-not-in-channel`, etc.) — a single
  `access-denied` code is sufficient for the toast decision.

## Verification

- `cd vibes.diy/tests && pnpm test` (and the srv-sandbox put-doc test file specifically).
- `pnpm check` before commit.
- Manual: a vibe with `access.js` that calls `forbidden("custom reason")` shows
  "custom reason" in the toast on a denied write; a read-only member still sees
  "You have read-only access to this app."; a forced DB error still shows the generic copy.

## Follow-up

Correct the root-cause writeup on issue #2330 (the reason is discarded at the toast, not
lost in transit).
