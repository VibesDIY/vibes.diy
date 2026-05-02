import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "@neondatabase/serverless";
import { Result, exception2Result } from "@adviser/cement";

function printUsage(): void {
  console.log(
    `
Usage:
  pnpm --dir vibes.diy/api/svc run admin:db sql "UPDATE ..."

Environment:
  NEON_DATABASE_ADMIN_URL must be set (in .dev.vars or env).

Examples:
  pnpm --dir vibes.diy/api/svc run admin:db sql "UPDATE \\"AppDocuments\\" SET \\"userSlug\\" = 'test' WHERE \\"appSlug\\" = 'foo'"
`.trim()
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

async function run(): Promise<Result<void>> {
  loadDevVars();

  const args = process.argv.slice(2);
  const command = args.shift();

  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    printUsage();
    return Result.Ok(undefined);
  }

  const connectionString = process.env["NEON_DATABASE_ADMIN_URL"];
  if (connectionString === undefined) {
    printUsage();
    return Result.Err("NEON_DATABASE_ADMIN_URL is required (set in .dev.vars or env)");
  }

  const pool = new Pool({ connectionString });

  const result = await exception2Result(async () => {
    if (command === "sql") {
      const sql = args.join(" ").trim();
      if (sql === "") {
        throw new Error("SQL is empty");
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
  }
  return String(error);
}

run().then((result) => {
  if (result.isErr()) {
    console.error(formatError(result.Err()));
    process.exitCode = 1;
  }
});
