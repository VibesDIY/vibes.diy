import { PromptAndBlockMsgs } from "@vibes.diy/api-types";
import { int, sqliteTable, text, blob, primaryKey, uniqueIndex, index } from "drizzle-orm/sqlite-core";

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
    created: text().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userSlug, table.userId] }), uniqueIndex("UserSlug_userSlug").on(table.userSlug)]
);

export const sqlAppSlugBinding = sqliteTable(
  "AppSlugBindings",
  {
    userSlug: text()
      .notNull()
      .references(() => sqlUserSlugBinding.userSlug), // max bindings per userId
    appSlug: text().notNull(), // human friendly app id
    created: text().notNull(),
  },
  (table) => [primaryKey({ columns: [table.appSlug, table.userSlug] })]
);

export const sqlApps = sqliteTable(
  "Apps",
  {
    appSlug: text().notNull(), // .references(() => sqlAppSlugBinding.appSlug), // human friendly app id
    userId: text().notNull(), // .references(() => sqlUserSlugBinding.userId),
    userSlug: text().notNull(), // .references(() => sqlAppSlugBinding.userSlug),
    releaseSeq: int().notNull(), // incremented on each publish
    // appId: text().notNull(), // FP app id
    fsId: text().notNull(), //CID of filenames+mimetypes+cid
    env: text({ mode: "json" }).notNull(), // serialized env key-values
    fileSystem: text({ mode: "json" }).notNull(), // [FileSystemItem]
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
    chatId: text()
      .notNull()
      .references(() => sqlChatContexts.chatId),
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
