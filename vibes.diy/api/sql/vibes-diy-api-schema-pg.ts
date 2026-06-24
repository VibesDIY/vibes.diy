import { PromptAndBlockMsgs } from "@vibes.diy/api-types";
import { integer, pgTable, text, jsonb, primaryKey, uniqueIndex, index, customType, numeric } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Uint8Array }>({
  dataType() {
    return "bytea";
  },
});

// could be put on R2
export const sqlAssets = pgTable("Assets", {
  assetId: text().primaryKey(), // sql://Assets.assetId (CID of content)
  content: bytea().notNull(), // actual code content
  created: text().notNull(),
});

export const sqlHandleBinding = pgTable(
  "UserSlugBindings",
  {
    userId: text().notNull(), // max bindings per userId
    handle: text("userSlug").notNull(),
    tenant: text().notNull(), // cryptograhic Id
    created: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.handle, table.userId] }),
    // uniqueIndex("UserSlug_tenant").on(table.tenant),
    uniqueIndex("UserSlug_ownerHandle").on(table.handle),
    index("UserSlug_userId_ownerHandle").on(table.userId, table.handle),
  ]
);

export const sqlAppSlugBinding = pgTable(
  "AppSlugBindings",
  {
    ownerHandle: text("userSlug").notNull(),
    appSlug: text().notNull(), // human friendly app id
    ledger: text().notNull(), // cryptograhic Id
    created: text().notNull(),
    // Bumped on every chat turn (drives recent-vibes ordering, see PR for the
    // consumer). Default lets drizzle-kit push add this column on populated
    // tables in one statement: PG fills existing rows with the sentinel and
    // new code writes the real timestamp explicitly. Keeps every env (prod,
    // dev, preview, cli) convergent under the standard schema-push flow.
    updated: text().notNull().default("1970-01-01T00:00:00.000Z"),
    // Empty = unpinned, ISO timestamp = pinned. Value also acts as the
    // sort key (newest pin first) when multiple rows are pinned.
    pinnedAt: text().notNull().default(""),
  },
  (table) => [
    primaryKey({ columns: [table.appSlug, table.ownerHandle] }),
    // updated is intentionally excluded: including it forces a non-HOT index update on every
    // bumpAppRecency call (every chat turn). list-recent-vibes already does a filesort; keeping
    // updated out of the index makes writes HOT-eligible without changing read correctness.
    index("AppSlug_ownerHandle_pinnedAt_appSlug").on(table.ownerHandle, table.pinnedAt, table.appSlug),
  ]
);

export const sqlApps = pgTable(
  "Apps",
  {
    appSlug: text().notNull(), // human friendly app id
    userId: text().notNull(),
    ownerHandle: text("userSlug").notNull(),
    releaseSeq: integer().notNull(), // incremented on each publish
    // appId: text().notNull(), // FP app id
    fsId: text().notNull(), // CID of filenames+mimetypes+cid
    env: jsonb().notNull(), // serialized env key-values
    fileSystem: jsonb().notNull(), // [FileSystemItem]
    meta: jsonb().notNull(), // [MetaItem]
    mode: text().notNull(), // 'publish' | 'dev'
    created: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.appSlug, table.userId, table.releaseSeq] }),
    index("Apps_fsId").on(table.fsId, table.userId),
    index("created_idx").on(table.created),
    // C3: checkMaxAppsPerUser scans a user's apps on every append-turn write.
    // PK leads with appSlug, so WHERE userId can't use it. Validated: collapses
    // an 89-buffer full-index scan to a 3-buffer index scan (0.5ms -> 0.04ms).
    index("Apps_userId_created").on(table.userId, table.created),
  ]
);

export const sqlChatContexts = pgTable(
  "ChatContexts",
  {
    chatId: text().notNull().primaryKey(), // uuid v4
    userId: text().notNull(),
    appSlug: text().notNull(),
    ownerHandle: text("userSlug").notNull(),
    created: text().notNull(),
  },
  (table) => [
    // C4: chat-id resolution filters (userId, userSlug, appSlug) but the only
    // index was the chatId PK -> seq scan. Validated: 55-buffer seq scan ->
    // 3-buffer index scan (0.29ms -> 0.03ms), and scale-flat as the table grows.
    index("ChatContexts_userId_userSlug_appSlug").on(table.userId, table.ownerHandle, table.appSlug),
  ]
);

export const sqlChatSections = pgTable(
  "ChatSections",
  {
    chatId: text().notNull(),
    promptId: text().notNull(), // uuid v4
    blockSeq: integer().notNull(), // incremented per section
    // Array<{ type: 'origin.prompt' | 'block.xxx'}>
    blocks: jsonb().notNull(),
    created: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.chatId, table.promptId, table.blockSeq] }),
    uniqueIndex("ChatSections_created_promptId_blockSeq_idx").on(table.created, table.promptId, table.blockSeq),
    index("ChatSections_chatId_idx").on(table.chatId),
  ]
);

type _SqlChatSection = typeof sqlChatSections.$inferInsert;
export interface SqlChatSection extends _SqlChatSection {
  blocks: PromptAndBlockMsgs[];
}

// maps to ChatContextSql
export const sqlPromptContexts = pgTable(
  "PromptContexts",
  {
    userId: text().notNull(),
    chatId: text().notNull(),
    promptId: text().notNull(),
    fsId: text(),
    nethash: text(),
    promptTokens: integer().notNull(),
    completionTokens: integer().notNull(),
    totalTokens: integer().notNull(),
    ref: jsonb().notNull(), // BlockUsageSql
    created: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.chatId, table.promptId] }),
    index("PromptContext_chatId_idx").on(table.chatId),
    uniqueIndex("PromptContext_promptId_idx").on(table.promptId),
    index("PromptContext_created_idx").on(table.created),
    index("PromptContext_nethash_idx").on(table.nethash),
  ]
);

export const sqlApplicationChats = pgTable(
  "ApplicationChats",
  {
    userId: text().notNull(), // usally from Clerk
    appSlug: text().notNull(), // reverenced from the calling Page
    ownerHandle: text("userSlug").notNull(), // reverenced from the calling Page
    chatId: text().notNull(), // uuid v4
    blocks: jsonb().notNull(),
    created: text().notNull(),
  },
  (table) => [
    uniqueIndex("ApplicationChats_chatId_idx").on(table.chatId),
    uniqueIndex("ApplicationChats_userId_chatIdidx").on(table.userId, table.chatId),
    primaryKey({ columns: [table.userId, table.appSlug, table.ownerHandle, table.chatId] }),
    // query for all chats of an app: appSlug + ownerHandle + created desc
    index("ApplicationChats_userId_appSlug_ownerHandle_created_idx").on(
      table.userId,
      table.appSlug,
      table.ownerHandle,
      table.created
    ),
  ]
);

export const sqlUserSettings = pgTable("UserSettings", {
  userId: text().notNull().primaryKey(), // from Clerk
  settings: jsonb().notNull(), // UserSettingsData
  updated: text().notNull(),
  created: text().notNull(),
});

export const sqlAppSettings = pgTable(
  "AppSettings",
  {
    userId: text().notNull(), // from Clerk
    appSlug: text().notNull(),
    ownerHandle: text("userSlug").notNull(),
    settings: jsonb().notNull(), // AclEntry.or(ActiveAclEntries)[]
    updated: text().notNull(),
    created: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.appSlug, table.ownerHandle] }),
    // Supports queries by (ownerHandle, appSlug) without userId — e.g. getModelDefaults, loadActiveSettings.
    // PK is (userId, appSlug, ownerHandle) so those queries do a partial index scan (cost ~126)
    // without this secondary index.
    index("AppSettings_ownerHandle_appSlug_idx").on(table.ownerHandle, table.appSlug),
  ]
);

// Per-handle settings (currently just the avatar). Keyed by `handle` so each
// handle a user owns has its own row — the privacy invariant requires that two
// handles of the same user never share avatar bytes. `userId` is the owner, for
// write-time ownership checks and handle delete/rename lifecycle.
// See docs/superpowers/specs/2026-06-18-per-handle-avatar-design.md.
export const sqlHandleSettings = pgTable(
  "HandleSettings",
  {
    handle: text().notNull(),
    userId: text().notNull(), // from Clerk
    settings: jsonb().notNull(), // ActiveEntry[] (e.g. active.avatar)
    updated: text().notNull(),
    created: text().notNull(),
  },
  (table) => [primaryKey({ columns: [table.handle] }), index("HandleSettings_userId_idx").on(table.userId)]
);

export const sqlRequestGrants = pgTable(
  "RequestGrants",
  {
    userId: text().notNull(), // from Clerk
    appSlug: text().notNull(),
    ownerHandle: text("userSlug").notNull(),
    state: text().notNull(), // 'pending' | 'approved' | 'rejected'
    role: text(), // 'editor' | 'viewer'
    foreignUserId: text().notNull(), // sanitized email for grant
    foreignInfo: jsonb().notNull(),
    tick: numeric().notNull(), // counts the use of the grant
    updated: text().notNull(),
    created: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.appSlug, table.ownerHandle, table.foreignUserId] }),
    index("RequestGrants_cursor").on(table.created),
    index("RequestGrants_foreignUserId_idx").on(table.foreignUserId),
  ]
);

// Firefly — immutable append-only document store
export const sqlAppDocuments = pgTable(
  "AppDocuments",
  {
    ownerHandle: text("userSlug").notNull().default("unknown"),
    appSlug: text().notNull(),
    dbName: text().notNull().default("default"), // database namespace within app
    docId: text().notNull(),
    seq: integer().notNull(), // monotonic per (ownerHandle, appSlug, dbName, docId), starts at 1
    userId: text().notNull().default("unknown"), // authenticated user who made this change
    data: jsonb().notNull(), // document JSON
    deleted: integer().notNull().default(0), // 1 = tombstone
    created: text().notNull(), // ISO timestamp of this revision
  },
  (table) => [
    primaryKey({ columns: [table.ownerHandle, table.appSlug, table.dbName, table.docId, table.seq] }),
    // C8: membership list reads MAX(created) per (userSlug, appSlug) FOR A GIVEN
    // userId. Postgres can't loose-scan a GROUP BY, so the list query issues one
    // bare scalar MAX() per pair (see list-memberships.ts). userId is part of the
    // predicate and must lead `created` in the index, otherwise a member who
    // isn't the latest writer (or never wrote) makes Postgres scan the whole
    // owner/app range filtering userId row-by-row (measured: 25ms / 32k buffers
    // on a 53k-row shared app). With userId before created it's a full-equality
    // prefix + ordered created -> single Index Scan Backward probe (0.04ms).
    index("AppDocuments_userSlug_appSlug_userId_created").on(table.ownerHandle, table.appSlug, table.userId, table.created),
  ]
);

export const sqlDirectChannelIndex = pgTable(
  "DirectChannelIndex",
  {
    handle: text("userSlug").notNull(),
    channelHandle: text("channelUserSlug").notNull(),
  },
  (table) => [primaryKey({ columns: [table.handle, table.channelHandle] })]
);

export const sqlDirectChannelReads = pgTable(
  "DirectChannelReads",
  {
    channelHandle: text("channelUserSlug").notNull(),
    handle: text("userSlug").notNull(),
    lastSeenSeq: integer().notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.channelHandle, table.handle] })]
);

export const sqlInviteGrants = pgTable(
  "InviteGrants",
  {
    userId: text().notNull(), // from Clerk
    appSlug: text().notNull(),
    ownerHandle: text("userSlug").notNull(),
    state: text().notNull(), // 'pending' | 'accepted' | 'revoked'
    role: text().notNull(), // 'editor' | 'viewer'
    emailKey: text().notNull(), // sanitized email for grant
    tokenOrGrantUserId: text().notNull(),
    foreignInfo: jsonb().notNull(), // { email: string }
    tick: numeric().notNull(), // counts the use of the grant
    updated: text().notNull(),
    created: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.appSlug, table.ownerHandle, table.emailKey] }),
    index("InviteGrants_cursor").on(table.created),
    index("InviteGrants_tokenOrGrantUserId_idx").on(table.tokenOrGrantUserId),
  ]
);

export const sqlRefererEvents = pgTable(
  "RefererEvents",
  {
    logKey: text().notNull(), // R2 object key (Logpush filename), part of dedup PK
    lineIdx: integer().notNull(), // line index within the R2 object, part of dedup PK
    ts: text().notNull(), // ISO timestamp from Logpush envelope
    refHref: text().notNull(), // full referring URL (https://example.com/page)
    refHost: text().notNull(), // hostname only (example.com)
    refPath: text().notNull(), // path only (/page)
    reqMethod: text().notNull(), // HTTP method of the incoming request
    reqPath: text().notNull(), // path of the incoming request
  },
  (table) => [
    primaryKey({ columns: [table.logKey, table.lineIdx] }),
    index("RefererEvents_refHost_ts_idx").on(table.refHost, table.ts),
    index("RefererEvents_reqPath_ts_idx").on(table.reqPath, table.ts),
    index("RefererEvents_ts_idx").on(table.ts),
  ]
);

export const sqlMissingVibeEvents = pgTable(
  "MissingVibeEvents",
  {
    logKey: text().notNull(), // R2 object key (Logpush filename), part of dedup PK
    lineIdx: integer().notNull(), // line index within the R2 object, part of dedup PK
    ts: text().notNull(), // ISO timestamp from Logpush envelope
    reqPath: text().notNull(), // /vibe/<user>/<slug> path that returned 404
  },
  (table) => [
    primaryKey({ columns: [table.logKey, table.lineIdx] }),
    index("MissingVibeEvents_reqPath_ts_idx").on(table.reqPath, table.ts),
    index("MissingVibeEvents_ts_idx").on(table.ts),
  ]
);

// Direct-to-app landing events — written by ETL from Logpush NDJSON ([landing] lines).
// Captures the request-URL fbclid + utm_campaign for /vibe/* ad landings (no second hop).
// Keep in sync with sqlLandingEvents in vibes-diy-api-schema-sqlite.ts and the inline
// landingEvents table in api/logpush-etl/worker.ts.
export const sqlLandingEvents = pgTable(
  "LandingEvents",
  {
    logKey: text().notNull(), // R2 object key (Logpush filename), part of dedup PK
    lineIdx: integer().notNull(), // line index within the R2 object, part of dedup PK
    ts: text().notNull(), // ISO timestamp from Logpush envelope
    landHref: text().notNull(), // full landing URL, query intact (audit/debug source)
    landHost: text().notNull(), // hostname only (vibes.diy)
    landPath: text().notNull(), // path only (/vibe/<owner>/<slug>)
    fbclid: text().notNull(), // parsed from landHref; report join column (always present)
    utmCampaign: text().notNull(), // parsed from landHref; "" when absent; report join column
    ua: text().notNull(), // raw User-Agent for future bot/prefetch auditing (unused in v1)
  },
  (table) => [
    primaryKey({ columns: [table.logKey, table.lineIdx] }),
    index("LandingEvents_utmCampaign_ts_idx").on(table.utmCampaign, table.ts),
    index("LandingEvents_ts_idx").on(table.ts),
  ]
);

// Per-doc file uploads — audit + lookup table for `_files` reads. One row
// per put-asset call. uploadId is the public handle the client puts into
// doc._files.<key>; the server resolves uploadId → assetURI at read time
// for vctx.storage.fetch. Bound to (ownerHandle, appSlug) at upload-grant time
// so a foreign uploadId pasted into another user's doc fails put-doc
// validation. size is recorded for future SUM-by-ownerHandle quota math.
export const sqlAssetUploads = pgTable(
  "AssetUploads",
  {
    uploadId: text().notNull().primaryKey(),
    userId: text().notNull(), // Clerk userId of the uploader
    ownerHandle: text("userSlug").notNull(),
    appSlug: text().notNull(),
    cid: text().notNull(), // content hash (for dedup queries)
    assetURI: text().notNull(), // full storage URI for vctx.storage.fetch (e.g. s3://r2/<cid>, pg://Assets/<cid>)
    size: integer().notNull(),
    mimeType: text(),
    created: text().notNull(),
  },
  (table) => [
    index("AssetUploads_app_idx").on(table.ownerHandle, table.appSlug, table.created),
    index("AssetUploads_user_idx").on(table.userId, table.created),
    index("AssetUploads_cid_idx").on(table.cid),
  ]
);

// Per-vibe access function binding: maps (ownerHandle, appSlug, dbName) to a CID in Assets.
// dbName = '*' means the access function applies to all databases for this app.
// CID-keyed so changing access.js produces a new entry with no cache invalidation step.
export const sqlAccessFunctionBindings = pgTable(
  "AccessFunctionBindings",
  {
    ownerHandle: text("userSlug").notNull(),
    appSlug: text().notNull(),
    dbName: text().notNull(),
    accessFnCid: text().notNull(),
    accessFnAssetUri: text(), // nullable — full storage URI, e.g. s3://r2/<cid> or pg://Assets/<cid>
    updated: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerHandle, table.appSlug, table.dbName] }),
    index("AccessFunctionBindings_app_idx").on(table.ownerHandle, table.appSlug),
  ]
);

// Unified notification inbox — durable, self-contained rows. Mirrors
// sqlNotifications in vibes-diy-api-schema-sqlite.ts exactly (same table name,
// column names, index names); only `targetRef` differs in storage type
// (jsonb here vs text json-mode on sqlite).
// See docs/superpowers/specs/2026-06-23-notification-inbox-design.md.
export const sqlNotifications = pgTable(
  "Notifications",
  {
    id: text().notNull().primaryKey(), // ULID — sortable by creation
    userId: text().notNull(), // recipient (Clerk id)
    notificationType: text().notNull(),
    ownerHandle: text("userSlug").notNull(), // subject vibe owner
    appSlug: text().notNull(), // subject vibe
    body: text().notNull(), // self-contained rendered message
    actorHandle: text(), // who caused it (nullable)
    actorUserId: text(), // actor Clerk id (nullable)
    targetRef: jsonb(), // optional link payload (nullable)
    dedupeKey: text().notNull(), // idempotency key
    created: text().notNull(), // ISO timestamp
    readAt: text(), // unread when null
  },
  (table) => [
    index("Notifications_userId_created").on(table.userId, table.created),
    index("Notifications_userId_readAt").on(table.userId, table.readAt),
    index("Notifications_userId_ownerHandle_appSlug").on(table.userId, table.ownerHandle, table.appSlug),
    uniqueIndex("Notifications_userId_dedupeKey").on(table.userId, table.dedupeKey),
  ]
);

export const sqlAccessFnOutputs = pgTable(
  "AccessFnOutputs",
  {
    ownerHandle: text("userSlug").notNull(),
    appSlug: text().notNull(),
    dbName: text().notNull(),
    docId: text().notNull(),
    fnCid: text().notNull(),
    output: text().notNull(),
    hasGrants: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerHandle, table.appSlug, table.dbName, table.docId] }),
    index("AccessFnOutputs_grants_idx").on(table.ownerHandle, table.appSlug, table.dbName, table.fnCid),
  ]
);
