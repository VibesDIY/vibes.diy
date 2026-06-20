import { Pool } from "@neondatabase/serverless";
import { Result, exception2Result } from "@adviser/cement";
import { formatError, loadDevVars } from "./usage-report-util.js";

function printUsage(): void {
  console.log(
    `
Usage:
  pnpm --dir vibes.diy/api/svc run admin:db sql "UPDATE ..."

Environment:
  NEON_DATABASE_ADMIN_URL must be set (in .dev.vars or env).

Examples:
  pnpm --dir vibes.diy/api/svc run admin:db sql "UPDATE \\"AppDocuments\\" SET \\"ownerHandle\\" = 'test' WHERE \\"appSlug\\" = 'foo'"
`.trim()
  );
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

run().then((result) => {
  if (result.isErr()) {
    console.error(formatError(result.Err()));
    process.exitCode = 1;
  }
});
