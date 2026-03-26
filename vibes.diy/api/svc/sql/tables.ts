import * as sqlite from "./vibes-diy-api-schema-sqlite.js";
import * as pg from "./vibes-diy-api-schema-pg.js";

function createSqliteVibesApiTables() {
  return {
    assets: sqlite.sqlAssets,
    userSlugBinding: sqlite.sqlUserSlugBinding,
    appSlugBinding: sqlite.sqlAppSlugBinding,
    apps: sqlite.sqlApps,
    chatContexts: sqlite.sqlChatContexts,
    chatSections: sqlite.sqlChatSections,
    promptContexts: sqlite.sqlPromptContexts,
    applicationChats: sqlite.sqlApplicationChats,
    userSettings: sqlite.sqlUserSettings,
    appSettings: sqlite.sqlAppSettings,
    requestGrants: sqlite.sqlRequestGrants,
    inviteGrants: sqlite.sqlInviteGrants,
  };
}

export type VibesApiTables = ReturnType<typeof createSqliteVibesApiTables>;

export type DBFlavour = "sqlite" | "pg";

export function createVibesApiTables(flavour: DBFlavour): VibesApiTables {
  if (flavour === "pg") {
    return {
      assets: pg.sqlAssets,
      userSlugBinding: pg.sqlUserSlugBinding,
      appSlugBinding: pg.sqlAppSlugBinding,
      apps: pg.sqlApps,
      chatContexts: pg.sqlChatContexts,
      chatSections: pg.sqlChatSections,
      promptContexts: pg.sqlPromptContexts,
      applicationChats: pg.sqlApplicationChats,
      userSettings: pg.sqlUserSettings,
      appSettings: pg.sqlAppSettings,
      requestGrants: pg.sqlRequestGrants,
      inviteGrants: pg.sqlInviteGrants,
    } as unknown as VibesApiTables;
  }
  return createSqliteVibesApiTables();
}
