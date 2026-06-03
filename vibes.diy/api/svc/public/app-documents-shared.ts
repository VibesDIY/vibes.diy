import { DbAcl } from "@vibes.diy/api-types";
import { VibesApiSQLCtx } from "../types.js";
import { canRead, isPublicReadable, DocAccessLevel } from "./access-helpers.js";
import { aclAllows } from "./db-acl-resolver.js";
import { WSSendProvider } from "../svc-ws-send-provider.js";

export async function readAllowed(
  vctx: VibesApiSQLCtx,
  acl: DbAcl | undefined,
  access: DocAccessLevel,
  appSlug: string,
  ownerHandle: string
): Promise<boolean> {
  if (acl?.read !== undefined) return aclAllows(acl, "read", access);
  if (canRead(access)) return true;
  return isPublicReadable(vctx, appSlug, ownerHandle);
}

export function clientWsSend(ctx: { send: unknown }): WSSendProvider {
  return (ctx.send as { provider: WSSendProvider }).provider;
}

export function connectionAdminMode(ctx: { send: unknown }): boolean {
  const ws = clientWsSend(ctx);
  return ws.adminMode;
}
