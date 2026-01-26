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
  contextId: text().notNull().primaryKey(), // uuid v4
  userId: text().notNull(),
  created: text().notNull(),
});

export const sqlChatSections = sqliteTable(
  "ChatSections",
  {
    contextId: text()
      .notNull()
      .references(() => sqlChatContexts.contextId),
    seq: int().notNull(), // incremented per section
    origin: text().notNull(), // 'user' | 'llm'
    // Array<{ type: 'origin.prompt' | 'block.xxx'}>
    blocks: text({ mode: "json" }).notNull(),
    created: text().notNull(),
  },
  (table) => [primaryKey({ columns: [table.seq, table.contextId] })]
);

export const sqlUserProfiles = sqliteTable("UserProfiles", {
  userSlug: text()
    .primaryKey()
    .references(() => sqlUserSlugBinding.userSlug),
  profile: text({ mode: "json" }).notNull(), // { type: 'user', name: '...', url?: '...' }
  created: text().notNull(),
  updated: text().notNull(),
});
