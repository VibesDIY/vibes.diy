import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Result } from "@adviser/cement";
import { renderHtmlReport } from "./inspect-db-report-template.jsx";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { count, countDistinct, eq, lte, desc, asc, and, sql } from "drizzle-orm";
import { pg } from "@vibes.diy/api-sql";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(scriptDir, "../dist/inspect-db-report");

function loadDevVars(): void {
  const candidatePaths = [path.join(scriptDir, "..", ".dev.vars"), path.join(process.cwd(), ".dev.vars")];

  for (const candidatePath of candidatePaths) {
    if (!fs.existsSync(candidatePath)) {
      continue;
    }

    const content = fs.readFileSync(candidatePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (line === "" || line.startsWith("#")) {
        continue;
      }
      const separator = line.indexOf("=");
      if (separator <= 0) {
        continue;
      }
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
}

function flattenValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function toCsv(rows: readonly Record<string, unknown>[]): string {
  const keys = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  );

  const escapeCell = (value: unknown): string => {
    const text = flattenValue(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  };

  const lines = [keys.join(",")];
  for (const row of rows) {
    lines.push(keys.map((key) => escapeCell(row[key])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function writeCsv(name: string, rows: readonly Record<string, unknown>[]): string {
  const outPath = path.join(outDir, name);
  fs.writeFileSync(outPath, toCsv(rows), "utf8");
  return outPath;
}

function last30Days(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

// All schema tables for row counting
const schemaTableMap = {
  "public.Assets": pg.sqlAssets,
  "public.UserSlugBindings": pg.sqlUserSlugBinding,
  "public.AppSlugBindings": pg.sqlAppSlugBinding,
  "public.Apps": pg.sqlApps,
  "public.ChatContexts": pg.sqlChatContexts,
  "public.ChatSections": pg.sqlChatSections,
  "public.PromptContexts": pg.sqlPromptContexts,
  "public.ApplicationChats": pg.sqlApplicationChats,
  "public.UserSettings": pg.sqlUserSettings,
  "public.AppSettings": pg.sqlAppSettings,
  "public.RequestGrants": pg.sqlRequestGrants,
  "public.InviteGrants": pg.sqlInviteGrants,
} as const;

async function main(): Promise<Result<void>> {
  loadDevVars();

  const connectionString = process.env["NEON_DATABASE_URL"] ?? process.env["DATABASE_URL"];
  if (!connectionString) {
    return Result.Err("NEON_DATABASE_URL or DATABASE_URL is required");
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  fs.mkdirSync(outDir, { recursive: true });

  // Database info — system catalog functions have no schema table equivalent
  const infoRows = await db
    .select({
      db: sql<string>`current_database()`,
      schema: sql<string>`current_schema()`,
      usr: sql<string>`current_user`,
      addr: sql<string>`coalesce(inet_server_addr()::text, '')`,
      port: sql<number>`coalesce(inet_server_port(), 0)`,
    })
    .from(pg.sqlAssets)
    .limit(1);
  // Fallback if Assets is empty
  const infoRow = infoRows[0] ?? { db: "", schema: "", usr: "", addr: "", port: 0 };
  const info = {
    database: infoRow.db,
    current_schema: infoRow.schema,
    current_user: infoRow.usr,
    server_addr: infoRow.addr,
    server_port: infoRow.port,
    schemas: ["public"],
  };

  // Table counts via Drizzle schema tables
  const tableCounts: { table: string; rowCount: number }[] = [];
  for (const [name, table] of Object.entries(schemaTableMap)) {
    const result = await db.select({ rowCount: count() }).from(table);
    tableCounts.push({ table: name, rowCount: result[0]?.rowCount ?? 0 });
  }

  // Membership summary
  const membershipSummaryRows = await db
    .select({
      membership_count: count(),
      shared_app_count: sql<number>`count(distinct (${pg.sqlRequestGrants.userSlug}, ${pg.sqlRequestGrants.appSlug}))::int`,
      distinct_member_count: countDistinct(pg.sqlRequestGrants.foreignUserId),
    })
    .from(pg.sqlRequestGrants)
    .where(eq(pg.sqlRequestGrants.state, "approved"));
  const membershipSummary = membershipSummaryRows[0] ?? { membership_count: 0, shared_app_count: 0, distinct_member_count: 0 };

  // Memberships by app
  const membershipsByApp = await db
    .select({
      owner_user_id: pg.sqlRequestGrants.userId,
      userSlug: pg.sqlRequestGrants.userSlug,
      appSlug: pg.sqlRequestGrants.appSlug,
      memberships: countDistinct(pg.sqlRequestGrants.foreignUserId),
    })
    .from(pg.sqlRequestGrants)
    .where(eq(pg.sqlRequestGrants.state, "approved"))
    .groupBy(pg.sqlRequestGrants.userId, pg.sqlRequestGrants.userSlug, pg.sqlRequestGrants.appSlug)
    .orderBy(
      desc(countDistinct(pg.sqlRequestGrants.foreignUserId)),
      asc(pg.sqlRequestGrants.userSlug),
      asc(pg.sqlRequestGrants.appSlug)
    )
    .limit(200);

  // Timeseries: compute cumulative counts per day using Drizzle queries
  const days = last30Days();

  // Membership timeseries — cumulative approved RequestGrants per day
  const membershipTimeseries: { day: string; membership_count: number }[] = [];
  for (const day of days) {
    const dayEnd = `${day}T23:59:59.999Z`;
    const result = await db
      .select({ cnt: count() })
      .from(pg.sqlRequestGrants)
      .where(and(eq(pg.sqlRequestGrants.state, "approved"), lte(pg.sqlRequestGrants.created, dayEnd)));
    membershipTimeseries.push({ day, membership_count: result[0]?.cnt ?? 0 });
  }

  // New membership slugs per day (for hover tooltips on the memberships chart)
  const firstDay = days[0] ?? "";
  const lastDay = days[days.length - 1] ?? "";
  const newMembershipRows = await db
    .select({
      created: pg.sqlRequestGrants.created,
      foreignUserId: pg.sqlRequestGrants.foreignUserId,
      memberSlug: pg.sqlUserSlugBinding.userSlug,
    })
    .from(pg.sqlRequestGrants)
    .leftJoin(pg.sqlUserSlugBinding, eq(pg.sqlRequestGrants.foreignUserId, pg.sqlUserSlugBinding.userId))
    .where(and(eq(pg.sqlRequestGrants.state, "approved"), lte(pg.sqlRequestGrants.created, `${lastDay}T23:59:59.999Z`)))
    .orderBy(asc(pg.sqlRequestGrants.created));

  // Build a map of day -> new slugs that joined on that specific day
  const newMemberSlugsByDay = new Map<string, string[]>();
  for (const row of newMembershipRows) {
    const day = row.created.slice(0, 10);
    if (day < firstDay) continue;
    const slug = row.memberSlug ?? row.foreignUserId;
    const arr = newMemberSlugsByDay.get(day) ?? [];
    if (!arr.includes(slug)) arr.push(slug);
    newMemberSlugsByDay.set(day, arr);
  }
  const membershipSlugsByDay = days.map((day) => ({ day, slugs: newMemberSlugsByDay.get(day) ?? [] }));

  // Active vibes timeseries — cumulative distinct userSlug+appSlug in AppSlugBindings per day
  const activeVibesTimeseries: { day: string; active_vibes_count: number }[] = [];
  for (const day of days) {
    const dayEnd = `${day}T23:59:59.999Z`;
    const result = await db
      .select({ cnt: sql<number>`count(distinct (${pg.sqlAppSlugBinding.userSlug}, ${pg.sqlAppSlugBinding.appSlug}))::int` })
      .from(pg.sqlAppSlugBinding)
      .where(lte(pg.sqlAppSlugBinding.created, dayEnd));
    activeVibesTimeseries.push({ day, active_vibes_count: result[0]?.cnt ?? 0 });
  }

  // User slug bindings timeseries — cumulative per day
  const userSlugBindingsTimeseries: { day: string; user_slug_bindings_count: number }[] = [];
  for (const day of days) {
    const dayEnd = `${day}T23:59:59.999Z`;
    const result = await db.select({ cnt: count() }).from(pg.sqlUserSlugBinding).where(lte(pg.sqlUserSlugBinding.created, dayEnd));
    userSlugBindingsTimeseries.push({ day, user_slug_bindings_count: result[0]?.cnt ?? 0 });
  }

  // Schema stats — table sizes and index counts from system catalogs
  const tableSizeRows = await db.execute(sql`
    SELECT
      t.tablename AS table,
      pg_size_pretty(pg_total_relation_size(quote_ident(t.tablename)::regclass)) AS total_size,
      pg_size_pretty(pg_relation_size(quote_ident(t.tablename)::regclass)) AS table_size,
      pg_total_relation_size(quote_ident(t.tablename)::regclass) AS total_bytes,
      (SELECT count(*) FROM pg_indexes i WHERE i.tablename = t.tablename AND i.schemaname = 'public')::int AS index_count
    FROM pg_tables t
    WHERE t.schemaname = 'public'
    ORDER BY pg_total_relation_size(quote_ident(t.tablename)::regclass) DESC
  `);
  const tableStats = tableSizeRows.rows as unknown as {
    table: string;
    total_size: string;
    table_size: string;
    total_bytes: number;
    index_count: number;
  }[];

  const indexRows = await db.execute(sql`
    SELECT indexname, tablename, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `);
  const indexStats = indexRows.rows as unknown as {
    indexname: string;
    tablename: string;
    indexdef: string;
  }[];

  // User model settings — fetch all settings, filter/flatten in JS
  const allUserSettings = await db
    .select({
      userId: pg.sqlUserSettings.userId,
      settings: pg.sqlUserSettings.settings,
      updated: pg.sqlUserSettings.updated,
    })
    .from(pg.sqlUserSettings)
    .orderBy(desc(pg.sqlUserSettings.updated))
    .limit(200);
  const userModelRows: { userId: string; setting: unknown; updated: string }[] = [];
  for (const row of allUserSettings) {
    const settingsArray = Array.isArray(row.settings) ? row.settings : [];
    for (const elem of settingsArray) {
      if (typeof elem === "object" && elem !== null && "type" in elem && (elem as Record<string, unknown>)["type"] === "model") {
        userModelRows.push({ userId: row.userId, setting: elem, updated: row.updated });
      }
    }
  }

  // App model settings — fetch all, filter in JS
  const allAppSettings = await db
    .select({
      userId: pg.sqlAppSettings.userId,
      userSlug: pg.sqlAppSettings.userSlug,
      appSlug: pg.sqlAppSettings.appSlug,
      settings: pg.sqlAppSettings.settings,
      updated: pg.sqlAppSettings.updated,
    })
    .from(pg.sqlAppSettings)
    .orderBy(desc(pg.sqlAppSettings.updated))
    .limit(200);
  const appModelRows: { userId: string; userSlug: string; appSlug: string; setting: unknown; updated: string }[] = [];
  for (const row of allAppSettings) {
    const settingsArray = Array.isArray(row.settings) ? row.settings : [];
    for (const elem of settingsArray) {
      if (
        typeof elem === "object" &&
        elem !== null &&
        "type" in elem &&
        (elem as Record<string, unknown>)["type"] === "active.model"
      ) {
        appModelRows.push({
          userId: row.userId,
          userSlug: row.userSlug,
          appSlug: row.appSlug,
          setting: elem,
          updated: row.updated,
        });
      }
    }
  }

  // User settings sample
  const userSettingsSample = await db
    .select({
      userId: pg.sqlUserSettings.userId,
      updated: pg.sqlUserSettings.updated,
      created: pg.sqlUserSettings.created,
      settings: pg.sqlUserSettings.settings,
    })
    .from(pg.sqlUserSettings)
    .orderBy(desc(pg.sqlUserSettings.updated))
    .limit(20);

  // App settings sample
  const appSettingsSample = await db
    .select({
      userId: pg.sqlAppSettings.userId,
      userSlug: pg.sqlAppSettings.userSlug,
      appSlug: pg.sqlAppSettings.appSlug,
      updated: pg.sqlAppSettings.updated,
      created: pg.sqlAppSettings.created,
      settings: pg.sqlAppSettings.settings,
    })
    .from(pg.sqlAppSettings)
    .orderBy(desc(pg.sqlAppSettings.updated))
    .limit(20);

  const generatedAt = new Date().toISOString();

  const files = {
    membershipsTimeseriesCsv: writeCsv("memberships-timeseries.csv", membershipTimeseries),
    userSlugBindingsTimeseriesCsv: writeCsv("user-slug-bindings-timeseries.csv", userSlugBindingsTimeseries),
    membershipsByAppCsv: writeCsv("memberships-by-app.csv", membershipsByApp),
    tableCountsCsv: writeCsv("table-counts.csv", tableCounts),
    tableStatsCsv: writeCsv("table-stats.csv", tableStats),
    indexStatsCsv: writeCsv("index-stats.csv", indexStats),
    userModelCsv: writeCsv("user-model-settings.csv", userModelRows as unknown as Record<string, unknown>[]),
    appModelCsv: writeCsv("app-model-settings.csv", appModelRows as unknown as Record<string, unknown>[]),
    userSettingsCsv: writeCsv("user-settings-sample.csv", userSettingsSample as unknown as Record<string, unknown>[]),
    appSettingsCsv: writeCsv("app-settings-sample.csv", appSettingsSample as unknown as Record<string, unknown>[]),
  };

  const html = renderHtmlReport({
    generatedAt,
    info,
    tableCounts,
    membershipSummary: membershipSummary as {
      membership_count: number;
      shared_app_count: number;
      distinct_member_count: number;
    },
    membershipTimeseries,
    membershipSlugsByDay,
    activeVibesTimeseries,
    userSlugBindingsTimeseries,
    membershipsByApp,
    tableStats,
    indexStats,
    userModelRows: userModelRows as unknown as Record<string, unknown>[],
    appModelRows: appModelRows as unknown as Record<string, unknown>[],
    userSettingsSample: userSettingsSample as unknown as Record<string, unknown>[],
    appSettingsSample: appSettingsSample as unknown as Record<string, unknown>[],
  });
  const htmlPath = path.join(outDir, "index.html");
  fs.writeFileSync(htmlPath, html, "utf8");

  console.log(
    JSON.stringify(
      {
        generatedAt,
        outputDir: outDir,
        htmlPath,
        ...files,
      },
      null,
      2
    )
  );

  await pool.end();
  return Result.Ok(undefined);
}

main().then((result) => {
  if (result.isErr()) {
    console.error(result.Err().message);
    process.exitCode = 1;
  }
});
