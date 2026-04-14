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

export const sqlUserSlugBinding = pgTable(
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
  ]
);

export const sqlAppSlugBinding = pgTable(
  "AppSlugBindings",
  {
    userSlug: text().notNull(),
    appSlug: text().notNull(), // human friendly app id
    ledger: text().notNull(), // cryptograhic Id
    created: text().notNull(),
    updated: text(),
  },
  (table) => [
    primaryKey({ columns: [table.appSlug, table.userSlug] }),
    // uniqueIndex("AppSlug_ledger_idx").on(table.ledger)
  ]
);

export const sqlApps = pgTable(
  "Apps",
  {
    appSlug: text().notNull(), // human friendly app id
    userId: text().notNull(),
    userSlug: text().notNull(),
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
  ]
);

export const sqlChatContexts = pgTable("ChatContexts", {
  chatId: text().notNull().primaryKey(), // uuid v4
  userId: text().notNull(),
  appSlug: text().notNull(),
  userSlug: text().notNull(),
  created: text().notNull(),
});

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
    userSlug: text().notNull(), // reverenced from the calling Page
    chatId: text().notNull(), // uuid v4
    blocks: jsonb().notNull(),
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
    userSlug: text().notNull(),
    settings: jsonb().notNull(), // AclEntry.or(ActiveAclEntries)[]
    updated: text().notNull(),
    created: text().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.appSlug, table.userSlug] })]
);

export const sqlRequestGrants = pgTable(
  "RequestGrants",
  {
    userId: text().notNull(), // from Clerk
    appSlug: text().notNull(),
    userSlug: text().notNull(),
    state: text().notNull(), // 'pending' | 'approved' | 'rejected'
    role: text(), // 'editor' | 'viewer'
    foreignUserId: text().notNull(), // sanitized email for grant
    foreignInfo: jsonb().notNull(),
    tick: numeric().notNull(), // counts the use of the grant
    updated: text().notNull(),
    created: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.appSlug, table.userSlug, table.foreignUserId] }),
    index("RequestGrants_cursor").on(table.created),
    index("RequestGrants_foreignUserId_idx").on(table.foreignUserId),
  ]
);

export const sqlInviteGrants = pgTable(
  "InviteGrants",
  {
    userId: text().notNull(), // from Clerk
    appSlug: text().notNull(),
    userSlug: text().notNull(),
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
    primaryKey({ columns: [table.userId, table.appSlug, table.userSlug, table.emailKey] }),
    index("InviteGrants_cursor").on(table.created),
    index("InviteGrants_tokenOrGrantUserId_idx").on(table.tokenOrGrantUserId),
  ]
);
