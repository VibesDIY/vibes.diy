import type { Dimension } from "./config.js";

export interface AccessAnalysis {
  // hard signals
  readonly isOwnerWriteGate: boolean; // any user.isOwner gating a write -> design forbids (target 0)
  readonly requireRoleOwnerWrite: boolean; // a core write gated on requireRole("owner")
  // Form-A
  readonly formAStrict: boolean; // requireRole("owner") core write where the dimension should be multiplayer
  readonly formABroad: boolean; // owner-only membership with no join/request path (per-object dims)
  // per-visitor
  readonly perUserChannel: boolean; // channel keyed on user handle
  readonly authorCheckCreate: boolean;
  readonly authorCheckUpdate: boolean; // oldDoc author compared
  readonly authorImmutable: boolean; // oldDoc author cannot change
  readonly selfGrant: boolean; // grant.users[...] self-grant present
  readonly perVisitorClean: boolean;
  // per-object recipe
  readonly objectChannel: boolean; // channel like `name:${...}` keyed on an object id
  readonly memberAuthoredShare: boolean; // a `share`/invite branch that grants another user in
  readonly requireAccessChild: boolean; // child docs gated by ctx.requireAccess(objectChannel)
  readonly joinPath: boolean; // a request/join branch (membership reachable by non-owner)
  readonly perObjectRecipe: boolean;
  // owner-published / author-owned
  readonly ownerPublished: boolean; // requireRole("owner") write + public read
  readonly publicRead: boolean; // grant.public read
  readonly authorOwned: boolean; // any signed-in author writes own doc, public read
}

const RE = {
  isOwner: /\buser\.isOwner\b/,
  requireRoleOwner: /requireRole\(\s*["'`]owner["'`]\s*\)/,
  perUserChannel: /user:\$\{[^}]*\b(userHandle|authorHandle|handle)\b[^}]*\}/,
  // `list:${doc._id}` / `ch:${doc.id}` — an interpolated channel keyed on an object/doc id.
  objectChannel: /["'`]\w+:\$\{[^}]*\b(_id|[A-Za-z]+Id|id)\b[^}]*\}/,
  grantUsers: /grant\s*:\s*\{[^}]*\busers\b/s,
  grantPublic: /grant\s*:\s*\{[^}]*\bpublic\b/s,
  requireAccess: /requireAccess\(/,
  // oldDoc author comparison (immutable author on update). Require an adjacent
  // comparison operator (either side) in the same statement so a read-only mention
  // like `const prev = oldDoc.author` is NOT counted as an immutability check
  // (Codex/Charlie review #2621).
  oldDocAuthor:
    /(oldDoc\b[^;{}]*\.(?:authorHandle|author|userHandle|createdBy|owner)\b[^;{}]*(?:!==|===)|(?:!==|===)[^;{}]*oldDoc\b[^;{}]*\.(?:authorHandle|author|userHandle|createdBy|owner)\b)/,
  // Author-on-create check, order-insensitive: `doc.author === user.handle` OR the
  // reversed `user.handle === doc.author` (Codex/Charlie review #2621).
  authorCreate:
    /(\bdoc\.(?:authorHandle|author|userHandle)\b[^;{}]*?(?:!==|===)\s*user\.(?:userHandle|handle)|\buser\.(?:userHandle|handle)\b[^;{}]*?(?:!==|===)\s*doc\.(?:authorHandle|author|userHandle))/,
  shareBranch: /\b(type\s*===\s*["'`](share|invite|member|join)["'`]|doc\.(invitee|inviteHandle|memberHandle))\b/,
  joinBranch: /\b(type\s*===\s*["'`](join|request)["'`]|requestToJoin|joinRequest)\b/,
  // A `members: { ... }` map (role/channel -> users) — the membership construct.
  membersMap: /\bmembers\s*:\s*\{/,
};

export function analyzeAccess(src: string, expect: Dimension): AccessAnalysis {
  const has = (re: RegExp) => re.test(src);
  const isOwnerWriteGate = has(RE.isOwner);
  const requireRoleOwnerWrite = has(RE.requireRoleOwner);
  const perUserChannel = has(RE.perUserChannel);
  const selfGrant = has(RE.grantUsers);
  const publicRead = has(RE.grantPublic);
  const requireAccessChild = has(RE.requireAccess);
  const authorCheckCreate = has(RE.authorCreate);
  const authorCheckUpdate = has(RE.oldDocAuthor);
  const authorImmutable = authorCheckUpdate; // oldDoc author compared => immutable
  const objectChannel = has(RE.objectChannel);
  const membersMap = has(RE.membersMap);
  const memberAuthoredShare = has(RE.shareBranch) && selfGrant;
  const joinPath = has(RE.joinBranch) || memberAuthoredShare;

  // Owner-only membership: a `members:` map handed out under a requireRole("owner") gate
  // (the owner is the sole grantor of membership) with no self-service join/share path.
  const ownerGatedMembership = membersMap && requireRoleOwnerWrite;

  // owner-published is the ONLY dimension where requireRole("owner") on the write is correct.
  const ownerPublished = requireRoleOwnerWrite && publicRead;
  // Form-A strict: an owner-gated core write in a dimension that must be multiplayer/per-visitor.
  const multiplayer = expect === "per-visitor" || expect === "per-object" || expect === "author-owned";
  const formAStrict = multiplayer && requireRoleOwnerWrite;
  // Form-A broad (per-object): membership exists but only the owner can grant it (no join path).
  // The membership construct may surface as an object-keyed channel OR an owner-gated members map.
  const formABroad = expect === "per-object" && (objectChannel || ownerGatedMembership) && !joinPath;

  const perVisitorClean =
    expect === "per-visitor" &&
    perUserChannel &&
    authorCheckCreate &&
    authorImmutable &&
    selfGrant &&
    !requireRoleOwnerWrite &&
    !isOwnerWriteGate;
  const perObjectRecipe =
    expect === "per-object" && objectChannel && selfGrant && memberAuthoredShare && requireAccessChild && authorImmutable;
  const authorOwned = expect === "author-owned" && authorCheckCreate && publicRead && !requireRoleOwnerWrite && !isOwnerWriteGate;

  return {
    isOwnerWriteGate,
    requireRoleOwnerWrite,
    formAStrict,
    formABroad,
    perUserChannel,
    authorCheckCreate,
    authorCheckUpdate,
    authorImmutable,
    selfGrant,
    perVisitorClean,
    objectChannel,
    memberAuthoredShare,
    requireAccessChild,
    joinPath,
    perObjectRecipe,
    ownerPublished,
    publicRead,
    authorOwned,
  };
}
