import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Result } from "@adviser/cement";
import { renderHtmlReport } from "./inspect-db-report-template.jsx";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { sql, count, countDistinct, eq, desc, asc } from "drizzle-orm";
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

const allTables = [
  { table_schema: "public", table_name: "Assets" },
  { table_schema: "public", table_name: "UserSlugBindings" },
  { table_schema: "public", table_name: "AppSlugBindings" },
  { table_schema: "public", table_name: "Apps" },
  { table_schema: "public", table_name: "ChatContexts" },
  { table_schema: "public", table_name: "ChatSections" },
  { table_schema: "public", table_name: "PromptContexts" },
  { table_schema: "public", table_name: "ApplicationChats" },
  { table_schema: "public", table_name: "UserSettings" },
  { table_schema: "public", table_name: "AppSettings" },
  { table_schema: "public", table_name: "RequestGrants" },
  { table_schema: "public", table_name: "InviteGrants" },
];

async function main(): Promise<Result<void>> {
  loadDevVars();

  const connectionString = process.env["NEON_DATABASE_URL"] ?? process.env["DATABASE_URL"];
  if (!connectionString) {
    return Result.Err("NEON_DATABASE_URL or DATABASE_URL is required");
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  fs.mkdirSync(outDir, { recursive: true });

  // Database info
  const infoRow = await db.execute<{ db: string; schema: string; usr: string; addr: string; port: number }>(
    sql`select current_database() as db, current_schema() as schema, current_user as usr, inet_server_addr()::text as addr, inet_server_port() as port`
  );
  const info = {
    database: infoRow.rows[0]?.db ?? "",
    current_schema: infoRow.rows[0]?.schema ?? "",
    current_user: infoRow.rows[0]?.usr ?? "",
    server_addr: infoRow.rows[0]?.addr ?? "",
    server_port: infoRow.rows[0]?.port ?? 0,
    schemas: ["public"],
  };

  // Table counts
  const tableCounts: { table: string; rowCount: number }[] = [];
  for (const t of allTables) {
    const result = await db.execute<{ rowCount: number }>(
      sql.raw(`select count(*)::int as "rowCount" from "${t.table_schema}"."${t.table_name}"`)
    );
    tableCounts.push({ table: `${t.table_schema}.${t.table_name}`, rowCount: result.rows[0]?.rowCount ?? 0 });
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
      sql`count(distinct ${pg.sqlRequestGrants.foreignUserId}) desc`,
      asc(pg.sqlRequestGrants.userSlug),
      asc(pg.sqlRequestGrants.appSlug)
    )
    .limit(200);

  // Membership timeseries (uses generate_series, Postgres-specific)
  const membershipTimeseriesResult = await db.execute<{ day: string; membership_count: number }>(
    sql`with days as (select generate_series(current_date - interval '29 days', current_date, interval '1 day')::date as day) select to_char(day, 'YYYY-MM-DD') as day, (select count(*)::int from public."RequestGrants" rg where rg.state = 'approved' and rg.created::date <= day) as membership_count from days order by day`
  );
  const membershipTimeseries = membershipTimeseriesResult.rows;

  // Active vibes timeseries
  const activeVibesTimeseriesResult = await db.execute<{ day: string; active_vibes_count: number }>(
    sql`with days as (select generate_series(current_date - interval '29 days', current_date, interval '1 day')::date as day) select to_char(day, 'YYYY-MM-DD') as day, (select count(distinct ("userSlug", "appSlug"))::int from public."AppSlugBindings" where created::date <= day) as active_vibes_count from days order by day`
  );
  const activeVibesTimeseries = activeVibesTimeseriesResult.rows;

  // User slug bindings timeseries
  const userSlugBindingsTimeseriesResult = await db.execute<{ day: string; user_slug_bindings_count: number }>(
    sql`with days as (select generate_series(current_date - interval '29 days', current_date, interval '1 day')::date as day),
      bindings as (select created::timestamptz::date as created_day from public."UserSlugBindings")
      select to_char(day, 'YYYY-MM-DD') as day,
        (select count(*)::int from bindings b where b.created_day <= day) as user_slug_bindings_count
      from days order by day`
  );
  const userSlugBindingsTimeseries = userSlugBindingsTimeseriesResult.rows;

  // User model settings (jsonb_array_elements is Postgres-specific)
  const userModelResult = await db.execute<{ userId: string; setting: unknown; updated: string }>(
    sql`select "userId", elem as setting, updated from ${pg.sqlUserSettings} cross join lateral jsonb_array_elements(settings) as elem where elem->>'type' = 'model' order by updated desc limit 200`
  );
  const userModelRows = userModelResult.rows;

  // App model settings
  const appModelResult = await db.execute<{ userId: string; userSlug: string; appSlug: string; setting: unknown; updated: string }>(
    sql`select "userId", "userSlug", "appSlug", elem as setting, updated from ${pg.sqlAppSettings} cross join lateral jsonb_array_elements(settings) as elem where elem->>'type' = 'active.model' order by updated desc limit 200`
  );
  const appModelRows = appModelResult.rows;

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
    membershipsTimeseriesCsv: writeCsv("memberships-timeseries.csv", membershipTimeseries as unknown as Record<string, unknown>[]),
    userSlugBindingsTimeseriesCsv: writeCsv(
      "user-slug-bindings-timeseries.csv",
      userSlugBindingsTimeseries as unknown as Record<string, unknown>[]
    ),
    membershipsByAppCsv: writeCsv("memberships-by-app.csv", membershipsByApp),
    tableCountsCsv: writeCsv("table-counts.csv", tableCounts),
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
    membershipTimeseries: membershipTimeseries as unknown as Record<string, unknown>[],
    activeVibesTimeseries: activeVibesTimeseries as unknown as Record<string, unknown>[],
    userSlugBindingsTimeseries: userSlugBindingsTimeseries as unknown as Record<string, unknown>[],
    membershipsByApp,
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
