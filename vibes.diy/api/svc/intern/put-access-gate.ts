import { and, eq } from "drizzle-orm";
import { VibesApiSQLCtx } from "../types.js";
import {
  enforceAllowAnonymous,
  ForbiddenError,
  extractExportSource,
  isReadableResult,
  type AccessDescriptor,
} from "../public/access-function.js";
import { GrantReduce, extractContribution, newSeededReduce } from "../public/grant-reduce.js";
import { resolveAccessFnSource } from "../public/access-binding-resolver.js";

export type PutAccessGateResult =
  | { readonly kind: "allow"; readonly descriptor: AccessDescriptor; readonly grantsReduceBefore: GrantReduce }
  | { readonly kind: "deny"; readonly code: "access-denied" | "unreadable"; readonly message: string };

/**
 * Pure-decision access-fn gate for putDoc (B6 increment 1, behavior-preserving
 * extraction). Resolves the access.js source (CID cache + R2 fetch), builds the
 * grant-state reduce from stored AccessFnOutputs, invokes the access fn, and
 * enforces the three rejection contracts (forbidden, allowAnonymous, readability).
 *
 * This function makes NO `ctx.send` calls — it returns a `deny`/`allow` decision
 * and the caller maps that onto the wire. The caller-resolved bits (userContext,
 * adminMode, oldDoc) are passed in because B6's backend caller resolves them
 * differently.
 */
export async function runPutAccessGate(
  vctx: VibesApiSQLCtx,
  input: {
    readonly ownerHandle: string;
    readonly appSlug: string;
    readonly dbName: string;
    readonly fnCid: string;
    readonly accessFnAssetUri?: string;
    readonly accessFnDbName: string; // afbRow.dbName, for extractExportSource
    readonly docId: string;
    readonly doc: unknown;
    readonly oldDoc: unknown | null;
    readonly userContext: { userHandle: string; isOwner: boolean } | null;
    readonly adminMode: boolean;
  }
): Promise<PutAccessGateResult> {
  const fnCid = input.fnCid;

  // Resolve the access.js source via the shared resolver (per-DO CID cache →
  // asset store; the synthetic DM binding's source is compiled in). The source is
  // content-addressed and immutable per CID, so a cache hit can never go stale.
  // extractExportSource is dbName-dependent (cheap, in-memory string work), so it
  // runs per write against the resolved source rather than caching the extracted
  // result — the CID-keyed cache only elides the R2 fetch. See #2512 / #2290.
  const rawSource = await resolveAccessFnSource(vctx, fnCid, input.accessFnAssetUri);
  const accessFnSource = rawSource !== undefined ? (extractExportSource(rawSource, input.accessFnDbName) ?? rawSource) : undefined;

  // Build reduce from stored outputs for grant state
  const tOutputs = vctx.sql.tables.accessFnOutputs;
  const storedOutputs = await vctx.sql.db
    .select({ docId: tOutputs.docId, output: tOutputs.output })
    .from(tOutputs)
    .where(
      and(
        eq(tOutputs.ownerHandle, input.ownerHandle),
        eq(tOutputs.appSlug, input.appSlug),
        eq(tOutputs.dbName, input.dbName),
        eq(tOutputs.fnCid, fnCid),
        eq(tOutputs.hasGrants, 1)
      )
    );

  const reduce = newSeededReduce(input.ownerHandle);
  for (const row of storedOutputs) {
    reduce.addDoc(row.docId, extractContribution(JSON.parse(row.output) as AccessDescriptor));
  }
  const grantsReduceBefore = reduce;

  const grantState = {
    members: Object.fromEntries(Array.from(reduce.effectiveMembers).map(([k, v]) => [k, Array.from(v)])),
    roleGrants: Object.fromEntries(Array.from(reduce.roleGrants).map(([k, v]) => [k, Array.from(v)])),
    userGrants: Object.fromEntries(Array.from(reduce.userGrants).map(([k, v]) => [k, Array.from(v)])),
  };

  if (!vctx.invokeAccessFn) {
    // Defense in depth: callers gate on vctx.invokeAccessFn before reaching
    // here. Treat a missing invoker as forbidden rather than open.
    return { kind: "deny", code: "access-denied", message: "Access function unavailable" };
  }

  const invokeResult = await vctx.invokeAccessFn({
    cid: fnCid,
    doc: { ...(input.doc as object), _id: input.docId },
    oldDoc: input.oldDoc,
    user: input.userContext,
    source: accessFnSource,
    grantState,
    adminMode: input.adminMode,
    // The db's ownerHandle, surfaced to the access fn as `ctx.ownerHandle` (#2290).
    ownerHandle: input.ownerHandle,
  });

  if ("forbidden" in invokeResult) {
    // `access-denied` lets the client surface this reason verbatim in the
    // write-fail toast (vs. the generic "Failed to save" copy). See #2330.
    return { kind: "deny", code: "access-denied", message: invokeResult.forbidden };
  }

  try {
    enforceAllowAnonymous(invokeResult, input.userContext);
  } catch (err: unknown) {
    const reason = err instanceof ForbiddenError ? err.forbidden : String(err);
    return { kind: "deny", code: "access-denied", message: reason };
  }

  // Reject writes that place the doc in zero channels: the read gate
  // refuses any channel-less doc (no owner bypass), so persisting it
  // would create a doc unreadable by everyone, silently. Point the
  // builder at the existing channel+grant pattern. Doc-local check —
  // we do not chase the cross-doc grant graph here.
  if (!isReadableResult(invokeResult)) {
    return {
      kind: "deny",
      code: "unreadable",
      message:
        "Unreadable write: access.js placed this doc in no channel, so no one can read it — not even its author. " +
        "Return a channel + grant. Private to author: " +
        "return { channels: [doc._id], grant: { users: { [user.userHandle]: [doc._id] } } }. " +
        "Public: return { channels: [doc._id], grant: { public: [doc._id] } }.",
    };
  }

  return { kind: "allow", descriptor: invokeResult, grantsReduceBefore };
}
