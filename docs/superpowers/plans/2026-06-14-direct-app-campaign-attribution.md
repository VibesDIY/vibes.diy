# Direct-to-app Campaign Attribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make direct-to-app campaigns (`vibes.diy/vibe/<author>/<slug>?fbclid=X&utm_campaign=Y`) show non-blank CTA Visitors / Cost/Visitor in the campaign-health report, without regressing good.vibes.diy attribution.

**Architecture:** Mirror the existing `[referer]` → ETL → table → report → SPA pipeline with a parallel `[landing]` event that captures the request-URL `fbclid` + `utm_campaign` for `/vibe/*` landings. A new `LandingEvents` table stores them; the report counts unique fbclid per `utm_campaign` and joins each campaign by the `utm_campaign` string extracted from its own Meta `website_url` (no landing-pages change, no ad backfill). good.vibes.diy attribution takes precedence; duplicate direct keys are flagged shared.

**Tech Stack:** TypeScript, Cloudflare Workers, Drizzle ORM (pg + sqlite), `@adviser/cement` URI, arktype, React, Vitest (libsql global setup).

**Spec:** `docs/superpowers/specs/2026-06-12-direct-app-campaign-attribution-design.md` · **Issue:** [#2333](https://github.com/VibesDIY/vibes.diy/issues/2333) · **PR:** [#2347](https://github.com/VibesDIY/vibes.diy/pull/2347)

**Conventions for this plan:**

- All file paths are relative to the repo root. Application code lives under `vibes.diy/`.
- Run all commands from the `vibes.diy/` package directory unless stated otherwise.
- Run the API unit tests from `vibes.diy/api/tests/` with: `pnpm vitest run <pattern>` (package `@vibes.diy/api-test`, uses `globalSetup.libsql.ts`).
- This is a column-add only — `LandingEvents` is a brand-new table. No migration of existing tables.

---

## Task 1: Add the `LandingEvents` table (pg + sqlite + registry)

**Files:**

- Modify: `vibes.diy/api/sql/vibes-diy-api-schema-pg.ts` (after `sqlMissingVibeEvents`, ~line 300)
- Modify: `vibes.diy/api/sql/vibes-diy-api-schema-sqlite.ts` (after `sqlMissingVibeEvents`, ~line 301)
- Modify: `vibes.diy/api/sql/tables.ts:28` (sqlite map) and `:66` (pg map)
- Test: `vibes.diy/api/tests/landing-events-table.test.ts` (new)

- [ ] **Step 1: Write the failing test** — proves the table is registered and round-trips a row.

Create `vibes.diy/api/tests/landing-events-table.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

describe("LandingEvents table", () => {
  const sthis = ensureSuperThis();
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
  }, 10000);

  it("inserts and selects a LandingEvents row", async () => {
    const t = appCtx.vibesCtx.sql.tables;
    await appCtx.vibesCtx.sql.db.insert(t.landingEvents).values([
      {
        logKey: "le-1",
        lineIdx: 0,
        ts: "2026-05-22T10:00:00Z",
        landHref: "https://vibes.diy/vibe/og/foo?fbclid=AAA&utm_campaign=direct-app-foo",
        landHost: "vibes.diy",
        landPath: "/vibe/og/foo",
        fbclid: "AAA",
        utmCampaign: "direct-app-foo",
        ua: "Mozilla/5.0 (iPhone)",
      },
    ]);
    const rows = await appCtx.vibesCtx.sql.db.select().from(t.landingEvents);
    expect(rows.length).toBe(1);
    expect(rows[0].utmCampaign).toBe("direct-app-foo");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `vibes.diy/api/tests/`): `pnpm vitest run landing-events-table`
Expected: FAIL — `t.landingEvents` is `undefined` (table not registered).

- [ ] **Step 3: Add the pg table.** In `vibes.diy/api/sql/vibes-diy-api-schema-pg.ts`, immediately after the `sqlMissingVibeEvents` block:

```ts
// Direct-to-app landing events — written by ETL from Logpush NDJSON ([landing] lines).
// Captures the request-URL fbclid + utm_campaign for /vibe/* ad landings (no second hop).
// Keep in sync with sqlLandingEvents in vibes-diy-api-schema-sqlite.ts and the inline
// landingEvents table in api/logpush-etl/worker.ts.
export const sqlLandingEvents = pgTable(
  "LandingEvents",
  {
    logKey: text().notNull(), // R2 object key (Logpush filename), part of dedup PK
    lineIdx: integer().notNull(), // line index within the R2 object, part of dedup PK
    ts: text().notNull(), // ISO timestamp from Logpush envelope
    landHref: text().notNull(), // full landing URL, query intact (audit/debug source)
    landHost: text().notNull(), // hostname only (vibes.diy)
    landPath: text().notNull(), // path only (/vibe/<owner>/<slug>)
    fbclid: text().notNull(), // parsed from landHref; report join column (always present)
    utmCampaign: text().notNull(), // parsed from landHref; "" when absent; report join column
    ua: text().notNull(), // raw User-Agent for future bot/prefetch auditing (unused in v1)
  },
  (table) => [
    primaryKey({ columns: [table.logKey, table.lineIdx] }),
    index("LandingEvents_utmCampaign_ts_idx").on(table.utmCampaign, table.ts),
    index("LandingEvents_ts_idx").on(table.ts),
  ]
);
```

(`pgTable`, `text`, `integer`, `primaryKey`, and `index` are already imported in this file.)

- [ ] **Step 4: Add the sqlite table.** In `vibes.diy/api/sql/vibes-diy-api-schema-sqlite.ts`, immediately after the `sqlMissingVibeEvents` block:

```ts
// Direct-to-app landing events — written by ETL from Logpush NDJSON ([landing] lines).
// Empty in dev/SQLite; populated in prod/Neon by the logpush-etl cron worker.
// Keep columns in sync with sqlLandingEvents in vibes-diy-api-schema-pg.ts.
export const sqlLandingEvents = sqliteTable("LandingEvents", {
  logKey: text().notNull(),
  lineIdx: int().notNull(),
  ts: text().notNull(),
  landHref: text().notNull(),
  landHost: text().notNull(),
  landPath: text().notNull(),
  fbclid: text().notNull(),
  utmCampaign: text().notNull(),
  ua: text().notNull(),
});
```

(`sqliteTable`, `text`, `int` are already imported in this file. The sqlite referer/missing-vibe tables intentionally declare no PK/index — mirror that.)

- [ ] **Step 5: Register in the table maps.** In `vibes.diy/api/sql/tables.ts`, add to the sqlite map (after `missingVibeEvents: sqlite.sqlMissingVibeEvents,` at line 29):

```ts
    landingEvents: sqlite.sqlLandingEvents,
```

and to the pg map (after `missingVibeEvents: pg.sqlMissingVibeEvents,` at line 67):

```ts
      landingEvents: pg.sqlLandingEvents,
```

- [ ] **Step 6: Run the test to verify it passes**

Run (from `vibes.diy/api/tests/`): `pnpm vitest run landing-events-table`
Expected: PASS (1 test).

- [ ] **Step 7: Commit**

```bash
git add vibes.diy/api/sql/vibes-diy-api-schema-pg.ts vibes.diy/api/sql/vibes-diy-api-schema-sqlite.ts vibes.diy/api/sql/tables.ts vibes.diy/api/tests/landing-events-table.test.ts
git commit -m "feat(sql): add LandingEvents table for direct-app attribution (#2333)"
```

---

## Task 2: ETL landing parser (`parse-landing.ts`)

Extract the pure parse into a dependency-light module (only `@adviser/cement`) so it is unit-testable without importing the worker's neon/Cloudflare deps.

**Files:**

- Create: `vibes.diy/api/logpush-etl/parse-landing.ts`
- Test: `vibes.diy/api/tests/logpush-etl-parse-landing.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `vibes.diy/api/tests/logpush-etl-parse-landing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseLandingLine } from "../logpush-etl/parse-landing.js";

const TS = "2026-05-22T10:00:00Z";

describe("parseLandingLine", () => {
  it("parses a valid [landing] line with a space-bearing UA tail", () => {
    const msg =
      "[landing] https://vibes.diy/vibe/og/foo?fbclid=AAA&utm_campaign=direct-app-foo /vibe/og/foo Mozilla/5.0 (iPhone; CPU) Safari";
    const row = parseLandingLine(msg, TS, "le-1", 3);
    expect(row).toEqual({
      logKey: "le-1",
      lineIdx: 3,
      ts: TS,
      landHref: "https://vibes.diy/vibe/og/foo?fbclid=AAA&utm_campaign=direct-app-foo",
      landHost: "vibes.diy",
      landPath: "/vibe/og/foo",
      fbclid: "AAA",
      utmCampaign: "direct-app-foo",
      ua: "Mozilla/5.0 (iPhone; CPU) Safari",
    });
  });

  it("stores empty utm_campaign when absent", () => {
    const msg = "[landing] https://vibes.diy/vibe/og/foo?fbclid=BBB /vibe/og/foo curl/8";
    const row = parseLandingLine(msg, TS, "le-1", 0);
    expect(row?.utmCampaign).toBe("");
    expect(row?.fbclid).toBe("BBB");
  });

  it("returns null when fbclid is missing", () => {
    const msg = "[landing] https://vibes.diy/vibe/og/foo?utm_campaign=direct-app-foo /vibe/og/foo UA";
    expect(parseLandingLine(msg, TS, "le-1", 0)).toBeNull();
  });

  it("returns null on a malformed URL", () => {
    const msg = "[landing] not-a-url /vibe/og/foo UA";
    expect(parseLandingLine(msg, TS, "le-1", 0)).toBeNull();
  });

  it("returns null when the line does not match the prefix shape", () => {
    expect(parseLandingLine("[referer] https://x/ GET /y", TS, "le-1", 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `vibes.diy/api/tests/`): `pnpm vitest run logpush-etl-parse-landing`
Expected: FAIL — cannot resolve `../logpush-etl/parse-landing.js`.

- [ ] **Step 3: Create the parser module**

Create `vibes.diy/api/logpush-etl/parse-landing.ts`:

```ts
import { exception2Result, URI } from "@adviser/cement";

export interface LandingRow {
  logKey: string;
  lineIdx: number;
  ts: string;
  landHref: string;
  landHost: string;
  landPath: string;
  fbclid: string;
  utmCampaign: string;
  ua: string;
}

// Parsed [landing] log line: "[landing] <full-url> <pathname> <user-agent...>"
// The pathname token is redundant (derived from the URL) but kept for symmetry with
// [referer]; the UA is the free-form remainder because user-agents contain spaces.
export const LANDING_RE = /^\[landing\] (\S+) (\S+) (.*)$/;

export function parseLandingLine(message: string, ts: string, logKey: string, lineIdx: number): LandingRow | null {
  const m = LANDING_RE.exec(message);
  if (m === null) return null;
  const [, landHref, , ua] = m;
  const rUri = exception2Result(() => URI.from(landHref));
  if (rUri.isErr()) return null;
  const uri = rUri.Ok();
  const fbclid = uri.getParam("fbclid") ?? "";
  if (fbclid === "") return null; // a landing event must carry fbclid
  const utmCampaign = uri.getParam("utm_campaign") ?? "";
  return { logKey, lineIdx, ts, landHref, landHost: uri.hostname, landPath: uri.pathname, fbclid, utmCampaign, ua };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run (from `vibes.diy/api/tests/`): `pnpm vitest run logpush-etl-parse-landing`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/logpush-etl/parse-landing.ts vibes.diy/api/tests/logpush-etl-parse-landing.test.ts
git commit -m "feat(etl): add parseLandingLine for [landing] log lines (#2333)"
```

---

## Task 3: Wire landing capture into the ETL worker

**Files:**

- Modify: `vibes.diy/api/logpush-etl/worker.ts`

No new unit test (the worker's `scheduled` handler needs R2 + neon; `parseLandingLine` is already covered in Task 2). Verification is typecheck + reading the diff.

- [ ] **Step 1: Import the parser.** At the top of `vibes.diy/api/logpush-etl/worker.ts`, after the existing imports (line ~5):

```ts
import { parseLandingLine, type LandingRow } from "./parse-landing.js";
```

- [ ] **Step 2: Add the inline `landingEvents` table.** After the `missingVibeEvents` pgTable block (ends line 67):

```ts
// Keep in sync with sqlLandingEvents in vibes-diy-api-schema-pg.ts.
const landingEvents = pgTable(
  "LandingEvents",
  {
    logKey: text().notNull(),
    lineIdx: integer().notNull(),
    ts: text().notNull(),
    landHref: text().notNull(),
    landHost: text().notNull(),
    landPath: text().notNull(),
    fbclid: text().notNull(),
    utmCampaign: text().notNull(),
    ua: text().notNull(),
  },
  (t: Record<string, AnyPgColumn>) => [primaryKey({ columns: [t.logKey, t.lineIdx] })]
);
```

- [ ] **Step 3: Add `batchInsertLanding`.** After `batchInsertMissingVibe` (ends line 129):

```ts
async function batchInsertLanding(db: ReturnType<typeof drizzle>, rows: LandingRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const result = await db.insert(landingEvents).values(rows).onConflictDoNothing().returning({ logKey: landingEvents.logKey });
  return result.length;
}
```

- [ ] **Step 4: Add counters + per-object accumulator + scan branch + insert.** Inside `scheduled`:

  a. After `let missingVibeSkipped = 0;` (line 145):

```ts
let landingInserted = 0;
let landingSkipped = 0;
```

b. After `const missingVibeRows: MissingVibeRow[] = [];` (line 161):

```ts
const landingRows: LandingRow[] = [];
```

c. In the message scan, extend the `if/else if` chain (after the `[missing-vibe]` branch, line 184):

```ts
          } else if (message.startsWith("[landing]")) {
            const row = parseLandingLine(message, ts, key, idx);
            if (row !== null) landingRows.push(row);
          }
```

d. After the missing-vibe insert block (line 194):

```ts
const li = await batchInsertLanding(db, landingRows);
landingInserted += li;
landingSkipped += landingRows.length - li;
```

- [ ] **Step 5: Extend the summary log line.** Replace the `console.info(...)` at line 197-199 with:

```ts
console.info(
  `[logpush-etl] processed ${allKeys.length} objects — referer: inserted ${refererInserted}, skipped ${refererSkipped} — missing-vibe: inserted ${missingVibeInserted}, skipped ${missingVibeSkipped} — landing: inserted ${landingInserted}, skipped ${landingSkipped} (already present)`
);
```

- [ ] **Step 6: Typecheck the ETL worker**

Run (from `vibes.diy/api/logpush-etl/`): `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors. (If `tsconfig.json` has no `noEmit`-friendly setup, run `pnpm build` and expect the `core-cli tsc` step to pass.)

- [ ] **Step 7: Commit**

```bash
git add vibes.diy/api/logpush-etl/worker.ts
git commit -m "feat(etl): persist [landing] events to LandingEvents (#2333)"
```

---

## Task 4: Emit the `[landing]` log line in the app worker

**Files:**

- Modify: `vibes.diy/pkg/workers/app.ts:67-71` (beside the CAPI fire)

No unit test (the `fetch` handler is integration-level). Verification is typecheck + diff read. `parseVibePathname` is already imported at line 21.

- [ ] **Step 1: Emit the landing log.** In `vibes.diy/pkg/workers/app.ts`, directly after the existing CAPI block (after line 70, the `}` closing the `if (fbclid !== undefined && ...)`):

```ts
// Direct-to-app attribution (#2333): the ad lands straight on /vibe/* with the
// fbclid on the request URL (no good.vibes.diy second hop). Log it so the ETL can
// mine fbclid + utm_campaign. UA is the free-form tail (it contains spaces).
if (fbclid !== undefined && parseVibePathname(url.pathname) !== undefined) {
  console.log("[landing]", request.url, url.pathname, request.headers.get("User-Agent") ?? "");
}
```

- [ ] **Step 2: Typecheck the app worker**

Run (from `vibes.diy/`): `pnpm exec tsc --noEmit -p pkg/tsconfig.json`
Expected: no errors. (If that tsconfig path differs, use the repo's standard `pnpm fast-check` and confirm the build/typecheck step passes for `pkg`.)

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/pkg/workers/app.ts
git commit -m "feat(app): emit [landing] log for direct-app /vibe landings (#2333)"
```

---

## Task 5: Report — `fetchDirectAppLandings` + `extractDirectUtm`

**Files:**

- Modify: `vibes.diy/api/svc/public/report-campaign-health.ts` (after `fetchGoodVibesClickThroughs`, ~line 100)
- Test: `vibes.diy/api/tests/report-campaign-health-unit.test.ts` (append)

- [ ] **Step 1: Write the failing tests.** Append to `vibes.diy/api/tests/report-campaign-health-unit.test.ts`. First extend the import on line 5:

```ts
import { fetchGoodVibesClickThroughs, fetchDirectAppLandings, extractDirectUtm } from "../svc/public/report-campaign-health.js";
```

Then append these two top-level `describe` blocks at the end of the file:

```ts
describe("extractDirectUtm", () => {
  it("returns utm_campaign for a vibes.diy /vibe/ destination", () => {
    expect(extractDirectUtm("https://vibes.diy/vibe/og/cool?utm_campaign=direct-app-cool&fbclid=X")).toBe("direct-app-cool");
  });
  it("returns undefined for good.vibes.diy (good.vibes path is handled separately and wins)", () => {
    expect(extractDirectUtm("https://good.vibes.diy/page?utm_campaign=111")).toBeUndefined();
  });
  it("returns undefined for non-/vibe/ paths on vibes.diy", () => {
    expect(extractDirectUtm("https://vibes.diy/about?utm_campaign=x")).toBeUndefined();
  });
  it("returns undefined when utm_campaign is absent or empty", () => {
    expect(extractDirectUtm("https://vibes.diy/vibe/og/app")).toBeUndefined();
    expect(extractDirectUtm("https://vibes.diy/vibe/og/app?utm_campaign=")).toBeUndefined();
  });
  it("returns undefined for a malformed or missing URL", () => {
    expect(extractDirectUtm("not a url")).toBeUndefined();
    expect(extractDirectUtm(undefined)).toBeUndefined();
  });
  it("yields the same key for two campaigns sharing a destination (basis for shared flagging)", () => {
    const a = extractDirectUtm("https://vibes.diy/vibe/og/x?utm_campaign=direct-app-x");
    const b = extractDirectUtm("https://vibes.diy/vibe/og/x?utm_campaign=direct-app-x&fbclid=Z");
    expect(a).toBe(b);
    expect(a).toBe("direct-app-x");
  });
});

describe("fetchDirectAppLandings", () => {
  const sthis = ensureSuperThis();
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    const t = appCtx.vibesCtx.sql.tables;
    const mk = (logKey: string, lineIdx: number, ts: string, fbclid: string, utmCampaign: string) => ({
      logKey,
      lineIdx,
      ts,
      landHref: `https://vibes.diy/vibe/og/app?fbclid=${fbclid}&utm_campaign=${utmCampaign}`,
      landHost: "vibes.diy",
      landPath: "/vibe/og/app",
      fbclid,
      utmCampaign,
      ua: "Mozilla/5.0",
    });
    await appCtx.vibesCtx.sql.db.insert(t.landingEvents).values([
      mk("ld-1", 0, "2026-05-22T10:00:00Z", "AAA", "direct-app-foo"),
      mk("ld-1", 1, "2026-05-22T10:05:00Z", "AAA", "direct-app-foo"), // dup fbclid — counts once
      mk("ld-1", 2, "2026-05-23T09:00:00Z", "BBB", "direct-app-foo"),
      mk("ld-1", 3, "2026-05-23T11:00:00Z", "CCC", ""), // empty utm — excluded
      mk("ld-1", 4, "2026-06-01T00:00:00Z", "DDD", "direct-app-foo"), // after untilIso — excluded
      mk("ld-2", 0, "2026-05-24T10:00:00Z", "EEE", "direct-remix-bar"),
    ]);
  }, 10000);

  it("dedupes unique fbclid per utm_campaign", async () => {
    const result = await fetchDirectAppLandings(appCtx.vibesCtx, "2026-05-21", "2026-05-28");
    expect(result.byUtmCampaign["direct-app-foo"]).toBe(2); // AAA (once) + BBB
    expect(result.byUtmCampaign["direct-remix-bar"]).toBe(1);
  });

  it("excludes rows with empty utm_campaign", async () => {
    const result = await fetchDirectAppLandings(appCtx.vibesCtx, "2026-05-21", "2026-05-28");
    expect(Object.keys(result.byUtmCampaign)).not.toContain("");
  });

  it("excludes rows after untilIso", async () => {
    const result = await fetchDirectAppLandings(appCtx.vibesCtx, "2026-05-21", "2026-05-28");
    expect(result.byUtmCampaign["direct-app-foo"]).toBe(2); // DDD (June 1) excluded
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `vibes.diy/api/tests/`): `pnpm vitest run report-campaign-health-unit`
Expected: FAIL — `fetchDirectAppLandings` / `extractDirectUtm` are not exported.

- [ ] **Step 3: Implement both functions.** In `vibes.diy/api/svc/public/report-campaign-health.ts`, immediately after the `fetchGoodVibesClickThroughs` function (ends ~line 100):

```ts
export interface DirectAppLandings {
  byUtmCampaign: Record<string, number>;
}

// Direct-to-app attribution (#2333): count unique fbclid per utm_campaign from
// LandingEvents. Reads the parsed columns (no re-parse of landHref); landHref is
// the audit source. Rows with empty utm_campaign (organic fbclid shares) are skipped.
export async function fetchDirectAppLandings(vctx: VibesApiSQLCtx, sinceIso: string, untilIso: string): Promise<DirectAppLandings> {
  const t = vctx.sql.tables;
  const rows = await vctx.sql.db
    .select({ fbclid: t.landingEvents.fbclid, utmCampaign: t.landingEvents.utmCampaign })
    .from(t.landingEvents)
    .where(and(gte(t.landingEvents.ts, sinceIso), lte(t.landingEvents.ts, untilIso)));
  // Null-prototype object prevents user-supplied utm_campaign keys from shadowing
  // inherited properties like "constructor" or "__proto__".
  const byUtmCampaign: Record<string, Set<string>> = Object.create(null) as Record<string, Set<string>>;
  for (const r of rows) {
    if (r.fbclid === "" || r.utmCampaign === "") continue;
    (byUtmCampaign[r.utmCampaign] ??= new Set()).add(r.fbclid);
  }
  return {
    byUtmCampaign: Object.fromEntries(Object.entries(byUtmCampaign).map(([id, ids]) => [id, ids.size])),
  };
}

// Derive the direct-app join key from a campaign's own Meta destination URL.
// Gated on host vibes.diy + /vibe/* path + non-empty utm_campaign; never inferred
// from slug or campaign name. good.vibes.diy destinations return undefined (that path
// is attributed separately and takes precedence).
export function extractDirectUtm(websiteUrl: string | undefined): string | undefined {
  if (websiteUrl === undefined) return undefined;
  try {
    const u = new URL(websiteUrl);
    if (u.hostname !== "vibes.diy") return undefined;
    if (!u.pathname.startsWith("/vibe/")) return undefined;
    const utm = u.searchParams.get("utm_campaign");
    return utm !== null && utm !== "" ? utm : undefined;
  } catch {
    return undefined;
  }
}
```

(`and`, `gte`, `lte` are already imported from `drizzle-orm`; `VibesApiSQLCtx` is already imported.)

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `vibes.diy/api/tests/`): `pnpm vitest run report-campaign-health-unit`
Expected: PASS — the original `fetchGoodVibesClickThroughs` suite plus the new `extractDirectUtm` (6) and `fetchDirectAppLandings` (3) blocks.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/public/report-campaign-health.ts vibes.diy/api/tests/report-campaign-health-unit.test.ts
git commit -m "feat(report): fetchDirectAppLandings + extractDirectUtm (#2333)"
```

---

## Task 6: Report merge — wire direct attribution into campaign rows

**Files:**

- Modify: `vibes.diy/api/svc/public/report-campaign-health.ts` — `fetchCampaignHealth` Promise.all (~line 150), the `pathCampaignCount` pre-pass (~line 230), and the `.map` row builder (~line 246-281)
- Modify: `vibes.diy/api/types/report.ts:179` — add `directApp` field

No new test in this task (merge logic depends on the Meta API insights fetch, which is not unit-mocked; the join primitives are covered in Task 5). Verification is typecheck via `pnpm vitest run report-campaign-health-unit` (it imports the module, so a type error there fails the run) plus diff review.

- [ ] **Step 1: Add the `directApp` response field.** In `vibes.diy/api/types/report.ts`, inside `resReportCampaignHealthCampaignRow`, after the `"ctaClicksIsShared?": "boolean",` line (line 175):

```ts
  // true when ctaClicks is sourced from direct-to-app LandingEvents (LPV-ish), not a good.vibes.diy hop (#2333)
  "directApp?": "boolean",
```

- [ ] **Step 2: Fetch direct landings in the Promise.all.** In `fetchCampaignHealth`, replace the destructuring `Promise.all` (lines 150-153):

```ts
// Fetch campaign meta (URL + status) and referrer click-throughs in parallel with insights
const [campaignMeta, { byPath: clicksByPath, byCampaignId: clicksByCampaignId }, { byUtmCampaign: directLandingsByUtm }] =
  await Promise.all([
    fetchCampaignMeta(token, account),
    fetchGoodVibesClickThroughs(vctx, sinceIso, today),
    fetchDirectAppLandings(vctx, sinceIso, today),
  ]);
```

- [ ] **Step 3: Build the direct-key campaign count (for shared detection).** Immediately after the `pathCampaignCount` loop (ends ~line 244, just before `const ranked = ...`):

```ts
// Count campaigns per direct-app utm key to detect ambiguous/shared keys (#2333)
const directKeyCampaignCount: Record<string, number> = {};
for (const r of rows) {
  const du = extractDirectUtm(campaignMeta[r.campaign_id]?.website_url);
  if (du !== undefined) directKeyCampaignCount[du] = (directKeyCampaignCount[du] ?? 0) + 1;
}
```

- [ ] **Step 4: Source ctaClicks from direct landings as a fallback.** In the `.map` callback, replace the attribution block (lines 263-272, from `// Prefer per-campaign attribution` through `const costPerCtaClick = ...`):

```ts
// Direct-app fallback key (#2333): only when there's no good.vibes.diy landing path.
const directUtm = landingPath === undefined ? extractDirectUtm(websiteUrl) : undefined;
// Prefer per-campaign attribution (utm_campaign in refHref); then good.vibes path
// total; then direct-app landings.
const hasCampaignAttribution = r.campaign_id in clicksByCampaignId;
const directApp = !hasCampaignAttribution && directUtm !== undefined;
const ctaClicks = hasCampaignAttribution
  ? clicksByCampaignId[r.campaign_id]
  : landingPath !== undefined
    ? (clicksByPath[landingPath] ?? 0)
    : directUtm !== undefined
      ? (directLandingsByUtm[directUtm] ?? 0)
      : undefined;
// Shared when a good.vibes path is shared, OR when multiple campaigns derive the same direct key.
const ctaClicksIsShared =
  (!hasCampaignAttribution && landingPath !== undefined && (pathCampaignCount[landingPath] ?? 1) > 1) ||
  (directApp && (directKeyCampaignCount[directUtm] ?? 1) > 1);
const costPerCtaClick = ctaClicks !== undefined && ctaClicks > 0 ? Number(r.spend) / ctaClicks : undefined;
```

(`directApp` implies `directUtm !== undefined`, so `directKeyCampaignCount[directUtm]` needs no non-null assertion under `strictNullChecks` narrowing — TypeScript narrows `directUtm` to `string` inside the `directApp` short-circuit. If the compiler does not narrow across the `&&`, change to `directKeyCampaignCount[directUtm ?? ""]`.)

- [ ] **Step 5: Return the `directApp` flag.** In the returned row object (lines 274-283), after `ctaClicksIsShared: ctaClicksIsShared || undefined,`:

```ts
        directApp: directApp || undefined,
```

- [ ] **Step 6: Typecheck via the unit test run**

Run (from `vibes.diy/api/tests/`): `pnpm vitest run report-campaign-health-unit`
Expected: PASS (no type errors; existing assertions still green).

- [ ] **Step 7: Commit**

```bash
git add vibes.diy/api/svc/public/report-campaign-health.ts vibes.diy/api/types/report.ts
git commit -m "feat(report): attribute direct-app campaigns via website_url utm key (#2333)"
```

---

## Task 7: SPA — render + label direct-app rows

**Files:**

- Modify: `vibes.diy/pkg/reports-app/src/CampaignHealth.tsx` — `ctaRate` helper (~line 41), the campaign-name cell badge (~line 658), and the "Unique CTA Visitors" glossary entry (~line 555)

No unit test (presentation). Verification is typecheck + diff read. The `ctaClicks` cell already renders any defined count, so direct-app rows display automatically once `directApp` is set.

- [ ] **Step 1: Suppress the misleading Conv% for direct-app rows.** In `ctaRate` (line 41-46), add a guard at the top so a ~100% direct-app conversion isn't shown:

```ts
function ctaRate(row: ResReportCampaignHealthCampaignRow): number | null {
  if (row.directApp) return null; // direct-app has no good.vibes → app hop; Conv% is not meaningful
  if (row.ctaClicksIsShared) return null;
  const l = lpv(row);
  const c = row.ctaClicks;
  return l > 0 && c !== undefined ? c / l : null;
}
```

- [ ] **Step 2: Badge direct-app rows.** In the campaign-name `<td>`, after the `isPaused` badge block (the `{isPaused && ( ... )}` that ends ~line 657, before the expand-arrow `<span>`):

```tsx
{
  row.directApp && (
    <span
      style={{
        marginLeft: "0.5rem",
        fontSize: "0.65rem",
        fontWeight: "bold",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--gray-mid)",
      }}
    >
      direct
    </span>
  );
}
```

- [ ] **Step 3: Clarify the glossary tooltip.** In the glossary array, replace the `"Unique CTA Visitors"` definition string (the long entry at ~line 555) with one that appends the direct-app semantics:

```ts
              [
                "Unique CTA Visitors",
                "Distinct fbclid values from Meta-attributed sessions that clicked through from good.vibes.diy to vibes.diy (date-scoped to the report window). One user clicking multiple CTAs counts once. Organic visits without fbclid are excluded. — means no destination URL is set for the campaign. ~ prefix means multiple campaigns share this landing page and utm_campaign is not yet set — the count is a page-level total, not per-campaign; add utm_campaign to the ad URL to enable per-campaign attribution. Rows badged \"direct\" are direct-to-app campaigns: the count is unique fbclid sessions that loaded the vibe directly (LPV-ish), not a good.vibes.diy → vibes.diy hop.",
              ],
```

- [ ] **Step 4: Typecheck the reports app**

Run (from `vibes.diy/`): `pnpm exec tsc --noEmit -p pkg/tsconfig.json` (or the repo's standard `pnpm fast-check` covering `pkg`).
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/reports-app/src/CampaignHealth.tsx
git commit -m "feat(reports-app): render + label direct-app campaign rows (#2333)"
```

---

## Task 8: Full check, push, PR

**Files:** none (verification + integration)

- [ ] **Step 1: Run the full check.** From `vibes.diy/`:

```bash
pnpm check 2>&1 | tee /tmp/check-2333.log
```

Expected: format + build + test + lint all green. If a flaky failure appears, rerun the affected suite in isolation before treating it as real (see `agents/flaky-tests.md`).

- [ ] **Step 2: Prettier the changed files** (CI runs `prettier --check`):

```bash
npx prettier --write vibes.diy/api/sql/vibes-diy-api-schema-pg.ts vibes.diy/api/sql/vibes-diy-api-schema-sqlite.ts vibes.diy/api/sql/tables.ts vibes.diy/api/logpush-etl/parse-landing.ts vibes.diy/api/logpush-etl/worker.ts vibes.diy/pkg/workers/app.ts vibes.diy/api/svc/public/report-campaign-health.ts vibes.diy/api/types/report.ts vibes.diy/pkg/reports-app/src/CampaignHealth.tsx vibes.diy/api/tests/*.test.ts
```

Commit any formatting changes: `git commit -am "chore: prettier (#2333)"` (only if files changed).

- [ ] **Step 3: Push** to the existing PR branch:

```bash
git push
```

(Branch `jchris/fix-2333-direct-app-attribution` / PR #2347 already exist. Pushing updates the same PR, converting it from spec-only to the full implementation.)

- [ ] **Step 4: Update the PR body / comment** noting the implementation has landed, and re-request review from `CharlieHelps`. Keep the deploy note: the `LandingEvents` table is created by Drizzle schema in prod/Neon; the Logpush ETL cron populates it. Direct-app rows stay blank until landings accumulate in the report window after deploy.

---

## Notes for the implementer

- **Deploy/data note:** This adds capture + attribution. Existing direct-app campaigns will show counts only for landings that occur _after_ the app worker deploys (older traffic was never logged as `[landing]`). good.vibes.diy rows are unaffected from the first deploy.
- **No landing-pages change:** the join key comes from each campaign's Meta `website_url`. Do not modify the `landing-pages` repo or backfill ads.
- **Bots:** captured, not filtered in v1. The raw `User-Agent` is in `LandingEvents.ua` for later auditing.
- **Keep-in-sync trio:** `sqlLandingEvents` (pg) ↔ `sqlLandingEvents` (sqlite) ↔ inline `landingEvents` (ETL worker). Any column change touches all three.
