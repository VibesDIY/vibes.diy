import { isDirectChannel } from "@vibes.diy/api-types";
import { VibesApiSQLCtx } from "../types.js";
import { extractExportSource } from "../public/access-function.js";
import { checkDocAccess } from "../public/access-helpers.js";
import { aclAllows, resolveDbAcl } from "../public/db-acl-resolver.js";
import { resolveAccessBinding, resolveAccessFnSource, resolveDmParticipantHandle } from "../public/access-binding-resolver.js";

export type DeleteAccessGateResult = { readonly kind: "allow" } | { readonly kind: "deny"; readonly message: string };

/**
 * Pure-decision delete gate for deleteDoc (B6 increment 2). Deletes never rebuild
 * grant state or upsert the output sidecar (unlike put — the caller removes the
 * output row separately). Two paths, matching the frontend delete exactly:
 *
 * - **DM db** (`_d.<a>.<b>` slug, #2290): the built-in DM access fn's participant
 *   check — only a channel participant may delete. Resolve the caller's
 *   channel-participant handle (a multi-handle user can be addressed at a
 *   non-default handle) and invoke the fn (which gates purely on `user` +
 *   `ctx.ownerHandle`, ignoring `doc`). Fail closed when no invoker is available.
 * - **every other db**: the doc-access role against the db ACL's `delete` action.
 *
 * Returns an `allow`/`deny` decision with NO `ctx.send`; the caller maps it onto
 * the wire. `adminMode` is caller-resolved (WS: `connectionAdminMode(ctx)`; B6's
 * backend caller resolves it differently). Shared by `deleteDocEvento` and the
 * backend `ctx.db.delete` callback so allow/deny is identical per-op.
 */
export async function runDeleteAccessGate(
  vctx: VibesApiSQLCtx,
  input: {
    readonly ownerHandle: string;
    readonly appSlug: string;
    readonly dbName: string;
    readonly docId: string;
    readonly userId: string;
    readonly adminMode: boolean;
  }
): Promise<DeleteAccessGateResult> {
  if (isDirectChannel(input.ownerHandle)) {
    const afbRow = await resolveAccessBinding(vctx, input.ownerHandle, input.appSlug, input.dbName);
    const writerHandle = await resolveDmParticipantHandle(vctx, input.userId, input.ownerHandle);
    const dmSource = afbRow ? await resolveAccessFnSource(vctx, afbRow.accessFnCid, afbRow.accessFnAssetUri) : undefined;
    const gate =
      afbRow && vctx.invokeAccessFn
        ? await vctx.invokeAccessFn({
            cid: afbRow.accessFnCid,
            doc: { _id: input.docId },
            oldDoc: null,
            user: writerHandle ? { userHandle: writerHandle, isOwner: false } : null,
            source: dmSource !== undefined ? (extractExportSource(dmSource, afbRow.dbName) ?? dmSource) : undefined,
            ownerHandle: input.ownerHandle,
          })
        : { forbidden: "access function unavailable" };
    if ("forbidden" in gate) {
      return { kind: "deny", message: "Access denied" };
    }
  } else {
    const { access } = await checkDocAccess(vctx, input.userId, input.appSlug, input.ownerHandle, input.adminMode);
    const rAcl = await resolveDbAcl(vctx, input.ownerHandle, input.appSlug, input.dbName);
    if (rAcl.isErr() || !aclAllows(rAcl.Ok(), "delete", access)) {
      return { kind: "deny", message: "Access denied" };
    }
  }
  return { kind: "allow" };
}
