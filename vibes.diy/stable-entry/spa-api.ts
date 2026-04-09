import { parse as parseCookies, serialize as serializeCookie } from "cookie";
import { exception2Result } from "@adviser/cement";
import type { Env, ApiResponse } from "./types.js";
import { getBackendConfig, ROUTING_COOKIE, API_PATH } from "./types.js";

export function parseRoutingCookie(cookieHeader: string): Record<string, string> {
  const raw = parseCookies(cookieHeader)[ROUTING_COOKIE];
  if (!raw) return {};
  const result = exception2Result(() => JSON.parse(decodeURIComponent(raw)) as Record<string, string>);
  return result.isOk() ? result.Ok() : {};
}

function buildRoutes(env: Env, routingGroups: Record<string, string>): ApiResponse["routes"] {
  const rCfg = getBackendConfig(env.BACKEND_CFG);
  if (rCfg.isErr()) return {};
  const cfg = rCfg.Ok();
  return Object.fromEntries(
    Object.entries(cfg).map(([path, groups]) => [
      path,
      Object.entries(groups).map(([key, t]) => ({
        key,
        desc: t.desc,
        active: key === "*" ? !routingGroups[path] : routingGroups[path] === key,
      })),
    ])
  );
}

function handleGet(request: Request, env: Env): Response {
  const routingGroups = parseRoutingCookie(request.headers.get("cookie") ?? "");
  return Response.json({ routes: buildRoutes(env, routingGroups), cookie: routingGroups } satisfies ApiResponse);
}

export function updateRoutingCookie(routingGroups: Record<string, string>, path: string, key: string): string {
  if (key === "*") {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete routingGroups[path];
  } else {
    routingGroups[path] = key;
  }
  const hasSelections = Object.keys(routingGroups).length > 0;
  return hasSelections
    ? serializeCookie(ROUTING_COOKIE, encodeURIComponent(JSON.stringify(routingGroups)), { path: "/" })
    : serializeCookie(ROUTING_COOKIE, "", { maxAge: 0, path: "/" });
}

async function handlePut(request: Request, env: Env, origin: string): Promise<Response> {
  const { path, key } = (await request.json()) as { path: string; key: string };
  const routingGroups = parseRoutingCookie(request.headers.get("cookie") ?? "");
  const cookieHeader = updateRoutingCookie(routingGroups, path, key);

  return new Response(null, {
    status: 303,
    headers: { location: `${origin}${API_PATH}`, "set-cookie": cookieHeader },
  });
}

export function isSpaApi(pathname: string): boolean {
  return pathname === API_PATH || pathname.startsWith(API_PATH + "/");
}

export async function handleSpaApi(request: Request, env: Env): Promise<Response> {
  const { origin } = new URL(request.url);
  if (request.method === "GET") return handleGet(request, env);
  if (request.method === "PUT") return handlePut(request, env, origin);
  return new Response("Method not allowed", { status: 405 });
}
