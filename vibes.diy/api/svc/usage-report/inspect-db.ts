import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "@neondatabase/serverless";
import { Result, exception2Result } from "@adviser/cement";

interface TableInfo {
  readonly table_schema: string;
  readonly table_name: string;
}

interface ConnectionInfo {
  readonly database: string;
  readonly current_schema: string;
  readonly current_user: string;
  readonly server_addr: string;
  readonly server_port: number;
  readonly schemas: readonly string[];
}

interface ParsedArgs {
  readonly command: string | undefined;
  readonly args: string[];
  readonly limit: number;
}

function printUsage(): void {
  console.log(
    `
Usage:
  pnpm --dir vibes.diy/api/svc run db:inspect info
  pnpm --dir vibes.diy/api/svc run db:inspect tables
  pnpm --dir vibes.diy/api/svc run db:inspect table UserSettings --limit 20
  pnpm --dir vibes.diy/api/svc run db:inspect sql "select * from \\"UserSettings\\" limit 5"

Environment:
  NEON_DATABASE_URL or DATABASE_URL must be set (in .dev.vars or env).

Examples:
  pnpm --dir vibes.diy/api/svc run db:inspect info
  pnpm --dir vibes.diy/api/svc run db:inspect tables
  pnpm --dir vibes.diy/api/svc run db:inspect table UserSettings --limit 5
  pnpm --dir vibes.diy/api/svc run db:inspect sql "select userId, updated from \\"UserSettings\\" order by updated desc limit 5"
`.trim()
  );
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

async function listTables(pool: Pool): Promise<TableInfo[]> {
  const result = await pool.query(`
    select table_schema, table_name
    from information_schema.tables
    where table_type = 'BASE TABLE'
      and table_schema not in ('pg_catalog', 'information_schema')
    order by table_schema, table_name
  `);
  return result.rows as TableInfo[];
}

async function getConnectionInfo(pool: Pool): Promise<ConnectionInfo> {
  const [{ rows: currentRows }, { rows: schemaRows }] = await Promise.all([
    pool.query(`
      select
        current_database() as database,
        current_schema() as current_schema,
        current_user as current_user,
        inet_server_addr()::text as server_addr,
        inet_server_port() as server_port
    `),
    pool.query(`
      select schema_name
      from information_schema.schemata
      where schema_name not in ('pg_catalog', 'information_schema')
      order by schema_name
    `),
  ]);

  return {
    ...(currentRows[0] ?? {}),
    schemas: (schemaRows as { schema_name: string }[]).map((row) => row.schema_name),
  } as ConnectionInfo;
}

async function resolveTable(pool: Pool, requestedName: string): Promise<Result<TableInfo>> {
  const tables = await listTables(pool);
  const normalizedRequest = requestedName.trim();
  const dottedRequest = normalizedRequest.includes(".") ? normalizedRequest : `public.${normalizedRequest}`;

  const exact = tables.find(
    (table) => table.table_name === normalizedRequest || `${table.table_schema}.${table.table_name}` === normalizedRequest
  );
  if (exact !== undefined) {
    return Result.Ok(exact);
  }

  const folded = normalizedRequest.toLowerCase();
  const foldedDotted = dottedRequest.toLowerCase();
  const caseInsensitive = tables.find(
    (table) =>
      table.table_name.toLowerCase() === folded || `${table.table_schema}.${table.table_name}`.toLowerCase() === foldedDotted
  );
  if (caseInsensitive !== undefined) {
    return Result.Ok(caseInsensitive);
  }

  return Result.Err(
    `unknown table: ${requestedName}. Run 'pnpm --dir vibes.diy/api/svc run inspect:db tables' to see actual tables in this database`
  );
}

function loadDevVars(): void {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
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

function parseArgs(argv: string[]): Result<ParsedArgs> {
  const args = [...argv];
  const command = args.shift();
  let limit = 20;

  while (args.length > 0) {
    const idx = args.findIndex((arg) => arg === "--limit");
    if (idx === -1) break;
    const raw = args[idx + 1];
    if (raw === undefined) {
      return Result.Err("--limit requires a number");
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return Result.Err(`invalid --limit value: ${raw}`);
    }
    limit = parsed;
    args.splice(idx, 2);
  }

  return Result.Ok({ command, args, limit });
}

function assertReadonlySql(sql: string): Result<string> {
  const normalized = sql.trim().replace(/;+$/, "").toLowerCase();
  if (normalized === "") {
    return Result.Err("SQL is empty");
  }
  if (
    !(
      normalized.startsWith("select ") ||
      normalized.startsWith("with ") ||
      normalized.startsWith("show ") ||
      normalized.startsWith("explain ")
    )
  ) {
    return Result.Err("Only read-only SELECT/WITH/SHOW/EXPLAIN statements are allowed");
  }
  return Result.Ok(sql);
}

async function run(): Promise<Result<void>> {
  loadDevVars();

  const rParsed = parseArgs(process.argv.slice(2));
  if (rParsed.isErr()) {
    return Result.Err(rParsed);
  }
  const { command, args, limit } = rParsed.Ok();

  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    printUsage();
    return Result.Ok(undefined);
  }

  const connectionString = process.env["NEON_DATABASE_URL"] ?? process.env["DATABASE_URL"];
  if (connectionString === undefined) {
    printUsage();
    return Result.Err("NEON_DATABASE_URL or DATABASE_URL is required");
  }

  const pool = new Pool({ connectionString });

  const result = await exception2Result(async () => {
    if (command === "info") {
      const info = await getConnectionInfo(pool);
      console.log(JSON.stringify(info, null, 2));
      return;
    }

    if (command === "tables") {
      const [info, tables] = await Promise.all([getConnectionInfo(pool), listTables(pool)]);
      console.log(JSON.stringify({ ...info, tables }, null, 2));
      return;
    }

    if (command === "table") {
      const requestedTableName = args[0];
      if (requestedTableName === undefined) {
        throw new Error("table name is required");
      }
      const rTable = await resolveTable(pool, requestedTableName);
      if (rTable.isErr()) {
        throw new Error(rTable.Err().message);
      }
      const table = rTable.Ok();
      const sql = `select * from ${quoteIdentifier(table.table_schema)}.${quoteIdentifier(table.table_name)} order by 1 desc limit $1`;

      const queryResult = await pool.query(sql, [limit]);
      console.log(
        JSON.stringify(
          {
            table: `${table.table_schema}.${table.table_name}`,
            rowCount: queryResult.rowCount,
            rows: queryResult.rows,
          },
          null,
          2
        )
      );
      return;
    }

    if (command === "sql") {
      const sql = args.join(" ").trim();
      const rSql = assertReadonlySql(sql);
      if (rSql.isErr()) {
        throw new Error(rSql.Err().message);
      }
      const queryResult = await pool.query(sql);
      console.log(
        JSON.stringify(
          {
            rowCount: queryResult.rowCount,
            rows: queryResult.rows,
          },
          null,
          2
        )
      );
      return;
    }

    throw new Error(`unknown command: ${command}`);
  });

  await pool.end();
  return result;
}

function formatError(error: unknown): string {
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    if (typeof obj["message"] === "string" && obj["message"] !== "") {
      return obj["message"];
    }
    const nested = obj["error"];
    if (typeof nested === "object" && nested !== null) {
      const nestedObj = nested as Record<string, unknown>;
      if (typeof nestedObj["message"] === "string" && nestedObj["message"] !== "") {
        return nestedObj["message"];
      }
    }
  }
  return String(error);
}

run().then((result) => {
  if (result.isErr()) {
    console.error(formatError(result.Err()));
    process.exitCode = 1;
  }
});
