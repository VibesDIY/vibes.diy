import { FPCloudClaim, dbAcl, queryFilter, type DbAcl } from "@vibes.diy/api-types";
export type { AccessDescriptor, AccessFunction, Helpers, UserContext } from "@vibes.diy/api-types";
import { type } from "arktype";

export * from "./img-gen.js";

export type { DbAcl };

const Base = type({
  tid: "string",
});

export const ReqVibeRegisterFPDb = type({
  type: "'vibe.req.register.fpdb'",
  dbName: "string",
  appSlug: "string",
  userSlug: "string",
  fsId: "string",
}).and(Base);

export type ReqVibeRegisterFPDb = typeof ReqVibeRegisterFPDb.infer;

export function isReqVibeRegisterFPDb(x: unknown): x is ReqVibeRegisterFPDb {
  return !(ReqVibeRegisterFPDb(x) instanceof type.errors);
}

export const ResErrorVibeRegisterFPDb = type({
  type: "'vibe.res.register.fpdb'",
  status: "'error'",
  message: "string",
}).and(Base);

export type ResErrorVibeRegisterFPDb = typeof ResErrorVibeRegisterFPDb.infer;

export const FPDbData = type({
  dbName: "string",
  appSlug: "string",
  userSlug: "string",
  // fsId: "string",
  // appId: "string",
  // tenant: "string",
  // ledger: "string",
});

export type FPDbData = typeof FPDbData.infer;

export const FBDbDataWithUrl = FPDbData.and(type({ fpcloudUrl: "string" }));

export const ResOkVibeRegisterFPDb = type({
  type: "'vibe.res.register.fpdb'",
  status: "'ok'",
  data: FPDbData,
}).and(Base);

export const EvtRuntimeReady = type({
  type: "'vibe.evt.runtime.ready'",
  deps: "string[]",
});
export type EvtRuntimeReady = typeof EvtRuntimeReady.infer;

export function isEvtRuntimeReady(x: unknown): x is EvtRuntimeReady {
  return !(EvtRuntimeReady(x) instanceof type.errors);
}

// Parent → iframe acknowledgement of `vibe.evt.runtime.ready`. The iframe
// posts runtime.ready repeatedly until it sees this ack, to defeat the race
// where a cached-assets iframe boots faster than the parent's React provider
// attaches its message listener. Idempotent; first ack wins.
export const EvtRuntimeAck = type({
  type: "'vibe.evt.runtime.ack'",
});
export type EvtRuntimeAck = typeof EvtRuntimeAck.infer;

export function isEvtRuntimeAck(x: unknown): x is EvtRuntimeAck {
  return !(EvtRuntimeAck(x) instanceof type.errors);
}

// Parent → iframe live-preview hot-swap. Fire-and-forget (no response).
// Carries the resolved App.jsx source after each block.code.end so the iframe
// can sucrase-transform + remount in place, avoiding an iframe reload.
export const EvtVibeSetSource = type({
  type: "'vibe.evt.set-source'",
  source: "string",
});
export type EvtVibeSetSource = typeof EvtVibeSetSource.infer;

export function isEvtVibeSetSource(x: unknown): x is EvtVibeSetSource {
  return !(EvtVibeSetSource(x) instanceof type.errors);
}

// Iframe → parent hot-swap failure signal. Fires when sucrase transform,
// dynamic import, or mountVibe reject the source from a vibe.evt.set-source
// envelope. The iframe keeps its previous DOM (mountVibe reuses the React
// root); the parent surfaces a toast so the user knows that a streamed edit
// didn't paint even though subsequent edits keep flowing.
export const EvtVibeHotSwapError = type({
  type: "'vibe.evt.hot-swap-error'",
  message: "string",
});
export type EvtVibeHotSwapError = typeof EvtVibeHotSwapError.infer;

export function isEvtVibeHotSwapError(x: unknown): x is EvtVibeHotSwapError {
  return !(EvtVibeHotSwapError(x) instanceof type.errors);
}

// Iframe → parent network-activity heartbeat. The sandbox runtime
// monkey-patches globalThis.fetch and emits these so the host can show a
// twinkle on the VibesSwitch pill while any HTTP request is in flight.
export const EvtVibeNetworkActive = type({
  type: "'vibe.evt.network.active'",
  count: "number",
});
export type EvtVibeNetworkActive = typeof EvtVibeNetworkActive.infer;

export function isEvtVibeNetworkActive(x: unknown): x is EvtVibeNetworkActive {
  return !(EvtVibeNetworkActive(x) instanceof type.errors);
}

export const EvtVibeNetworkIdle = type({
  type: "'vibe.evt.network.idle'",
});
export type EvtVibeNetworkIdle = typeof EvtVibeNetworkIdle.infer;

export function isEvtVibeNetworkIdle(x: unknown): x is EvtVibeNetworkIdle {
  return !(EvtVibeNetworkIdle(x) instanceof type.errors);
}

export const EvtVibeAttachStatusFPDb = type({
  type: "'vibe.evt.attach.status.fpdb'",
  data: FBDbDataWithUrl,
  status: "'error' | 'attached' | 'loading' | 'loaded' | 'detached' | 'syncing' | 'idle'",
});

export type EvtVibeAttachStatusFPDb = typeof EvtVibeAttachStatusFPDb.infer;

export const EvtAttachFPDb = type({
  type: "'vibe.evt.attach.fpdb'",
  data: FBDbDataWithUrl,
});
export function isEvtAttachFPDb(x: unknown): x is typeof EvtAttachFPDb.infer {
  return !(EvtAttachFPDb(x) instanceof type.errors);
}

export type EvtAttachFPDb = typeof EvtAttachFPDb.infer;

export type ResOkVibeRegisterFPDb = typeof ResOkVibeRegisterFPDb.infer;

const ResVibeRegisterFPDb = ResErrorVibeRegisterFPDb.or(ResOkVibeRegisterFPDb);

export function isResVibeRegisterFPDb(x: unknown): x is ResVibeRegisterFPDb {
  return !(ResVibeRegisterFPDb(x) instanceof type.errors);
}

export type ResVibeRegisterFPDb = typeof ResVibeRegisterFPDb.infer;
export function isResOkVibeRegisterFPDb(x: unknown): x is ResOkVibeRegisterFPDb {
  return !(ResOkVibeRegisterFPDb(x) instanceof type.errors);
}
export function isResErrorVibeRegisterFPDb(x: unknown): x is ResErrorVibeRegisterFPDb {
  return !(ResErrorVibeRegisterFPDb(x) instanceof type.errors);
}

export const ReqFetchCloudToken = type({
  type: "'vibe.req.fetchCloudToken'",
  data: FPDbData,
}).and(Base);

export type ReqFetchCloudToken = typeof ReqFetchCloudToken.infer;

export function isReqFetchCloudToken(x: unknown): x is ReqFetchCloudToken {
  return !(ReqFetchCloudToken(x) instanceof type.errors);
}

export const ResFetchCloudToken = type({
  type: "'vibe.res.fetchCloudToken'",
  data: FPDbData,
  token: {
    cloudToken: "string",
    claims: FPCloudClaim,
    expiresInSec: "number",
  },
}).and(Base);

export type ResFetchCloudToken = typeof ResFetchCloudToken.infer;

export function isResFetchCloudToken(x: unknown): x is ResFetchCloudToken {
  return !(ResFetchCloudToken(x) instanceof type.errors);
}

// JSONSchema — recursive fields use unknown to avoid arktype cyclic-type constraints
export const JSONSchema = type({
  "type?": "string | string[]",
  "title?": "string",
  "description?": "string",
  "default?": "unknown",
  "examples?": "unknown[]",
  "enum?": "unknown[]",
  "const?": "unknown",
  // String
  "minLength?": "number",
  "maxLength?": "number",
  "pattern?": "string",
  "format?": "string",
  // Number / integer
  "minimum?": "number",
  "maximum?": "number",
  "exclusiveMinimum?": "number",
  "exclusiveMaximum?": "number",
  "multipleOf?": "number",
  // Array
  "items?": "unknown",
  "minItems?": "number",
  "maxItems?": "number",
  "uniqueItems?": "boolean",
  // Object
  "properties?": "Record<string, unknown>",
  "required?": "string[]",
  "additionalProperties?": "boolean | Record<string, unknown>",
  "minProperties?": "number",
  "maxProperties?": "number",
  // Composition
  "allOf?": "unknown[]",
  "anyOf?": "unknown[]",
  "oneOf?": "unknown[]",
  "not?": "unknown",
  // References
  "$ref?": "string",
  "$defs?": "Record<string, unknown>",
});

export type JSONSchema = typeof JSONSchema.infer;

export function isJSONSchema(x: unknown): x is JSONSchema {
  return !(JSONSchema(x) instanceof type.errors);
}

export const ReqCallAI = type({
  type: "'vibe.req.callAI'",
  userSlug: "string",
  appSlug: "string",
  prompt: "string",
  schema: JSONSchema,
}).and(Base);

export type ReqCallAI = typeof ReqCallAI.infer;

export function isReqCallAI(x: unknown): x is ReqCallAI {
  return !(ReqCallAI(x) instanceof type.errors);
}

export const ResOkCallAI = type({
  type: "'vibe.res.callAI'",
  status: "'ok'",
  promptId: "string",
  result: "string",
}).and(Base);

export type ResOkCallAI = typeof ResOkCallAI.infer;

export const ResErrorCallAI = type({
  type: "'vibe.res.callAI'",
  status: "'error'",
  message: "string",
}).and(Base);

export type ResErrorCallAI = typeof ResErrorCallAI.infer;

const ResCallAI = ResOkCallAI.or(ResErrorCallAI);

export type ResCallAI = typeof ResCallAI.infer;

export function isResCallAI(x: unknown): x is ResCallAI {
  return !(ResCallAI(x) instanceof type.errors);
}

export function isResOkCallAI(x: unknown): x is ResOkCallAI {
  return !(ResOkCallAI(x) instanceof type.errors);
}

export function isResErrorCallAI(x: unknown): x is ResErrorCallAI {
  return !(ResErrorCallAI(x) instanceof type.errors);
}

// Image generation request/response types. The hook receives FileMeta
// entries (uploadId/cid/type/size) and writes them to `_files.v<N>` —
// Stage C's URL minter resolves the doc-side meta.url for display.
export const ReqImgGen = type({
  type: "'vibe.req.imgGen'",
  userSlug: "string",
  appSlug: "string",
  prompt: "string",
  "inputImageBase64?": "string",
  "model?": "string",
}).and(Base);

export type ReqImgGen = typeof ReqImgGen.infer;

export function isReqImgGen(x: unknown): x is ReqImgGen {
  return !(ReqImgGen(x) instanceof type.errors);
}

export const ImgGenFile = type({
  uploadId: "string",
  cid: "string",
  mimeType: "string",
  size: "number",
});

export type ImgGenFile = typeof ImgGenFile.infer;

export const ResOkImgGen = type({
  type: "'vibe.res.imgGen'",
  status: "'ok'",
  files: ImgGenFile.array(),
}).and(Base);

export type ResOkImgGen = typeof ResOkImgGen.infer;

export const ResErrorImgGen = type({
  type: "'vibe.res.imgGen'",
  status: "'error'",
  message: "string",
}).and(Base);

export type ResErrorImgGen = typeof ResErrorImgGen.infer;

const ResImgGen = ResOkImgGen.or(ResErrorImgGen);

export type ResImgGen = typeof ResImgGen.infer;

export function isResImgGen(x: unknown): x is ResImgGen {
  return !(ResImgGen(x) instanceof type.errors);
}

export function isResOkImgGen(x: unknown): x is ResOkImgGen {
  return !(ResOkImgGen(x) instanceof type.errors);
}

export function isResErrorImgGen(x: unknown): x is ResErrorImgGen {
  return !(ResErrorImgGen(x) instanceof type.errors);
}

// ── Firefly document operations ──────────────────────────────────────
// Same vibes.diy.* type strings as the API boundary (api-types/app-documents.ts).
// Request types here are the iframe (postMessage) variants — they have tid, no auth.
// Response types and events are shared — re-exported from api-types.

// Response types + events: shared across boundaries (no auth, no tid)
export {
  type ResPutDoc,
  type ResGetDoc,
  type ResGetDocNotFound,
  type ResQueryDocs,
  type ResDeleteDoc,
  type ResSubscribeDocs,
  type ResListDbNames,
  type EvtDocChanged,
  type QueryFilter,
  isResPutDoc,
  isResGetDoc,
  isResGetDocNotFound,
  isResQueryDocs,
  isResDeleteDoc,
  isResSubscribeDocs,
  isResListDbNames,
  isEvtDocChanged,
} from "@vibes.diy/api-types";

// Request types: iframe boundary (postMessage) — has tid, no auth.
// Same vibes.diy.* type strings as api-types, but different shape.

export const ReqPutDoc = type({
  type: "'vibes.diy.req-put-doc'",
  appSlug: "string",
  userSlug: "string",
  dbName: "string",
  doc: "Record<string, unknown>",
  "docId?": "string",
}).and(Base);

export type ReqPutDoc = typeof ReqPutDoc.infer;

export function isReqPutDoc(x: unknown): x is ReqPutDoc {
  return !(ReqPutDoc(x) instanceof type.errors);
}

export const ReqGetDoc = type({
  type: "'vibes.diy.req-get-doc'",
  appSlug: "string",
  userSlug: "string",
  dbName: "string",
  docId: "string",
}).and(Base);

export type ReqGetDoc = typeof ReqGetDoc.infer;

export function isReqGetDoc(x: unknown): x is ReqGetDoc {
  return !(ReqGetDoc(x) instanceof type.errors);
}

export const ReqQueryDocs = type({
  type: "'vibes.diy.req-query-docs'",
  appSlug: "string",
  userSlug: "string",
  dbName: "string",
  "filter?": queryFilter,
}).and(Base);

export type ReqQueryDocs = typeof ReqQueryDocs.infer;

export function isReqQueryDocs(x: unknown): x is ReqQueryDocs {
  return !(ReqQueryDocs(x) instanceof type.errors);
}

export const ReqDeleteDoc = type({
  type: "'vibes.diy.req-delete-doc'",
  appSlug: "string",
  userSlug: "string",
  dbName: "string",
  docId: "string",
}).and(Base);

export type ReqDeleteDoc = typeof ReqDeleteDoc.infer;

export function isReqDeleteDoc(x: unknown): x is ReqDeleteDoc {
  return !(ReqDeleteDoc(x) instanceof type.errors);
}

export const ReqSubscribeDocs = type({
  type: "'vibes.diy.req-subscribe-docs'",
  appSlug: "string",
  userSlug: "string",
  dbName: "string",
}).and(Base);

export type ReqSubscribeDocs = typeof ReqSubscribeDocs.infer;

export function isReqSubscribeDocs(x: unknown): x is ReqSubscribeDocs {
  return !(ReqSubscribeDocs(x) instanceof type.errors);
}

export const ReqSetDbAcl = type({
  type: "'vibes.diy.req-set-db-acl'",
  appSlug: "string",
  userSlug: "string",
  dbName: "string",
  acl: dbAcl,
}).and(Base);

export type ReqSetDbAcl = typeof ReqSetDbAcl.infer;

export function isReqSetDbAcl(x: unknown): x is ReqSetDbAcl {
  return !(ReqSetDbAcl(x) instanceof type.errors);
}

// Manual interface — matches both ok and error so the client resolves quickly
// instead of timing out on server-side owner-only rejections.
export interface ResSetDbAcl {
  readonly tid: string;
  readonly type: "vibes.diy.res-set-db-acl";
  readonly status: "ok" | "error";
  readonly message?: string;
}

export function isResSetDbAcl(x: unknown): x is ResSetDbAcl {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return r.type === "vibes.diy.res-set-db-acl" && typeof r.tid === "string" && (r.status === "ok" || r.status === "error");
}

export const ReqListDbNames = type({
  type: "'vibes.diy.req-list-db-names'",
  appSlug: "string",
  userSlug: "string",
}).and(Base);

export type ReqListDbNames = typeof ReqListDbNames.infer;

export function isReqListDbNames(x: unknown): x is ReqListDbNames {
  return !(ReqListDbNames(x) instanceof type.errors);
}

// Sandbox → host: upload a Blob/File via put-asset, return CID + uploadId
// + storage URL. Distinct from the WS / HTTP put-asset types in
// `@vibes.diy/api-types` because this one carries a Blob across the
// postMessage boundary (structured-cloned natively) and does NOT carry
// the grant — the grant is host-side, hidden from sandbox code.
//
// Manual type guard: arktype can't validate Blob; we check the non-blob
// fields with arktype and the blob with `instanceof Blob`.
export interface ReqVibePutAsset {
  readonly tid: string;
  readonly type: "vibe.req.putAsset";
  readonly userSlug: string;
  readonly appSlug: string;
  readonly blob: Blob;
  readonly mimeType?: string;
}

export function isReqVibePutAsset(x: unknown): x is ReqVibePutAsset {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    r.type === "vibe.req.putAsset" &&
    typeof r.tid === "string" &&
    typeof r.userSlug === "string" &&
    typeof r.appSlug === "string" &&
    typeof Blob !== "undefined" &&
    r.blob instanceof Blob &&
    (r.mimeType === undefined || typeof r.mimeType === "string")
  );
}

export const ResOkVibePutAsset = type({
  type: "'vibe.res.putAsset'",
  status: "'ok'",
  cid: "string",
  getURL: "string",
  size: "number",
  uploadId: "string",
}).and(Base);

export type ResOkVibePutAsset = typeof ResOkVibePutAsset.infer;

export const ResErrorVibePutAsset = type({
  type: "'vibe.res.putAsset'",
  status: "'error'",
  message: "string",
}).and(Base);

export type ResErrorVibePutAsset = typeof ResErrorVibePutAsset.infer;

const ResVibePutAsset = ResOkVibePutAsset.or(ResErrorVibePutAsset);
export type ResVibePutAsset = typeof ResVibePutAsset.infer;

export function isResVibePutAsset(x: unknown): x is ResVibePutAsset {
  return !(ResVibePutAsset(x) instanceof type.errors);
}

export function isResOkVibePutAsset(x: unknown): x is ResOkVibePutAsset {
  return !(ResOkVibePutAsset(x) instanceof type.errors);
}

// Heartbeat emitted by the host while a put-asset upload is in flight.
// Keeps the sandbox-side request's idle-reset timer alive across slow
// uploads. Receivers reset their timer on any matching tid; only
// `ResVibePutAsset` resolves the request.
export const EvtVibePutAssetProgress = type({
  type: "'vibe.evt.putAsset.progress'",
  bytes: "number",
}).and(Base);

export type EvtVibePutAssetProgress = typeof EvtVibePutAssetProgress.infer;

export function isEvtVibePutAssetProgress(x: unknown): x is EvtVibePutAssetProgress {
  return !(EvtVibePutAssetProgress(x) instanceof type.errors);
}

// ── Viewer identity & capabilities ───────────────────────────────────
// Sandbox-facing surface for who is viewing this vibe and what they can
// do. Sandbox sees only userSlug — never Clerk userId. Capabilities are
// UX hints; every write still re-authorizes server-side at put-doc.

export const viewerPayload = type({
  userSlug: "string",
  "displayName?": "string",
  avatarUrl: "string", // stable indirection URL — opaque to apps, set by server at render time
});
export type ViewerPayload = typeof viewerPayload.infer;

export const docAccessLevel = type("'owner' | 'editor' | 'viewer' | 'submitter' | 'none'");
export type DocAccessLevel = typeof docAccessLevel.infer;

// Request: sandbox → host. Carries (appSlug, userSlug) so the host
// handler can compute access against the right app — same pattern as
// every other Req<*> in this file.
export const ReqVibeWhoAmI = type({
  type: "'vibe.req.whoAmI'",
  appSlug: "string",
  userSlug: "string",
}).and(Base);

export type ReqVibeWhoAmI = typeof ReqVibeWhoAmI.infer;

export function isReqVibeWhoAmI(x: unknown): x is ReqVibeWhoAmI {
  return !(ReqVibeWhoAmI(x) instanceof type.errors);
}

// Response: host → sandbox.
//
// `viewer: null` means anonymous. The arktype `null` literal matches
// encoded JSON null.
//
// `access` is the app-scoped role. `dbAcls` carries any per-db overrides
// configured for this app — missing entries fall back to the role gate
// in the sandbox's `can()` helper.
export const ResVibeWhoAmI = type({
  type: "'vibe.res.whoAmI'",
  viewer: viewerPayload.or("null"),
  access: docAccessLevel,
  "dbAcls?": type({ "[string]": dbAcl }),
}).and(Base);

export type ResVibeWhoAmI = typeof ResVibeWhoAmI.infer;

export function isResVibeWhoAmI(x: unknown): x is ResVibeWhoAmI {
  return !(ResVibeWhoAmI(x) instanceof type.errors);
}

// Sandbox → host: persist a freshly-uploaded avatar CID to the viewer's
// platform profile. The host enforces that the sandbox userSlug matches
// the authenticated session before calling ensureUserSettings.
export const ReqVibeUpdateAvatarCid = type({
  type: "'vibe.req.updateAvatarCid'",
  userSlug: "string",
  appSlug: "string",
  cid: "string",
}).and(Base);

export type ReqVibeUpdateAvatarCid = typeof ReqVibeUpdateAvatarCid.infer;

export function isReqVibeUpdateAvatarCid(x: unknown): x is ReqVibeUpdateAvatarCid {
  return !(ReqVibeUpdateAvatarCid(x) instanceof type.errors);
}

// Host → sandbox response.
export const ResVibeUpdateAvatarCid = type({
  type: "'vibe.res.updateAvatarCid'",
  status: "'ok' | 'error'",
  "message?": "string",
}).and(Base);

export type ResVibeUpdateAvatarCid = typeof ResVibeUpdateAvatarCid.infer;

export function isResVibeUpdateAvatarCid(x: unknown): x is ResVibeUpdateAvatarCid {
  return !(ResVibeUpdateAvatarCid(x) instanceof type.errors);
}

// Sandbox → host: open the platform login UI. Fire-and-forget — no response
// expected; the viewer identity update arrives via vibe.evt.viewerChanged once
// the user completes login.
export const ReqVibeLogin = type({
  type: "'vibe.req.login'",
}).and(Base);

export type ReqVibeLogin = typeof ReqVibeLogin.infer;

export function isReqVibeLogin(x: unknown): x is ReqVibeLogin {
  return !(ReqVibeLogin(x) instanceof type.errors);
}

// Event: identity changed (login/logout, future persona switch). Same
// shape as the response minus tid semantics — no request to correlate.
export const EvtVibeViewerChanged = type({
  type: "'vibe.evt.viewerChanged'",
  viewer: viewerPayload.or("null"),
  access: docAccessLevel,
  "dbAcls?": type({ "[string]": dbAcl }),
});

export type EvtVibeViewerChanged = typeof EvtVibeViewerChanged.infer;

export function isEvtVibeViewerChanged(x: unknown): x is EvtVibeViewerChanged {
  return !(EvtVibeViewerChanged(x) instanceof type.errors);
}

// Event: parent posts a fresh colorset palette so the running app can re-skin
// without a codegen roundtrip. Runtime injects a <style> on document.head
// that sets CSS variables for every key in `colors` (and mirrors `colorsDark`
// inside a prefers-color-scheme: dark media query). When `colors` is empty
// the runtime removes the override (i.e. revert to the embedded palette).
export const EvtVibeColorOverride = type({
  type: "'vibe.evt.color-override'",
  colors: type({ "[string]": "string" }),
  "colorsDark?": type({ "[string]": "string" }),
});

export type EvtVibeColorOverride = typeof EvtVibeColorOverride.infer;

export function isEvtVibeColorOverride(x: unknown): x is EvtVibeColorOverride {
  return !(EvtVibeColorOverride(x) instanceof type.errors);
}

// Sandbox → host navigation request. A vibe posts this to ask the parent
// app to open a DM conversation with a specific user. The parent navigates
// to /messages/<myUserSlug>/<recipientUserSlug>. Fire-and-forget; no response.
export const ReqOpenDmThread = type({
  type: "'vibes.diy.req-open-dm-thread'",
  recipientUserSlug: "string",
}).and(Base);
export type ReqOpenDmThread = typeof ReqOpenDmThread.infer;
export function isReqOpenDmThread(x: unknown): x is ReqOpenDmThread {
  return !(ReqOpenDmThread(x) instanceof type.errors);
}
