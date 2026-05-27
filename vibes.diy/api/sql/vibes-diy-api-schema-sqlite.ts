import { PromptAndBlockMsgs } from "@vibes.diy/api-types";
import { int, sqliteTable, text, blob, primaryKey, uniqueIndex, index, numeric } from "drizzle-orm/sqlite-core";

// could be put on R2
export const sqlAssets = sqliteTable("Assets", {
  assetId: text().primaryKey(), // sql://Assets.assetId (CID of content)
  content: blob().notNull(), // actual code content
  created: text().notNull(),
});

export const sqlUserSlugBinding = sqliteTable(
  "UserSlugBindings",
  {
    userId: text().notNull(), // max bindings per userId
    userSlug: text().notNull(),
    tenant: text().notNull(), // cryptograhic Id
    created: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userSlug, table.userId] }),
    // uniqueIndex("UserSlug_tenant").on(table.tenant),
    uniqueIndex("UserSlug_userSlug").on(table.userSlug),
    index("UserSlug_userId_userSlug").on(table.userId, table.userSlug),
  ]
);

export const sqlAppSlugBinding = sqliteTable(
  "AppSlugBindings",
  {
    userSlug: text().notNull(),
    //.references(() => sqlUserSlugBinding.userSlug), // max bindings per userId
    appSlug: text().notNull(), // human friendly app id
    ledger: text().notNull(), // cryptograhic Id
    created: text().notNull(),
    // Bumped on every chat turn (drives recent-vibes ordering, see PR for the
    // consumer). Default lets drizzle-kit push add this column on populated
    // tables in one statement: SQLite fills existing rows with the sentinel
    // and new code writes the real timestamp explicitly. Keeps every env
    // (prod, dev, preview, cli) convergent under the standard schema-push flow.
    updated: text().notNull().default("1970-01-01T00:00:00.000Z"),
    // Empty = unpinned, ISO timestamp = pinned. Value also acts as the
    // sort key (newest pin first) when multiple rows are pinned.
    pinnedAt: text().notNull().default(""),
  },
  (table) => [
    primaryKey({ columns: [table.appSlug, table.userSlug] }),
    // updated is intentionally excluded: including it forces a non-HOT index update on every
    // bumpAppRecency call (every chat turn). list-recent-vibes already does a filesort; keeping
    // updated out of the index makes writes HOT-eligible without changing read correctness.
    index("AppSlug_userSlug_pinnedAt_appSlug").on(table.userSlug, table.pinnedAt, table.appSlug),
  ]
);

export const sqlApps = sqliteTable(
  "Apps",
  {
    appSlug: text().notNull(), // .references(() => sqlAppSlugBinding.appSlug), // human friendly app id
    userId: text().notNull(), // .references(() => sqlUserSlugBinding.userId),
    userSlug: text().notNull(), // .references(() => sqlAppSlugBinding.userSlug),
    releaseSeq: int().notNull(), // incremented on each publish
    // appId: text().notNull(), // FP app id
    fsId: text().notNull(), // CID of filenames+mimetypes+cid
    env: text({ mode: "json" }).notNull(), // serialized env key-values
    fileSystem: text({ mode: "json" }).notNull(), // [FileSystemItem]

    meta: text({ mode: "json" }).notNull(), // [MetaItem]

    mode: text().notNull(), // 'publish' | 'dev'
    created: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.appSlug, table.userId, table.releaseSeq] }),
    index("Apps_fsId").on(table.fsId, table.userId),
    index("created_idx").on(table.created),
  ]
);

export const sqlChatContexts = sqliteTable("ChatContexts", {
  chatId: text().notNull().primaryKey(), // uuid v4
  userId: text().notNull(),
  appSlug: text().notNull(),
  userSlug: text().notNull(),
  created: text().notNull(),
});

export const sqlChatSections = sqliteTable(
  "ChatSections",
  {
    chatId: text().notNull(),
    // .references(() => sqlChatContexts.chatId),
    promptId: text().notNull(), // uuid v4
    blockSeq: int().notNull(), // incremented per section
    // origin: text().notNull(), // 'user' | 'llm'
    // Array<{ type: 'origin.prompt' | 'block.xxx'}>
    blocks: text({ mode: "json" }).notNull(),
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
export const sqlPromptContexts = sqliteTable(
  "PromptContexts",
  {
    userId: text().notNull(),
    chatId: text().notNull(),
    promptId: text().notNull(),
    fsId: text(),
    nethash: text(),
    promptTokens: int().notNull(),
    completionTokens: int().notNull(),
    totalTokens: int().notNull(),
    ref: text({ mode: "json" }).notNull(), // BlockUsageSql
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

export const sqlApplicationChats = sqliteTable(
  "ApplicationChats",
  {
    userId: text().notNull(), // usally from Clerk
    appSlug: text().notNull(), // reverenced from the calling Page
    userSlug: text().notNull(), // reverenced from the calling Page
    chatId: text().notNull(), // uuid v4
    blocks: text({ mode: "json" }).notNull(),
    created: text().notNull(),
  },
  (table) => [
    uniqueIndex("ApplicationChats_chatId_idx").on(table.chatId),
    uniqueIndex("ApplicationChats_userId_chatIdidx").on(table.userId, table.chatId),
    primaryKey({ columns: [table.userId, table.appSlug, table.userSlug, table.chatId] }),
    // query for all chats of an app: appSlug + userSlug + created desc
    index("ApplicationChats_userId_appSlug_userSlug_created_idx").on(table.userId, table.appSlug, table.userSlug, table.created),
  ]
);

export const sqlUserSettings = sqliteTable("UserSettings", {
  userId: text().notNull().primaryKey(), // from Clerk
  settings: text({ mode: "json" }).notNull(), // UserSettingsData
  updated: text().notNull(),
  created: text().notNull(),
});

export const sqlAppSettings = sqliteTable(
  "AppSettings",
  {
    userId: text().notNull(), // from Clerk
    appSlug: text().notNull(),
    userSlug: text().notNull(),
    settings: text({ mode: "json" }).notNull(), // AclEntry.or(ActiveAclEntries)[]
    updated: text().notNull(),
    created: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.appSlug, table.userSlug] }),
    index("AppSettings_userSlug_appSlug_idx").on(table.userSlug, table.appSlug),
  ]
);

export const sqlRequestGrants = sqliteTable(
  "RequestGrants",
  {
    userId: text().notNull(), // from Clerk
    appSlug: text().notNull(),
    userSlug: text().notNull(),
    state: text().notNull(), // 'pending' | 'approved' | 'rejected'
    role: text(), // 'editor' | 'viewer'
    foreignUserId: text().notNull(), // sanitized email for grant
    foreignInfo: text({ mode: "json" }).notNull(),
    tick: numeric().notNull(), // no counts the use of the grant
    updated: text().notNull(),
    created: text().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.appSlug, table.userSlug, table.foreignUserId] })]
);

// Firefly — immutable append-only document store
export const sqlAppDocuments = sqliteTable(
  "AppDocuments",
  {
    userSlug: text().notNull().default("unknown"),
    appSlug: text().notNull(),
    dbName: text().notNull().default("default"), // database namespace within app
    docId: text().notNull(),
    seq: int().notNull(), // monotonic per (userSlug, appSlug, dbName, docId), starts at 1
    userId: text().notNull().default("unknown"), // authenticated user who made this change
    data: text({ mode: "json" }).notNull(), // document JSON
    deleted: int().notNull().default(0), // 1 = tombstone
    created: text().notNull(), // ISO timestamp of this revision
  },
  (table) => [primaryKey({ columns: [table.userSlug, table.appSlug, table.dbName, table.docId, table.seq] })]
);

export const sqlDirectChannelIndex = sqliteTable(
  "DirectChannelIndex",
  {
    userSlug: text().notNull(),
    channelUserSlug: text().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userSlug, table.channelUserSlug] })]
);

export const sqlDirectChannelReads = sqliteTable(
  "DirectChannelReads",
  {
    channelUserSlug: text().notNull(),
    userSlug: text().notNull(),
    lastSeenSeq: int().notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.channelUserSlug, table.userSlug] })]
);

export const sqlInviteGrants = sqliteTable(
  "InviteGrants",
  {
    userId: text().notNull(), // from Clerk
    appSlug: text().notNull(),
    userSlug: text().notNull(),
    state: text().notNull(), // 'pending' | 'accepted' | 'revoked'
    role: text().notNull(), // 'editor' | 'viewer'
    emailKey: text().notNull(), // sanitized email for grant
    tokenOrGrantUserId: text().notNull(), // sanitized email for grant
    foreignInfo: text({ mode: "json" }).notNull(), // { email: string }
    tick: numeric().notNull(), // no counts the use of the grant
    updated: text().notNull(),
    created: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.appSlug, table.userSlug, table.emailKey] }),
    index("tokenOrGrantUserId_idx").on(table.tokenOrGrantUserId),
  ]
);

// Per-doc file uploads — audit + lookup table for `_files` reads. One row
// per put-asset call. uploadId is the public handle the client puts into
// doc._files.<key>; the server resolves uploadId → assetURI at read time
// for vctx.storage.fetch. Bound to (userSlug, appSlug) at upload-grant time
// so a foreign uploadId pasted into another user's doc fails put-doc
// validation. size is recorded for future SUM-by-userSlug quota math.
export const sqlAssetUploads = sqliteTable(
  "AssetUploads",
  {
    uploadId: text().notNull().primaryKey(),
    userId: text().notNull(), // Clerk userId of the uploader
    userSlug: text().notNull(),
    appSlug: text().notNull(),
    cid: text().notNull(), // content hash (for dedup queries)
    assetURI: text().notNull(), // full storage URI for vctx.storage.fetch (e.g. s3://r2/<cid>, pg://Assets/<cid>)
    size: int().notNull(),
    mimeType: text(),
    created: text().notNull(),
  },
  (table) => [
    index("AssetUploads_app_idx").on(table.userSlug, table.appSlug, table.created),
    index("AssetUploads_user_idx").on(table.userId, table.created),
    index("AssetUploads_cid_idx").on(table.cid),
  ]
);

// Referrer attribution events — written by ETL from Logpush NDJSON.
// Empty in dev/SQLite; populated in prod/Neon by the logpush-etl cron worker.
export const sqlRefererEvents = sqliteTable("RefererEvents", {
  logKey: text().notNull(),
  lineIdx: int().notNull(),
  ts: text().notNull(),
  refHref: text().notNull(),
  refHost: text().notNull(),
  refPath: text().notNull(),
  reqMethod: text().notNull(),
  reqPath: text().notNull(),
});

// Missing vibe 404 events — written by ETL from Logpush NDJSON.
// Empty in dev/SQLite; populated in prod/Neon by the logpush-etl cron worker.
export const sqlMissingVibeEvents = sqliteTable("MissingVibeEvents", {
  logKey: text().notNull(),
  lineIdx: int().notNull(),
  ts: text().notNull(),
  reqPath: text().notNull(),
});
