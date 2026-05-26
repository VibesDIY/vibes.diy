import type { R2Bucket, ScheduledEvent, ExecutionContext } from "@cloudflare/workers-types";
import { exception2Result, URI } from "@adviser/cement";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { integer, pgTable, text, primaryKey, type AnyPgColumn } from "drizzle-orm/pg-core";

export interface Env {
  LOGS_BUCKET: R2Bucket;
  NEON_DATABASE_URL: string;
}

// Logpush NDJSON envelope (one object per Worker invocation)
interface LogpushEnvelope {
  Logs?: {
    Level: string;
    Message: string[];
    TimestampMs: number;
  }[];
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

interface MissingVibeRow {
  logKey: string;
  lineIdx: number;
  ts: string;
  reqPath: string;
}

// Inline minimal schema to avoid pulling in the full @vibes.diy/api-sql workspace dep.
// Keep in sync with sqlRefererEvents in vibes-diy-api-schema-pg.ts.
const refererEvents = pgTable(
  "RefererEvents",
  {
    logKey: text().notNull(),
    lineIdx: integer().notNull(),
    ts: text().notNull(),
    refHref: text().notNull(),
    refHost: text().notNull(),
    refPath: text().notNull(),
    reqMethod: text().notNull(),
    reqPath: text().notNull(),
  },
  (t: Record<string, AnyPgColumn>) => [primaryKey({ columns: [t.logKey, t.lineIdx] })]
);

// Keep in sync with sqlMissingVibeEvents in vibes-diy-api-schema-pg.ts.
const missingVibeEvents = pgTable(
  "MissingVibeEvents",
  {
    logKey: text().notNull(),
    lineIdx: integer().notNull(),
    ts: text().notNull(),
    reqPath: text().notNull(),
  },
  (t: Record<string, AnyPgColumn>) => [primaryKey({ columns: [t.logKey, t.lineIdx] })]
);

// Parsed [referer] log line: "[referer] <href> <method> <req-path>"
const REFERER_RE = /^\[referer\] (\S+) (\S+) (\S+)$/;

function parseRefererLine(message: string, ts: string, logKey: string, lineIdx: number): RefererRow | null {
  const m = REFERER_RE.exec(message);
  if (m === null) return null;
  const [, refHref, reqMethod, reqPath] = m;
  const rUri = exception2Result(() => URI.from(refHref));
  if (rUri.isErr()) return null;
  const uri = rUri.Ok();
  return { logKey, lineIdx, ts, refHref, refHost: uri.hostname, refPath: uri.pathname, reqMethod, reqPath };
}

// Parsed [missing-vibe] log line: "[missing-vibe] <req-path>"
const MISSING_VIBE_RE = /^\[missing-vibe\] (\S+)$/;

function parseMissingVibeLine(message: string, ts: string, logKey: string, lineIdx: number): MissingVibeRow | null {
  const m = MISSING_VIBE_RE.exec(message);
  if (m === null) return null;
  const [, reqPath] = m;
  return { logKey, lineIdx, ts, reqPath };
}

async function listKeysForPrefix(bucket: R2Bucket, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const listed = await bucket.list({ prefix, cursor, limit: 1000 });
    for (const obj of listed.objects) keys.push(obj.key);
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor !== undefined);
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
    return `${y}${mo}${day}/`;
  });
}

async function batchInsertReferer(db: ReturnType<typeof drizzle>, rows: RefererRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const result = await db.insert(refererEvents).values(rows).onConflictDoNothing().returning({ logKey: refererEvents.logKey });
  return result.length;
}

async function batchInsertMissingVibe(db: ReturnType<typeof drizzle>, rows: MissingVibeRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const result = await db
    .insert(missingVibeEvents)
    .values(rows)
    .onConflictDoNothing()
    .returning({ logKey: missingVibeEvents.logKey });
  return result.length;
}

// CF Workers require `export default` for scheduled handlers — rules-bag exception (framework constraint).
export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const sql = neon(env.NEON_DATABASE_URL);
    const db = drizzle(sql);

    const allKeys: string[] = [];
    for (const prefix of datePrefixes()) {
      allKeys.push(...(await listKeysForPrefix(env.LOGS_BUCKET, prefix)));
    }

    let refererInserted = 0;
    let refererSkipped = 0;
    let missingVibeInserted = 0;
    let missingVibeSkipped = 0;

    for (const key of allKeys) {
      const obj = await env.LOGS_BUCKET.get(key);
      if (obj === null) continue;

      const isGzip = obj.httpMetadata?.contentEncoding === "gzip";
      let text: string;
      if (isGzip) {
        const buf = await obj.arrayBuffer();
        const decompressed = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
        text = await new Response(decompressed).text();
      } else {
        text = await obj.text();
      }
      const refererRows: RefererRow[] = [];
      const missingVibeRows: MissingVibeRow[] = [];
      let lineIdx = 0;

      for (const rawLine of text.split("\n")) {
        const trimmed = rawLine.trim();
        if (trimmed.length === 0) continue;
        const rEnvelope = exception2Result(() => JSON.parse(trimmed) as LogpushEnvelope);
        if (rEnvelope.isErr()) {
          lineIdx++;
          continue;
        }
        const envelope = rEnvelope.Ok();
        const fallbackTs = envelope.Timestamp ?? new Date().toISOString();
        for (const log of envelope.Logs ?? []) {
          const idx = lineIdx++;
          const message = (log.Message ?? []).join(" ");
          const ts = log.TimestampMs ? new Date(log.TimestampMs).toISOString() : fallbackTs;
          if (message.startsWith("[referer]")) {
            const row = parseRefererLine(message, ts, key, idx);
            if (row !== null) refererRows.push(row);
          } else if (message.startsWith("[missing-vibe]")) {
            const row = parseMissingVibeLine(message, ts, key, idx);
            if (row !== null) missingVibeRows.push(row);
          }
        }
      }

      const ri = await batchInsertReferer(db, refererRows);
      refererInserted += ri;
      refererSkipped += refererRows.length - ri;

      const mi = await batchInsertMissingVibe(db, missingVibeRows);
      missingVibeInserted += mi;
      missingVibeSkipped += missingVibeRows.length - mi;
    }

    console.log(
      `[logpush-etl] processed ${allKeys.length} objects — referer: inserted ${refererInserted}, skipped ${refererSkipped} — missing-vibe: inserted ${missingVibeInserted}, skipped ${missingVibeSkipped} (already present)`
    );
  },
};
