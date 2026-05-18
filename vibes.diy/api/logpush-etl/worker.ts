import { R2Bucket, ScheduledEvent, ExecutionContext } from "@cloudflare/workers-types";
import { neon, NeonQueryFunction } from "@neondatabase/serverless";

export interface Env {
  LOGS_BUCKET: R2Bucket;
  NEON_DATABASE_URL: string;
}

// Logpush NDJSON envelope (one object per Worker invocation)
interface LogpushEnvelope {
  Logs?: Array<{
    Level: string;
    Message: string[];
    TimestampMs: number;
  }>;
  Timestamp?: string;
}

interface RefererRow {
  logKey: string;
  lineIdx: number;
  ts: string;
  refHref: string;
  refHost: string;
  refPath: string;
  reqMethod: string;
  reqPath: string;
}

// Parsed [referer] log line: "[referer] <href> <method> <req-path>"
const REFERER_RE = /^\[referer\] (\S+) (\S+) (\S+)$/;

function parseRefererLine(message: string, ts: string, logKey: string, lineIdx: number): RefererRow | null {
  const m = REFERER_RE.exec(message);
  if (!m) return null;
  const [, refHref, reqMethod, reqPath] = m;
  let refHost = "";
  let refPath = "/";
  try {
    const u = new URL(refHref);
    refHost = u.hostname;
    refPath = u.pathname;
  } catch {
    return null;
  }
  return { logKey, lineIdx, ts, refHref, refHost, refPath, reqMethod, reqPath };
}

async function listKeysForPrefix(bucket: R2Bucket, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const listed = await bucket.list({ prefix, cursor, limit: 1000 });
    for (const obj of listed.objects) keys.push(obj.key);
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return keys;
}

function datePrefixes(): string[] {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return [now, yesterday].map((d) => {
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}/${mo}/${day}/`;
  });
}

async function batchInsert(sql: NeonQueryFunction<false, false>, rows: RefererRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  // Build a multi-row VALUES clause with positional parameters
  const params: (string | number)[] = [];
  const placeholders = rows.map((row) => {
    const base = params.length + 1;
    params.push(row.logKey, row.lineIdx, row.ts, row.refHref, row.refHost, row.refPath, row.reqMethod, row.reqPath);
    return `($${base},$${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7})`;
  });
  const result = await sql(
    `INSERT INTO "RefererEvents"
       ("logKey","lineIdx","ts","refHref","refHost","refPath","reqMethod","reqPath")
     VALUES ${placeholders.join(",")}
     ON CONFLICT ("logKey","lineIdx") DO NOTHING
     RETURNING "logKey"`,
    params
  );
  return result.length;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const sql = neon(env.NEON_DATABASE_URL);

    const allKeys: string[] = [];
    for (const prefix of datePrefixes()) {
      allKeys.push(...(await listKeysForPrefix(env.LOGS_BUCKET, prefix)));
    }

    let totalInserted = 0;
    let totalSkipped = 0;

    for (const key of allKeys) {
      const obj = await env.LOGS_BUCKET.get(key);
      if (!obj) continue;

      const text = await obj.text();
      const rows: RefererRow[] = [];
      let lineIdx = 0;

      for (const rawLine of text.split("\n")) {
        const trimmed = rawLine.trim();
        if (!trimmed) continue;
        let envelope: LogpushEnvelope;
        try {
          envelope = JSON.parse(trimmed) as LogpushEnvelope;
        } catch {
          lineIdx++;
          continue;
        }
        const fallbackTs = envelope.Timestamp ?? new Date().toISOString();
        for (const log of envelope.Logs ?? []) {
          const message = log.Message?.[0];
          if (!message?.startsWith("[referer]")) continue;
          const ts = log.TimestampMs ? new Date(log.TimestampMs).toISOString() : fallbackTs;
          const row = parseRefererLine(message, ts, key, lineIdx);
          if (row) rows.push(row);
          lineIdx++;
        }
      }

      const inserted = await batchInsert(sql, rows);
      totalInserted += inserted;
      totalSkipped += rows.length - inserted;
    }

    console.log(
      `[logpush-etl] processed ${allKeys.length} objects — inserted ${totalInserted}, skipped ${totalSkipped} (already present)`
    );
  },
};
