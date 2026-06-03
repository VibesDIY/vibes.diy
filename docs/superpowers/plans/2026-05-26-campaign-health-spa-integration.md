# Campaign Health SPA Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/reports?report=campaign-health` as a browser-accessible Campaign Health view inside the existing reports SPA, authenticated via Clerk, data fetched over the existing WebSocket connection, rendered using the brand palette.

**Architecture:** New arktype types + WS handler mirror the existing `reportGrowthMemberships` pattern exactly. The reports SPA reads `?report=` query param to choose which view to render, fetching only that report's data. No changes to route-decision or app.ts — query strings don't affect path matching.

**Tech Stack:** arktype (type schemas), @adviser/cement (EventoHandler, checkAuth), vibes.diy WS message stack, React (SPA), existing brand-palette CSS vars.

**Spec:** `docs/superpowers/specs/2026-05-26-campaign-health-spa-integration-design.md`

---

## File Map

| Action | File                                                 | Responsibility                                                                   |
| ------ | ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| Modify | `vibes.diy/api/types/report.ts`                      | Add `reqReportCampaignHealth`, `resReportCampaignHealth`, sub-types, type-guards |
| Modify | `vibes.diy/api/svc/types.ts`                         | Add `metaAccessToken?`, `metaAdAccountId?`, `metaPixelId?` to `VibesApiSQLCtx`   |
| Modify | `vibes.diy/api/svc/create-handler.ts`                | Wire `META_*` env secrets into context (OPTIONAL)                                |
| Create | `vibes.diy/api/tests/report-campaign-health.test.ts` | Auth gate + missing-creds tests                                                  |
| Create | `vibes.diy/api/svc/public/report-campaign-health.ts` | WS handler: auth, Meta API call, cached response                                 |
| Modify | `vibes.diy/api/svc/vibes-msg-evento.ts`              | Register `reportCampaignHealthEvento`                                            |
| Modify | `vibes.diy/api/impl/index.ts`                        | Add `reportCampaignHealth` method to `VibesDiyApi`                               |
| Create | `vibes.diy/pkg/reports-app/src/CampaignHealth.tsx`   | Campaign Health view component (brand palette)                                   |
| Modify | `vibes.diy/pkg/reports-app/src/App.tsx`              | Accept `report` prop, add nav, conditional rendering                             |
| Modify | `vibes.diy/pkg/reports-app/src/main.tsx`             | Read `?report=` param, pass to `App`                                             |

---

### Task 1: Add types to `@vibes.diy/api-types`

**Files:**

- Modify: `vibes.diy/api/types/report.ts`

- [ ] **Step 1: Append new types to the end of `vibes.diy/api/types/report.ts`**

```typescript
// Campaign Health — Meta Ads campaign performance and pixel health.
// Data is fetched server-side from the Meta Graph API; the WS handler
// returns structured JSON so the SPA can render with the brand palette.

export const campaignRow = type({
  campaign_name: "string",
  campaign_id: "string",
  impressions: "string",
  clicks: "string",
  spend: "string",
  ctr: "string",
  cpc: "string",
  reach: "string",
  "actions?": type({ action_type: "string", value: "string" }).array(),
});
export type CampaignRow = typeof campaignRow.infer;

export const pixelSummary = type({
  "lastFired?": "string",
  "counts?": type({ "[string]": "number" }),
  "error?": "string",
});
export type PixelSummary = typeof pixelSummary.infer;

export const budgetOutlier = type({
  name: "string",
  spend: "string",
  medianSpend: "string",
});
export type BudgetOutlier = typeof budgetOutlier.infer;

export const lowLpvEntry = type({
  name: "string",
  clicks: "number",
  lpvs: "number",
  ratio: "number",
});
export type LowLpvEntry = typeof lowLpvEntry.infer;

export const campaignAnomalies = type({
  duplicateNames: "string[]",
  budgetOutliers: budgetOutlier.array(),
  zeroSpend: "string[]",
  lowLpvRatio: lowLpvEntry.array(),
  pixel: pixelSummary.or("null"),
});
export type CampaignAnomalies = typeof campaignAnomalies.infer;

export const reqReportCampaignHealth = type({
  type: "'vibes.diy.req-report-campaign-health'",
  auth: dashAuthType,
  "days?": "string",
  "since?": "string",
});
export type ReqReportCampaignHealth = typeof reqReportCampaignHealth.infer;
export function isReqReportCampaignHealth(obj: unknown): obj is ReqReportCampaignHealth {
  return !(reqReportCampaignHealth(obj) instanceof type.errors);
}

export const resReportCampaignHealth = type({
  type: "'vibes.diy.res-report-campaign-health'",
  generatedAt: "string",
  dateLabel: "string",
  ranked: campaignRow.array(),
  anomalies: campaignAnomalies,
});
export type ResReportCampaignHealth = typeof resReportCampaignHealth.infer;
export function isResReportCampaignHealth(obj: unknown): obj is ResReportCampaignHealth {
  return !(resReportCampaignHealth(obj) instanceof type.errors);
}
```

- [ ] **Step 2: Verify the file builds cleanly**

```bash
cd vibes.diy/api/types && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/api/types/report.ts
git commit -m "feat(api-types): add ReqReportCampaignHealth and ResReportCampaignHealth types"
```

---

### Task 2: Add Meta secrets to `VibesApiSQLCtx` and `create-handler.ts`

**Files:**

- Modify: `vibes.diy/api/svc/types.ts`
- Modify: `vibes.diy/api/svc/create-handler.ts`

- [ ] **Step 1: Add optional Meta fields to `VibesApiSQLCtx` in `vibes.diy/api/svc/types.ts`**

Locate the `prodiaToken?: string;` line (currently line ~53) and add three lines directly after it:

```typescript
  prodiaToken?: string;
  metaAccessToken?: string;
  metaAdAccountId?: string;
  metaPixelId?: string;
```

- [ ] **Step 2: Wire `META_*` env vars in `vibes.diy/api/svc/create-handler.ts`**

The `create-handler.ts` uses `param.REQUIRED` / `param.OPTIONAL` to declare env vars. Find the block where `PRODIA_TOKEN: param.OPTIONAL` is declared (around line 100) and add three lines after it:

```typescript
    PRODIA_TOKEN: param.OPTIONAL,

    META_ACCESS_TOKEN: param.OPTIONAL,
    META_AD_ACCOUNT_ID: param.OPTIONAL,
    META_PIXEL_ID: param.OPTIONAL,
```

Then find where `prodiaToken: envVals.PRODIA_TOKEN` is set in the returned context object (around line 273) and add three lines after it:

```typescript
    prodiaToken: envVals.PRODIA_TOKEN,
    metaAccessToken: envVals.META_ACCESS_TOKEN,
    metaAdAccountId: envVals.META_AD_ACCOUNT_ID,
    metaPixelId: envVals.META_PIXEL_ID,
```

- [ ] **Step 3: Verify types**

```bash
cd vibes.diy/api/svc && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/api/svc/types.ts vibes.diy/api/svc/create-handler.ts
git commit -m "feat(api-svc): add Meta API credential fields to VibesApiSQLCtx"
```

---

### Task 3: Write the failing test

**Files:**

- Create: `vibes.diy/api/tests/report-campaign-health.test.ts`

The test validates auth gate and missing-creds behaviour without calling the real Meta API. The test context (`createVibeDiyTestCtx`) doesn't set `metaAccessToken` etc, so a user with valid `campaign-health` permission will still hit the "creds missing" error path.

- [ ] **Step 1: Create `vibes.diy/api/tests/report-campaign-health.test.ts`**

```typescript
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { beforeAll, describe, expect, inject, it } from "vitest";
import { Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { cfServe, CFInject, noopCache, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { createTestUserWithPublicMeta } from "./create-test-user-with-public-meta.js";

const TIMEOUT = (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 10000;

describe("report-campaign-health", { timeout: TIMEOUT }, () => {
  const sthis = ensureSuperThis();
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let apiCampaign: VibesDiyApi;
  let apiStar: VibesDiyApi;
  let apiNoAccess: VibesDiyApi;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA);

    const fetchPair = TestFetchPair.create();
    const wsPair = TestWSPair.create();

    fetchPair.server.onServe(async (req: Request) => {
      return cfServe(
        req as unknown as CFRequest,
        {
          appCtx: appCtx.appCtx,
          cache: noopCache,
          drizzle: appCtx.vibesCtx.sql.db,
          webSocket: {
            connections: new Set(),
            webSocketPair: () => ({ client: wsPair.p1, server: wsPair.p2 }),
          },
        } as unknown as ExecutionContext & CFInject
      ) as unknown as Promise<Response>;
    });

    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);
    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    function makeApi(token: { type: "device-id"; token: string }): VibesDiyApi {
      return new VibesDiyApi({
        apiUrl: "http://localhost:8787/api",
        ws: wsPair.p1 as unknown as WebSocket,
        fetch: fetchPair.client.fetch,
        timeoutMs: 100000,
        getToken: async () => Result.Ok(token),
      });
    }

    const userCampaign = await createTestUserWithPublicMeta({
      sthis,
      deviceCA,
      userId: "tester-campaign",
      publicMeta: { reports: ["campaign-health"] },
    });
    apiCampaign = makeApi(await userCampaign.getDashBoardToken());

    const userStar = await createTestUserWithPublicMeta({
      sthis,
      deviceCA,
      userId: "tester-star-campaign",
      publicMeta: { reports: ["*"] },
    });
    apiStar = makeApi(await userStar.getDashBoardToken());

    const userNoAccess = await createTestUserWithPublicMeta({
      sthis,
      deviceCA,
      userId: "tester-noaccess-campaign",
      publicMeta: { reports: ["growth"] },
    });
    apiNoAccess = makeApi(await userNoAccess.getDashBoardToken());
  }, TIMEOUT);

  describe("auth gate", () => {
    it("wrong report key → report-not-authorized", async () => {
      const r = await apiNoAccess.reportCampaignHealth({});
      expect(r.isErr()).toBe(true);
      expect((r.Err() as { code?: string }).code).toBe("report-not-authorized");
    });

    it("['*'] permission + no Meta creds → meta-creds-missing", async () => {
      const r = await apiStar.reportCampaignHealth({});
      expect(r.isErr()).toBe(true);
      expect((r.Err() as { code?: string }).code).toBe("meta-creds-missing");
    });
  });

  describe("missing Meta credentials", () => {
    it("campaign-health permission + no Meta creds → meta-creds-missing", async () => {
      const r = await apiCampaign.reportCampaignHealth({});
      expect(r.isErr()).toBe(true);
      expect((r.Err() as { code?: string }).code).toBe("meta-creds-missing");
    });

    it("days param accepted alongside credential error", async () => {
      const r = await apiCampaign.reportCampaignHealth({ days: "30" });
      expect(r.isErr()).toBe(true);
      expect((r.Err() as { code?: string }).code).toBe("meta-creds-missing");
    });

    it("since param accepted alongside credential error", async () => {
      const r = await apiCampaign.reportCampaignHealth({ since: "2026-01-01" });
      expect(r.isErr()).toBe(true);
      expect((r.Err() as { code?: string }).code).toBe("meta-creds-missing");
    });
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails (method not yet defined)**

```bash
cd vibes.diy/tests && pnpm test --reporter=verbose report-campaign-health 2>&1 | tail -20
```

Expected: compile error or `reportCampaignHealth is not a function` — confirms the test is genuinely failing, not passing vacuously.

---

### Task 4: Write the WS handler

**Files:**

- Create: `vibes.diy/api/svc/public/report-campaign-health.ts`

- [ ] **Step 1: Create `vibes.diy/api/svc/public/report-campaign-health.ts`**

```typescript
import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  ReqReportCampaignHealth,
  ResReportCampaignHealth,
  ResError,
  ReqWithVerifiedAuth,
  VibesDiyError,
  W3CWebSocketEvent,
  reqReportCampaignHealth,
  resReportCampaignHealth,
  CampaignRow,
  CampaignAnomalies,
  PixelSummary,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { checkAuth } from "../check-auth.js";
import { VibesApiSQLCtx } from "../types.js";
import { cachedReport, hasReport } from "./report-cache.js";

const META_BASE = "https://graph.facebook.com/v19.0";

interface MetaInsightRow {
  readonly campaign_name: string;
  readonly campaign_id: string;
  readonly impressions: string;
  readonly clicks: string;
  readonly spend: string;
  readonly ctr: string;
  readonly cpc: string;
  readonly reach: string;
  readonly actions?: ReadonlyArray<{ readonly action_type: string; readonly value: string }>;
}

async function metaGet<T>(path: string, token: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${META_BASE}${path}${sep}access_token=${token}`);
  const json = (await res.json()) as T & { error?: { message: string } };
  if ((json as { error?: { message: string } }).error) {
    throw new Error(`Meta API: ${(json as { error: { message: string } }).error.message}`);
  }
  return json;
}

function lpv(row: MetaInsightRow): number {
  return Number(row.actions?.find((a) => a.action_type === "landing_page_view")?.value ?? 0);
}

function costPerLpv(row: MetaInsightRow): number {
  const l = lpv(row);
  return l > 0 ? Number(row.spend) / l : Infinity;
}

async function fetchCampaignHealth(
  token: string,
  account: string,
  pixelId: string,
  days: string,
  since: string | undefined
): Promise<ResReportCampaignHealth> {
  const dateParam = since
    ? `&time_range=${encodeURIComponent(JSON.stringify({ since, until: new Date().toISOString().slice(0, 10) }))}`
    : `&date_preset=last_${days}d`;
  const dateLabel = since ? `since ${since}` : `last ${days} days`;

  const fields = "campaign_name,campaign_id,impressions,clicks,spend,ctr,cpc,reach,actions";
  const insights = await metaGet<{ data?: MetaInsightRow[]; error?: { message: string } }>(
    `/${account}/insights?fields=${fields}&level=campaign&limit=100${dateParam}`,
    token
  );
  const rows: MetaInsightRow[] = insights.data ?? [];

  let pixel: PixelSummary | null = null;
  try {
    const px = await metaGet<{
      name?: string;
      last_fired_time?: string;
      stats?: { data?: ReadonlyArray<{ data?: ReadonlyArray<{ value: string; count: string }> }> };
      error?: { message: string };
    }>(`/${pixelId}?fields=name,last_fired_time,stats`, token);
    const events = px.stats?.data?.flatMap((h) => h.data ?? []) ?? [];
    const sum: Record<string, number> = {};
    for (const e of events) {
      sum[e.value] = (sum[e.value] ?? 0) + Number(e.count);
    }
    pixel = { lastFired: px.last_fired_time, counts: sum };
  } catch (e) {
    pixel = { error: (e as Error).message };
  }

  const nameCounts: Record<string, number> = {};
  for (const r of rows) nameCounts[r.campaign_name] = (nameCounts[r.campaign_name] ?? 0) + 1;
  const duplicateNames = Object.entries(nameCounts)
    .filter(([, n]) => n > 1)
    .map(([name]) => name);

  const spends = rows.map((r) => Number(r.spend)).sort((a, b) => a - b);
  const medianSpend = spends[Math.floor(spends.length / 2)] ?? 0;

  const zeroSpend = rows.filter((r) => Number(r.spend) === 0).map((r) => r.campaign_name);
  const budgetOutliers = rows
    .filter((r) => Number(r.spend) > 0 && Number(r.spend) < medianSpend * 0.4)
    .map((r) => ({ name: r.campaign_name, spend: Number(r.spend).toFixed(2), medianSpend: medianSpend.toFixed(2) }));

  const lowLpvRatio = rows
    .filter((r) => Number(r.clicks) >= 5)
    .map((r) => ({ name: r.campaign_name, clicks: Number(r.clicks), lpvs: lpv(r), ratio: lpv(r) / Number(r.clicks) }))
    .filter((r) => r.ratio < 0.6 && r.clicks > 0);

  const ranked = [...rows].sort((a, b) => costPerLpv(a) - costPerLpv(b)) as CampaignRow[];

  const anomalies: CampaignAnomalies = { duplicateNames, budgetOutliers, zeroSpend, lowLpvRatio, pixel };

  return {
    type: "vibes.diy.res-report-campaign-health",
    generatedAt: new Date().toISOString(),
    dateLabel,
    ranked,
    anomalies,
  } satisfies ResReportCampaignHealth;
}

export const reportCampaignHealthEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqReportCampaignHealth>,
  ResReportCampaignHealth | VibesDiyError
> = {
  hash: "vibes.diy.req-report-campaign-health",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqReportCampaignHealth(msg.payload);
    if (ret instanceof type.errors) return Result.Ok(Option.None());
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqReportCampaignHealth>>,
        ResReportCampaignHealth | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      if (hasReport(req._auth.verifiedAuth.claims, "campaign-health") === false) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.error",
          message: "not authorized for campaign-health report",
          code: "report-not-authorized",
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      const token = vctx.metaAccessToken;
      const account = vctx.metaAdAccountId;
      const pixelId = vctx.metaPixelId;

      if (!token || !account || !pixelId) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.error",
          message: "Meta API credentials not configured (META_ACCESS_TOKEN, META_AD_ACCOUNT_ID, META_PIXEL_ID)",
          code: "meta-creds-missing",
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      const days = req.days ?? "7";
      const since = req.since;
      const cacheKey = since ? `campaign-health:since:${since}` : `campaign-health:days:${days}`;

      let res: ResReportCampaignHealth;
      try {
        res = await cachedReport(vctx, cacheKey, resReportCampaignHealth, () =>
          fetchCampaignHealth(token, account, pixelId, days, since)
        );
      } catch (e) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.error",
          message: `Meta API error: ${(e as Error).message}`,
          code: "meta-api-error",
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      await ctx.send.send(ctx, res);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
```

- [ ] **Step 2: Verify the handler compiles**

```bash
cd vibes.diy/api/svc && npx tsc --noEmit
```

Expected: no errors.

---

### Task 5: Register the handler in `vibes-msg-evento.ts`

**Files:**

- Modify: `vibes.diy/api/svc/vibes-msg-evento.ts`

- [ ] **Step 1: Add the import after the last report import (line ~59)**

Find the line:

```typescript
import { reportAttributionReferrersEvento } from "./public/report-attribution-referrers.js";
```

Add directly after it:

```typescript
import { reportCampaignHealthEvento } from "./public/report-campaign-health.js";
```

- [ ] **Step 2: Register the handler in the evento.push() call**

Find the line:

```typescript
    reportAttributionReferrersEvento,
```

Add directly after it:

```typescript
    reportCampaignHealthEvento,
```

- [ ] **Step 3: Verify it compiles**

```bash
cd vibes.diy/api/svc && npx tsc --noEmit
```

Expected: no errors.

---

### Task 6: Add `reportCampaignHealth` to `VibesDiyApi`

**Files:**

- Modify: `vibes.diy/api/impl/index.ts`

- [ ] **Step 1: Add imports**

In `vibes.diy/api/impl/index.ts`, find the existing report imports block (around line 148–150):

```typescript
  ReqReportAttributionReferrers,
  ResReportAttributionReferrers,
  isResReportAttributionReferrers,
```

Add directly after:

```typescript
  ReqReportCampaignHealth,
  ResReportCampaignHealth,
  isResReportCampaignHealth,
```

- [ ] **Step 2: Add the method**

Find the `reportAttributionReferrers` method (around line 768) and add directly after its closing brace:

```typescript
  reportCampaignHealth(
    req: ReqType<ReqReportCampaignHealth>
  ): Promise<Result<ResReportCampaignHealth, VibesDiyError>> {
    return this.request(
      { ...req, type: "vibes.diy.req-report-campaign-health" },
      { resMatch: isResReportCampaignHealth }
    );
  }
```

- [ ] **Step 3: Verify it compiles**

```bash
cd vibes.diy/api/impl && npx tsc --noEmit
```

Expected: no errors.

---

### Task 7: Run the backend tests

- [ ] **Step 1: Run the campaign-health test suite**

```bash
cd vibes.diy/tests && pnpm test --reporter=verbose report-campaign-health 2>&1 | tail -30
```

Expected: all 5 tests pass (auth gate ×1, missing-creds ×3, `[*]` ×1).

- [ ] **Step 2: Run the full API test suite to check for regressions**

```bash
cd vibes.diy/tests && pnpm test 2>&1 | tail -20
```

Expected: all existing tests still pass. If a test is flaky, check `agents/flaky-tests.md` and rerun before treating it as a real failure.

- [ ] **Step 3: Commit backend work**

```bash
git add \
  vibes.diy/api/types/report.ts \
  vibes.diy/api/svc/types.ts \
  vibes.diy/api/svc/create-handler.ts \
  vibes.diy/api/svc/public/report-campaign-health.ts \
  vibes.diy/api/svc/vibes-msg-evento.ts \
  vibes.diy/api/impl/index.ts \
  vibes.diy/api/tests/report-campaign-health.test.ts
git commit -m "feat(reports): add reportCampaignHealth WS handler and types"
```

---

### Task 8: Build the `CampaignHealth` component

**Files:**

- Create: `vibes.diy/pkg/reports-app/src/CampaignHealth.tsx`

- [ ] **Step 1: Create `vibes.diy/pkg/reports-app/src/CampaignHealth.tsx`**

```tsx
import React, { useEffect, useState } from "react";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import type { ResReportCampaignHealth, CampaignRow, CampaignAnomalies, PixelSummary } from "@vibes.diy/api-types";

type Loadable<T> =
  | { readonly kind: "loading" }
  | { readonly kind: "ok"; readonly data: T }
  | { readonly kind: "err"; readonly msg: string };

function lpv(row: CampaignRow): number {
  return Number(row.actions?.find((a) => a.action_type === "landing_page_view")?.value ?? 0);
}

function costPerLpv(row: CampaignRow): number {
  const l = lpv(row);
  return l > 0 ? Number(row.spend) / l : Infinity;
}

function costPerLpvStr(row: CampaignRow): string {
  const c = costPerLpv(row);
  return c === Infinity ? "—" : `$${c.toFixed(2)}`;
}

function lpvColor(row: CampaignRow): string {
  const c = costPerLpv(row);
  if (c < 0.3) return "var(--cyan)";
  if (c <= 0.5) return "var(--yellow)";
  return "var(--red)";
}

function shortName(name: string): string {
  return name.replace(/^vibes-diy-|-2026-\d\d-\d\d$/g, "");
}

function CampaignTable({
  ranked,
  dupes,
}: {
  readonly ranked: readonly CampaignRow[];
  readonly dupes: ReadonlySet<string>;
}): React.ReactElement {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid var(--near-black)" }}>
            <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Campaign</th>
            <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>CTR</th>
            <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>CPC</th>
            <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>LPVs</th>
            <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Cost/LPV</th>
            <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Spend</th>
            <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Reach</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((row, i) => (
            <tr
              key={row.campaign_id}
              style={{
                borderBottom: "1px solid color-mix(in srgb, var(--near-black) 15%, transparent)",
                background: i % 2 === 0 ? "transparent" : "color-mix(in srgb, var(--near-black) 4%, transparent)",
              }}
            >
              <td style={{ padding: "0.4rem 0.75rem" }}>
                {shortName(row.campaign_name)}
                {dupes.has(row.campaign_name) && (
                  <span style={{ color: "var(--red)", fontSize: "0.7rem", marginLeft: "0.4rem" }}>⚠ dupe</span>
                )}
              </td>
              <td style={{ padding: "0.4rem 0.75rem", textAlign: "right", fontFamily: "monospace" }}>
                {Number(row.ctr).toFixed(2)}%
              </td>
              <td style={{ padding: "0.4rem 0.75rem", textAlign: "right", fontFamily: "monospace" }}>
                ${Number(row.cpc).toFixed(2)}
              </td>
              <td style={{ padding: "0.4rem 0.75rem", textAlign: "right", fontFamily: "monospace" }}>{lpv(row)}</td>
              <td
                style={{
                  padding: "0.4rem 0.75rem",
                  textAlign: "right",
                  fontFamily: "monospace",
                  color: lpvColor(row),
                  fontWeight: "bold",
                }}
              >
                {costPerLpvStr(row)}
              </td>
              <td style={{ padding: "0.4rem 0.75rem", textAlign: "right", fontFamily: "monospace" }}>
                ${Number(row.spend).toFixed(2)}
              </td>
              <td style={{ padding: "0.4rem 0.75rem", textAlign: "right", fontFamily: "monospace" }}>
                {Number(row.reach).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PixelCard({ pixel }: { readonly pixel: PixelSummary | null }): React.ReactElement {
  if (pixel === null) return <div className="empty">Pixel data unavailable.</div>;
  if (pixel.error) {
    return (
      <div className="err">
        <div className="err-label">Pixel Error</div>
        <div>{pixel.error}</div>
      </div>
    );
  }
  return (
    <div>
      <p style={{ marginBottom: "0.5rem" }}>Last fired: {pixel.lastFired ?? "unknown"}</p>
      {pixel.counts && Object.keys(pixel.counts).length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--near-black)" }}>
                <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Event</th>
                <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(pixel.counts).map(([event, count]) => (
                <tr key={event} style={{ borderBottom: "1px solid color-mix(in srgb, var(--near-black) 15%, transparent)" }}>
                  <td style={{ padding: "0.4rem 0.75rem", fontFamily: "monospace" }}>{event}</td>
                  <td style={{ padding: "0.4rem 0.75rem", textAlign: "right", fontFamily: "monospace" }}>
                    {count.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AnomalyList({ anomalies }: { readonly anomalies: CampaignAnomalies }): React.ReactElement {
  return (
    <ul style={{ paddingLeft: "1.25rem", lineHeight: "1.8", fontSize: "0.9rem" }}>
      {anomalies.duplicateNames.map((name) => (
        <li key={`dupe-${name}`}>
          <strong>Duplicate name:</strong> {name}
        </li>
      ))}
      {anomalies.zeroSpend.map((name) => (
        <li key={`zero-${name}`}>
          <strong>Zero spend:</strong> {name}
        </li>
      ))}
      {anomalies.budgetOutliers.map((o) => (
        <li key={`outlier-${o.name}`}>
          <strong>Underspend:</strong> {o.name} (${o.spend} vs median ${o.medianSpend})
        </li>
      ))}
      {anomalies.lowLpvRatio.map((o) => (
        <li key={`lpv-${o.name}`}>
          <strong>Low LPV ratio:</strong> {o.name} ({o.lpvs}/{o.clicks} = {(o.ratio * 100).toFixed(0)}%)
        </li>
      ))}
    </ul>
  );
}

export function CampaignHealth({ api }: { readonly api: VibesDiyApi }): React.ReactElement {
  const [report, setReport] = useState<Loadable<ResReportCampaignHealth>>({ kind: "loading" });

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      const r = await api.reportCampaignHealth({});
      if (ac.signal.aborted) return;
      if (r.isOk()) setReport({ kind: "ok", data: r.Ok() });
      else setReport({ kind: "err", msg: r.Err().message });
    })();
    return () => ac.abort();
  }, [api]);

  if (report.kind === "loading") return <div className="empty">Loading campaign data…</div>;
  if (report.kind === "err") {
    return (
      <div className="err">
        <div className="err-label">Error</div>
        <div>{report.msg}</div>
      </div>
    );
  }

  const { ranked, anomalies, dateLabel, generatedAt } = report.data;
  const dupes = new Set(anomalies.duplicateNames);
  const hasAnomalies =
    anomalies.duplicateNames.length > 0 ||
    anomalies.zeroSpend.length > 0 ||
    anomalies.budgetOutliers.length > 0 ||
    anomalies.lowLpvRatio.length > 0;

  return (
    <div>
      <section>
        <div className="card">
          <span className="section-label section-label--filled">{dateLabel}</span>
          <h2 className="section-title">Ad Performance</h2>
          <p className="section-intro">
            Campaigns ranked by cost-per-landing-page-view. <span style={{ color: "var(--cyan)", fontWeight: "bold" }}>Cyan</span>{" "}
            &lt; $0.30 · <span style={{ color: "var(--yellow)", fontWeight: "bold" }}>Yellow</span> $0.30–$0.50 ·{" "}
            <span style={{ color: "var(--red)", fontWeight: "bold" }}>Red</span> &gt; $0.50
          </p>
          {ranked.length === 0 ? (
            <div className="empty">No campaign data for this period.</div>
          ) : (
            <CampaignTable ranked={ranked} dupes={dupes} />
          )}
          <p style={{ fontSize: "0.75rem", color: "var(--gray-mid)", marginTop: "1rem" }}>
            Generated {new Date(generatedAt).toLocaleString()}
          </p>
        </div>
      </section>

      <section>
        <div className="card">
          <span className="section-label section-label--filled">Pixel</span>
          <h2 className="section-title">Pixel Health</h2>
          <PixelCard pixel={anomalies.pixel} />
        </div>
      </section>

      <section>
        <div className="card">
          <span className="section-label section-label--filled">Anomalies</span>
          <h2 className="section-title">Flags</h2>
          {hasAnomalies ? <AnomalyList anomalies={anomalies} /> : <div className="empty">✓ No anomalies detected</div>}
        </div>
      </section>
    </div>
  );
}
```

---

### Task 9: Update `App.tsx` and `main.tsx` for routing and nav

**Files:**

- Modify: `vibes.diy/pkg/reports-app/src/App.tsx`
- Modify: `vibes.diy/pkg/reports-app/src/main.tsx`

- [ ] **Step 1: Update `App.tsx` — add `report` prop, nav bar, and conditional rendering**

Replace the `AppProps` interface and `App` function signature. The nav sits between the top `<ColorStripe />` and the main content. The existing growth sections only mount when `report !== "campaign-health"`.

At the top of `App.tsx`, add the import for `CampaignHealth`:

```typescript
import { CampaignHealth } from "./CampaignHealth.js";
```

Replace the `AppProps` interface:

```typescript
interface AppProps {
  readonly getClerkToken: () => Promise<string | null>;
  readonly report: string;
}
```

Replace the `App` function signature and add the nav + conditional rendering. The full new `App` function body (keeping all existing logic for the growth view):

```typescript
export function App({ getClerkToken, report }: AppProps) {
  const clerk = useClerk();
  const apiRef = useRef<VibesDiyApi | undefined>(undefined);

  if (apiRef.current === undefined) {
    apiRef.current = new VibesDiyApi({
      apiUrl: deriveApiUrl(),
      shardKey: "reports",
      getToken: async () => {
        const token = await getClerkToken();
        if (token === null) return Result.Err("no clerk token");
        return Result.Ok({ type: "clerk", token });
      },
    });
  }
  const api = apiRef.current;

  const [memberships, setMemberships] = useState<Loadable<ResReportGrowthMemberships>>({ kind: "loading" });
  const [vibes, setVibes] = useState<Loadable<ResReportGrowthVibesWithData>>({ kind: "loading" });
  const [referrers, setReferrers] = useState<Loadable<ResReportAttributionReferrers>>({ kind: "loading" });
  const [referrerFilter, setReferrerFilter] = useState<string | undefined>(undefined);

  const isCampaignHealth = report === "campaign-health";

  useEffect(() => {
    if (isCampaignHealth) return;
    const ac = new AbortController();
    void (async () => {
      const [m, v] = await Promise.all([api.reportGrowthMemberships({}), api.reportGrowthVibesWithData({})]);
      if (ac.signal.aborted) return;
      if (m.isOk()) setMemberships({ kind: "ok", data: m.Ok() });
      else setMemberships({ kind: "err", msg: m.Err().message });
      if (v.isOk()) setVibes({ kind: "ok", data: v.Ok() });
      else setVibes({ kind: "err", msg: v.Err().message });
    })();
    return () => ac.abort();
  }, [api, isCampaignHealth]);

  useEffect(() => {
    if (isCampaignHealth) return;
    const ac = new AbortController();
    setReferrers({ kind: "loading" });
    void (async () => {
      const r = await api.reportAttributionReferrers(referrerFilter !== undefined ? { reqPath: referrerFilter } : {});
      if (ac.signal.aborted) return;
      if (r.isOk()) setReferrers({ kind: "ok", data: r.Ok() });
      else setReferrers({ kind: "err", msg: r.Err().message });
    })();
    return () => ac.abort();
  }, [api, referrerFilter, isCampaignHealth]);

  return (
    <div className="page">
      <ColorStripe />

      <nav style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <a
          href="/reports"
          className="section-label"
          style={!isCampaignHealth ? { background: "var(--black)", color: "var(--cream)", borderColor: "var(--black)" } : {}}
        >
          Growth
        </a>
        <a
          href="/reports?report=campaign-health"
          className="section-label"
          style={isCampaignHealth ? { background: "var(--black)", color: "var(--cream)", borderColor: "var(--black)" } : {}}
        >
          Campaign Health
        </a>
      </nav>

      {isCampaignHealth ? (
        <CampaignHealth api={api} />
      ) : (
        <>
          <div className="grid-2-1">
            <div
              className="card card--hero hero"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                position: "relative",
                gap: "1rem",
              }}
            >
              <VibesDiyLogo />
              <span className="section-label" style={{ position: "absolute", left: "1.25rem", bottom: "1.25rem", marginBottom: 0 }}>
                Growth Report
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="card card--red callout">
                <span className="section-label" style={{ borderColor: "var(--cream)", color: "var(--cream)" }}>
                  Builders Joining
                </span>
                <Metric loadable={memberships} pick={(d) => d.total} accent="cream" />
                <p style={{ color: "rgba(255,255,255,0.85)" }}>Non-owner users with durable access to one specific vibe.</p>
              </div>
              <div className="card card--yellow callout">
                <span className="section-label" style={{ borderColor: "var(--black)", color: "var(--black)" }}>
                  Vibes With Data
                </span>
                <Metric loadable={vibes} pick={(d) => d.total} accent="black" />
                <p style={{ color: "var(--near-black)" }}>Distinct userHandle/appSlug pairs in AppSlugBindings.</p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1.5rem" }}>
            <button className="btn" onClick={() => void clerk.signOut()}>
              Sign out
            </button>
          </div>

          <section>
            <div className="card">
              <span className="section-label section-label--filled">30 Days</span>
              <h2 className="section-title">Memberships over time</h2>
              <p className="section-intro">
                Daily cumulative total of currently active memberships. One non-owner user with durable access to one specific vibe by
                approved request or accepted invite counts as one membership. Hover any point to see who joined that day.
              </p>
              {memberships.kind === "loading" ? (
                <div className="empty">Loading…</div>
              ) : memberships.kind === "err" ? (
                <ErrorPanel msg={memberships.msg} />
              ) : (
                <MembershipsChart data={memberships.data} />
              )}
            </div>
          </section>

          <section>
            <div className="card">
              <span className="section-label section-label--filled">30 Days</span>
              <h2 className="section-title">Vibes with data over time</h2>
              <p className="section-intro">
                Daily cumulative total of vibes with Fireproof data written by their owner. Each distinct userHandle/appSlug pair in
                AppSlugBindings counts as one active vibe.
              </p>
              {vibes.kind === "loading" ? (
                <div className="empty">Loading…</div>
              ) : vibes.kind === "err" ? (
                <ErrorPanel msg={vibes.msg} />
              ) : (
                <VibesWithDataChart data={vibes.data} />
              )}
            </div>
          </section>

          <section>
            <div className="card">
              <span className="section-label section-label--filled">All time</span>
              <h2 className="section-title">Referrer attribution</h2>
              <p className="section-intro">External pages ranked by traffic to vibes.diy. Click a landing-page path to drill down.</p>
              {referrerFilter !== undefined && (
                <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ fontFamily: "monospace", fontSize: "0.875rem", color: "var(--red)" }}>{referrerFilter}</span>
                  <button
                    className="btn"
                    style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem" }}
                    onClick={() => setReferrerFilter(undefined)}
                  >
                    ← All traffic
                  </button>
                </div>
              )}
              {referrers.kind === "loading" ? (
                <div className="empty">Loading…</div>
              ) : referrers.kind === "err" ? (
                <ErrorPanel msg={referrers.msg} />
              ) : referrers.data.rows.length === 0 ? (
                <div className="empty">No referrer data yet.</div>
              ) : (
                <ReferrersTable data={referrers.data} onDrillDown={setReferrerFilter} activeFilter={referrerFilter} />
              )}
            </div>
          </section>

          {referrers.kind === "ok" && referrers.data.legacyVibeRows.length > 0 && referrerFilter === undefined && (
            <section>
              <div className="card">
                <span className="section-label section-label--filled">Needs repair</span>
                <h2 className="section-title">Legacy vibes needing repair</h2>
                <p className="section-intro">
                  Old <code style={{ fontFamily: "monospace" }}>/vibe/&lt;slug&gt;</code> paths with inbound traffic that are
                  redirecting to dead paths. Sorted by traffic — fix the highest-traffic ones first.
                </p>
                <LegacyVibesTable rows={referrers.data.legacyVibeRows} />
              </div>
            </section>
          )}
        </>
      )}

      <ColorStripe />
    </div>
  );
}
```

- [ ] **Step 2: Update `main.tsx` — read `?report=` and pass it as a prop**

In `vibes.diy/pkg/reports-app/src/main.tsx`, find `AuthedShell` and replace it:

```typescript
function AuthedShell() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  if (isLoaded === false) return <Loading msg="loading session…" />;
  if (isSignedIn === false) {
    return (
      <div className="signin-wrap">
        <SignIn routing="hash" forceRedirectUrl="/reports/" />
      </div>
    );
  }
  const report = new URLSearchParams(window.location.search).get("report") ?? "growth";
  return <App getClerkToken={() => getToken({ template: "with-email" })} report={report} />;
}
```

- [ ] **Step 3: Run type check on the SPA**

```bash
cd vibes.diy/pkg && npx tsc --noEmit -p reports-app/tsconfig.json 2>/dev/null || npx tsc --noEmit
```

Expected: no errors.

---

### Task 10: Run full checks and commit SPA

- [ ] **Step 1: Run prettier on changed files**

```bash
npx prettier --write \
  vibes.diy/pkg/reports-app/src/App.tsx \
  vibes.diy/pkg/reports-app/src/main.tsx \
  vibes.diy/pkg/reports-app/src/CampaignHealth.tsx
```

- [ ] **Step 2: Run pnpm fast-check**

```bash
cd vibes.diy && pnpm fast-check 2>&1 | tee /tmp/fast-check.log
grep -E "error|FAIL|pass" /tmp/fast-check.log | tail -20
```

Expected: no TypeScript errors, no test failures. If flaky tests appear, see `agents/flaky-tests.md`.

- [ ] **Step 3: Commit SPA work**

```bash
git add \
  vibes.diy/pkg/reports-app/src/App.tsx \
  vibes.diy/pkg/reports-app/src/main.tsx \
  vibes.diy/pkg/reports-app/src/CampaignHealth.tsx
git commit -m "feat(reports-app): add Campaign Health tab at /reports?report=campaign-health"
```

- [ ] **Step 4: Open a PR**

```bash
git push -u origin HEAD
gh pr create \
  --title "feat(reports): Campaign Health at /reports?report=campaign-health" \
  --body "$(cat <<'EOF'
## Summary

- Adds \`/reports?report=campaign-health\` as a browser-accessible Campaign Health view inside the existing reports SPA
- Auth via Clerk (same as the Growth report) — no Bearer header required from the browser
- Data fetched over the existing WebSocket connection using the same \`VibesDiyApi\` instance
- Renders with the brand palette (red/cyan/yellow/cream/near-black) using existing CSS classes
- Nav bar at the top of \`/reports\` links between Growth and Campaign Health views
- Only the selected report's WS request fires — no simultaneous DB + Meta calls

Supersedes the curl-only Bearer endpoint approach from PR #1935.
Closes #1930

## Test plan

- [ ] Sign in at \`/reports\` — Growth view loads as before
- [ ] Click \"Campaign Health\" nav link — URL becomes \`/reports?report=campaign-health\`, Campaign Health view loads
- [ ] Click \"Growth\" nav link — back to growth view
- [ ] Direct navigation to \`/reports?report=campaign-health\` — Clerk sign-in if not authenticated, then Campaign Health
- [ ] User without \`campaign-health\` report key sees an error message in the Campaign Health view
- [ ] Backend tests: \`cd vibes.diy/tests && pnpm test report-campaign-health\` — all pass

## Secrets required in the Worker (staging + prod)

\`\`\`
wrangler secret put META_ACCESS_TOKEN
wrangler secret put META_AD_ACCOUNT_ID  # act_XXXXXXXXXX
wrangler secret put META_PIXEL_ID
\`\`\`

See \`landing-pages/agents/meta-ads-setup.md\` for token refresh runbook.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Notes

**Spec coverage:**

- ✅ `/reports?report=campaign-health` browser-accessible URL
- ✅ Clerk auth (same as other reports) — no separate Bearer flow
- ✅ WS data fetch via `api.reportCampaignHealth({})`
- ✅ Brand palette, existing CSS classes only
- ✅ Nav link from `/reports` to Campaign Health
- ✅ Only selected report's data fetched (growth effects guard-by `isCampaignHealth`)
- ✅ `hasReport(claims, "campaign-health")` auth gate
- ✅ `META_*` secrets in `VibesApiSQLCtx` and `create-handler.ts`
- ✅ Remove dead HTTP handler — N/A, it never landed on `main`

**Type consistency:** `CampaignRow`, `CampaignAnomalies`, `PixelSummary` defined in Task 1 and used consistently in Tasks 4 and 8. `reportCampaignHealth` method defined in Task 6 and used in the test (Task 3) and CampaignHealth component (Task 8). `ResReportCampaignHealth` shape matches what `fetchCampaignHealth` returns via `satisfies`.

**`ReqType<T>`:** Used in Task 6 for `reportCampaignHealth(req: ReqType<ReqReportCampaignHealth>)` — this is `Omit<T, "auth"> & OptionalAuth`, which strips the mandatory `auth` field the client fills in. Same as all other report methods.
