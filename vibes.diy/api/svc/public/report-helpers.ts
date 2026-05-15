import { EventoResult, EventoResultType, HandleTriggerCtx, Result } from "@adviser/cement";
import { HttpResponseJsonType } from "@vibes.diy/api-types";
import { DashAuthType } from "@fireproof/core-types-protocols-dashboard";
import { VibesApiSQLCtx } from "../types.js";
import { verifyAuth } from "../check-auth.js";

// Path-based reports gated by Clerk publicMetadata.reports.
// publicMetadata is templated into params.public_meta by the existing Clerk
// JWT template, so the gate is a claims read — no Clerk API roundtrip and
// no new env vars. ["*"] grants all reports; otherwise the report key
// must appear in the array.
export function hasReport(claims: { params?: { public_meta?: unknown } }, name: string): boolean {
  const pm = claims.params?.public_meta as { reports?: unknown } | undefined;
  const list = pm?.reports;
  if (!Array.isArray(list)) return false;
  return list.includes("*") || list.includes(name);
}

export function extractBearer(req: Request): string | undefined {
  const header = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!header) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : undefined;
}

export async function verifyAnyBearer(
  vctx: VibesApiSQLCtx,
  token: string
): Promise<{ userId: string; claims: { params?: { public_meta?: unknown } } } | undefined> {
  for (const type of Object.keys(vctx.tokenApi)) {
    const rAuth = await verifyAuth(vctx, { auth: { type, token } as DashAuthType });
    if (rAuth.isOk() && rAuth.Ok().type === "VerifiedAuthResult") {
      const claims = rAuth.Ok().verifiedAuth.claims as { userId: string; params?: { public_meta?: unknown } };
      return { userId: claims.userId, claims };
    }
  }
  return undefined;
}

export function last30DaysUTC(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

// Verify bearer + report tag in one step. Sends 401/403 and returns
// undefined on failure; returns the verified claims on success.
export async function authReport(
  ctx: HandleTriggerCtx<Request, unknown, unknown>,
  vctx: VibesApiSQLCtx,
  bearer: string,
  reportName: string
): Promise<{ userId: string; claims: { params?: { public_meta?: unknown } } } | undefined> {
  if (!bearer) {
    await ctx.send.send(ctx, {
      type: "http.Response.JSON",
      status: 401,
      json: { type: "error", message: "missing Authorization Bearer token" },
    } satisfies HttpResponseJsonType);
    return undefined;
  }
  const verified = await verifyAnyBearer(vctx, bearer);
  if (!verified) {
    await ctx.send.send(ctx, {
      type: "http.Response.JSON",
      status: 401,
      json: { type: "error", message: "invalid bearer token" },
    } satisfies HttpResponseJsonType);
    return undefined;
  }
  if (!hasReport(verified.claims, reportName)) {
    await ctx.send.send(ctx, {
      type: "http.Response.JSON",
      status: 403,
      json: { type: "error", message: `not authorized for ${reportName} report` },
    } satisfies HttpResponseJsonType);
    return undefined;
  }
  return verified;
}

export function reportStop(): Result<EventoResultType> {
  return Result.Ok(EventoResult.Stop);
}
