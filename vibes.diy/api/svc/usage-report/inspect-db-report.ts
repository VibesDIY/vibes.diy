import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { Result, exception2Result } from "@adviser/cement";
import { renderHtmlReport } from "./inspect-db-report-template.jsx";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const inspectScriptPath = path.join(scriptDir, "inspect-db.ts");
const outDir = path.join(scriptDir, "../dist/inspect-db-report");

function runInspect(args: readonly string[]): Result<Record<string, unknown>> {
  const tsxBin = path.join(scriptDir, "../node_modules/.bin/tsx");
  const result = spawnSync(tsxBin, [inspectScriptPath, ...args], {
    cwd: path.join(scriptDir, ".."),
    encoding: "utf8" as const,
    env: process.env,
  });

  if (result.status !== 0) {
    return Result.Err((result.stderr || result.stdout || `inspect-db failed for ${args.join(" ")}`).trim());
  }

  const stdout = result.stdout.trim();
  if (stdout === "") {
    return Result.Err(`inspect-db returned no output for ${args.join(" ")}`);
  }

  return exception2Result(() => JSON.parse(stdout) as Record<string, unknown>);
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

function unwrapInspect(args: readonly string[]): Record<string, unknown> {
  const r = runInspect(args);
  if (r.isErr()) {
    console.error(`inspect-db failed for: ${args.join(" ")}: ${r.Err().message}`);
    process.exitCode = 1;
    return {};
  }
  return r.Ok();
}

async function main(): Promise<Result<void>> {
  fs.mkdirSync(outDir, { recursive: true });

  const tablesPayload = unwrapInspect(["tables"]);
  const info = {
    database: tablesPayload["database"] as string,
    current_schema: tablesPayload["current_schema"] as string,
    current_user: tablesPayload["current_user"] as string,
    server_addr: tablesPayload["server_addr"] as string,
    server_port: tablesPayload["server_port"] as number,
    schemas: tablesPayload["schemas"] as string[],
  };
  const tables = (tablesPayload["tables"] as { table_schema: string; table_name: string }[]) ?? [];

  const tableCounts = tables.map((table) => {
    const payload = unwrapInspect(["sql", `select count(*)::int as "rowCount" from "${table.table_schema}"."${table.table_name}"`]);
    return {
      table: `${table.table_schema}.${table.table_name}`,
      rowCount: ((payload["rows"] as Record<string, unknown>[])?.[0]?.["rowCount"] as number) ?? 0,
    };
  });

  const membershipSummaryPayload = unwrapInspect([
    "sql",
    `select count(*)::int as membership_count, count(distinct ("userSlug", "appSlug"))::int as shared_app_count, count(distinct "foreignUserId")::int as distinct_member_count from public."RequestGrants" where state = 'approved'`,
  ]);
  const membershipSummary = ((membershipSummaryPayload["rows"] as Record<string, unknown>[]) ?? [])[0] ?? {
    membership_count: 0,
    shared_app_count: 0,
    distinct_member_count: 0,
  };

  const membershipsByAppPayload = unwrapInspect([
    "sql",
    `select "userId" as owner_user_id, "userSlug", "appSlug", count(distinct "foreignUserId")::int as memberships from public."RequestGrants" where state = 'approved' group by 1, 2, 3 order by memberships desc, "userSlug", "appSlug" limit 200`,
  ]);
  const membershipsByApp = (membershipsByAppPayload["rows"] as Record<string, unknown>[]) ?? [];

  const membershipTimeseriesPayload = unwrapInspect([
    "sql",
    `with days as (select generate_series(current_date - interval '29 days', current_date, interval '1 day')::date as day) select to_char(day, 'YYYY-MM-DD') as day, (select count(*)::int from public."RequestGrants" rg where rg.state = 'approved' and rg.created::date <= day) as membership_count from days order by day`,
  ]);
  const membershipTimeseries = (membershipTimeseriesPayload["rows"] as Record<string, unknown>[]) ?? [];

  const userSlugBindingsTimeseriesPayload = unwrapInspect([
    "sql",
    `with days as (
        select generate_series(current_date - interval '29 days', current_date, interval '1 day')::date as day
      ),
      bindings as (
        select created::timestamptz::date as created_day
        from public."UserSlugBindings"
      )
      select
        to_char(day, 'YYYY-MM-DD') as day,
        (
          select count(*)::int
          from bindings b
          where b.created_day <= day
        ) as user_slug_bindings_count
      from days
      order by day`,
  ]);
  const userSlugBindingsTimeseries = (userSlugBindingsTimeseriesPayload["rows"] as Record<string, unknown>[]) ?? [];

  const userModelPayload = unwrapInspect([
    "sql",
    `select "userId", elem as setting, updated from public."UserSettings" cross join lateral jsonb_array_elements(settings) as elem where elem->>'type' = 'model' order by updated desc limit 200`,
  ]);
  const userModelRows = (userModelPayload["rows"] as Record<string, unknown>[]) ?? [];

  const appModelPayload = unwrapInspect([
    "sql",
    `select "userId", "userSlug", "appSlug", elem as setting, updated from public."AppSettings" cross join lateral jsonb_array_elements(settings) as elem where elem->>'type' = 'active.model' order by updated desc limit 200`,
  ]);
  const appModelRows = (appModelPayload["rows"] as Record<string, unknown>[]) ?? [];

  const userSettingsPayload = unwrapInspect(["table", "public.UserSettings", "--limit", "20"]);
  const userSettingsSample = ((userSettingsPayload["rows"] as Record<string, unknown>[]) ?? []).map((row) => ({
    userId: row["userId"],
    updated: row["updated"],
    created: row["created"],
    settings: row["settings"],
  }));

  const appSettingsPayload = unwrapInspect(["table", "public.AppSettings", "--limit", "20"]);
  const appSettingsSample = ((appSettingsPayload["rows"] as Record<string, unknown>[]) ?? []).map((row) => ({
    userId: row["userId"],
    userSlug: row["userSlug"],
    appSlug: row["appSlug"],
    updated: row["updated"],
    created: row["created"],
    settings: row["settings"],
  }));

  const generatedAt = new Date().toISOString();

  const files = {
    membershipsTimeseriesCsv: writeCsv("memberships-timeseries.csv", membershipTimeseries),
    userSlugBindingsTimeseriesCsv: writeCsv("user-slug-bindings-timeseries.csv", userSlugBindingsTimeseries),
    membershipsByAppCsv: writeCsv("memberships-by-app.csv", membershipsByApp),
    tableCountsCsv: writeCsv("table-counts.csv", tableCounts),
    userModelCsv: writeCsv("user-model-settings.csv", userModelRows),
    appModelCsv: writeCsv("app-model-settings.csv", appModelRows),
    userSettingsCsv: writeCsv("user-settings-sample.csv", userSettingsSample),
    appSettingsCsv: writeCsv("app-settings-sample.csv", appSettingsSample),
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
    userSlugBindingsTimeseries,
    membershipsByApp,
    userModelRows,
    appModelRows,
    userSettingsSample,
    appSettingsSample,
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

  return Result.Ok(undefined);
}

main().then((result) => {
  if (result.isErr()) {
    console.error(result.Err().message);
    process.exitCode = 1;
  }
});
