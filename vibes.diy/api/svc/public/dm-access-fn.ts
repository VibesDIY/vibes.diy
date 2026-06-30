// Built-in access function for direct messages (#2290).
//
// DMs used to be gated by a bespoke `isDirectChannel(...)` fork in the read /
// write / delete / subscribe handlers. They now ride the ordinary access-fn +
// channel-gating pipeline instead: a DM db (appSlug "dm", dbName "messages",
// ownerHandle = the `_d.<a>.<b>` channel slug) resolves to THIS built-in access
// function via a synthetic binding (see resolveAccessBinding), so no DB row and
// no `/access.js` file is needed.
//
// The function parses the two participants out of the channel slug it receives
// as `ctx.ownerHandle` (wired in localInvokeAccessFn), denies any writer who is
// not one of them, and routes each message into a single channel that grants
// BOTH participants — and only them. The app owner is never granted, so the
// owner-override read bypass can't reach another user's private DMs: the
// invariant the old special case enforced by branch-shape is now declared in
// the function itself.
import { sha256 } from "@noble/hashes/sha2.js";
import { base58btc } from "multiformats/bases/base58";

// Source string for the built-in DM access function. The export name MUST be the
// DM db name ("messages") so extractExportSource / the invoker pick it up. DM dbs
// are identified by the `_d.` ownerHandle slug (isDirectChannel), under appSlug
// "dm" / dbName "messages". `ctx.ownerHandle` is the channel slug "_d.<a>.<b>"
// (participants sorted).
export const DM_BUILTIN_SOURCE = `export function messages(doc, oldDoc, user, ctx) {
  const slug = ctx.ownerHandle;
  if (!slug || slug.indexOf("_d.") !== 0) {
    return { forbidden: "not a direct channel" };
  }
  const body = slug.slice(3);
  const dot = body.indexOf(".");
  if (dot < 1 || dot === body.length - 1) {
    return { forbidden: "malformed direct channel" };
  }
  const a = body.slice(0, dot);
  const b = body.slice(dot + 1);
  if (!user) {
    return { forbidden: "authentication required" };
  }
  if (user.userHandle !== a && user.userHandle !== b) {
    return { forbidden: "not a participant" };
  }
  return { channels: [slug], grant: { users: { [a]: [slug], [b]: [slug] } } };
}
`;

// Content-addressed id for the built-in source, computed the same way the asset
// store computes CIDs (base58btc(sha256(bytes)), see Cider in ensure-storage.ts)
// so it is a genuine, stable content address rather than a magic string.
export const DM_BUILTIN_CID = base58btc.encode(sha256(new TextEncoder().encode(DM_BUILTIN_SOURCE)));
