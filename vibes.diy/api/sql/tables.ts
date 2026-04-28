import * as sqlite from "./vibes-diy-api-schema-sqlite.js";
import * as pg from "./vibes-diy-api-schema-pg.js";
import { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { ResultSet } from "@libsql/client";
import type { D1Result } from "@cloudflare/workers-types";
import { type } from "arktype";

export type VibesSqlite = BaseSQLiteDatabase<"async", ResultSet | D1Result, Record<string, never>>;

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
    appDocuments: sqlite.sqlAppDocuments,
    appDbPolicies: sqlite.sqlAppDbPolicies,
  };
}

export type VibesApiTables = ReturnType<typeof createSqliteVibesApiTables>;

export const DBFlavour = type("'sqlite' | 'pg'");
export type DBFlavour = typeof DBFlavour.infer;
export function toDBFlavour(flavour: unknown): DBFlavour {
  const res = DBFlavour(flavour);
  if (res instanceof type.errors) {
    return "sqlite";
  }
  return res;
}

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
      appDocuments: pg.sqlAppDocuments,
      appDbPolicies: pg.sqlAppDbPolicies,
    } as unknown as VibesApiTables;
  }
  return createSqliteVibesApiTables();
}
