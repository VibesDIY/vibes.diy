import type { Dimension } from "./config.js";

export interface AccessAnalysis {
  // hard signals
  readonly isOwnerWriteGate: boolean; // any user.isOwner gating a write -> design forbids (target 0)
  readonly isOwnerToken: boolean; // any literal `isOwner` token in access.js -> design retired it; hard fail
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
  readonly authorRosterGrant: boolean; // owner grants a user the author role/channel (the legit requireRole("owner"))
  readonly ownerOnlyContent: boolean; // requireRole("owner") gates the CONTENT post itself — the retired dead-end
  readonly ownerPublished: boolean; // public read + author-owned posts + owner controls the roster (NOT owner-only writes)
  readonly publicRead: boolean; // grant.public read
  readonly authorOwned: boolean; // any signed-in author writes own doc, public read
}

const RE = {
  isOwner: /\buser\.isOwner\b/,
  isOwnerToken: /\bisOwner\b/,
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
  // The `\b` lives on the bareword alternatives only — a trailing `\b` after the
  // closing quote of the `type === "share"` form never matches (a quote is non-word and
  // is followed by `)`/`{`/space), which silently dropped the most common share/join
  // pattern — the very one the prompt's own examples teach (#2631 fix).
  shareBranch: /(type\s*===\s*["'`](share|invite|member|join)["'`]|\bdoc\.(invitee|inviteHandle|memberHandle)\b)/,
  joinBranch: /(type\s*===\s*["'`](join|request)["'`]|\b(requestToJoin|joinRequest)\b)/,
  // The owner approves an author: a roster/grant branch (`type === "author"`/"writer"/… ) that
  // hands a user the author role or channel. The ONE place requireRole("owner") is correct (#2631).
  authorGrantBranch: /type\s*===\s*["'`](author|writer|contributor|editor|approve|grant)["'`]/,
  // A `members: { ... }` map (role/channel -> users) — the membership construct.
  membersMap: /\bmembers\s*:\s*\{/,
};

export function analyzeAccess(src: string, expect: Dimension): AccessAnalysis {
  const has = (re: RegExp) => re.test(src);
  const isOwnerWriteGate = has(RE.isOwner);
  const isOwnerToken = has(RE.isOwnerToken);
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

  // The owner approves authors: a roster grant (`type === "author"` …) under requireRole("owner")
  // that grants a user in. This is the ONE legitimate use of requireRole("owner") — gating WHO may
  // author, never the content itself (#2631 — owner-only publishing is a dead end).
  const authorRosterGrant = requireRoleOwnerWrite && selfGrant && has(RE.authorGrantBranch);
  // The retired dead-end: requireRole("owner") gates the content directly — no roster grant and
  // no author-owned posts — so nobody but the owner can ever publish.
  const ownerOnlyContent = requireRoleOwnerWrite && publicRead && !authorRosterGrant && !authorCheckCreate;
  // Corrected owner-published (#2631): public read + author-owned posts, with the owner controlling
  // the roster (requireRole("owner") only on the grant). A personal blog is the roster-of-one case
  // (author-owned + public, no explicit grant); a multi-author publication adds the roster grant.
  // The owner-only-content dead-end is no longer accepted.
  const ownerPublished = publicRead && authorCheckCreate && !ownerOnlyContent;
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
    isOwnerToken,
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
    authorRosterGrant,
    ownerOnlyContent,
    ownerPublished,
    publicRead,
    authorOwned,
  };
}
