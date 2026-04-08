import type { Env, RouteTarget } from "./types.js";
import { getBackendConfig, SPA_PREFIX, ROUTING_COOKIE } from "./types.js";
import { isSpaApi, handleSpaApi, parseRoutingCookie } from "./spa-api.js";
import type { Request as CFRequest } from "@cloudflare/workers-types";
import { URI } from "@adviser/cement";
import { serialize as serializeCookie } from "cookie";

async function proxyRequest(
  request: Request,
  targetBase: string,
  pathname: string,
  search: string,
  routeKey?: string
): Promise<Response> {
  const url = `${targetBase}${pathname}${search}`;
  const headers = new Headers(request.headers);
  headers.set("x-stable-entry", routeKey ?? "*");
  const upstream = await fetch(
    new Request(url, {
      method: request.method,
      headers,
      body: request.body,
    })
  );
  const response = new Response(upstream.body, upstream);
  response.headers.set("x-stable-entry", routeKey ?? "*");
  return response;
}

function notConfigured(): Response {
  return new Response("stable-entry is not configured: please set the BACKEND environment variable.", {
    status: 404,
    headers: { "content-type": "text/plain" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith(SPA_PREFIX)) {
      if (isSpaApi(url.pathname)) return handleSpaApi(request, env);
      // Dev: pass full URL so the Vite middleware handles /@stable-entry/* routing.
      // Prod: strip prefix so ASSETS finds files at the root of dist/spa/.
      const assetPath = url.pathname.slice(SPA_PREFIX.length) || "/";
      const assetReq = import.meta.env.DEV ? request : new Request(new URL(assetPath, url.origin), request);
      return env.ASSETS.fetch(assetReq as unknown as CFRequest) as unknown as Promise<Response>;
    }

    if (!env.BACKEND) return notConfigured();

    const rCfg = getBackendConfig(env.BACKEND_CFG);
    if (rCfg.isErr()) {
      return proxyRequest(request, env.BACKEND, url.pathname, url.search);
    }
    const cfg = rCfg.Ok();

    const routingGroups = parseRoutingCookie(request.headers.get("cookie") ?? "");
    const uri = URI.from(request.url);
    const paramKey = uri.getParam(".stable-entry.");
    const search = uri.build().delParam(".stable-entry.").asURL().search;

    // first path prefix match wins (longest-first order from parse)
    const pathEntry = Object.entries(cfg).find(([path]) => url.pathname.startsWith(path));
    const [matchedPath, groups] = pathEntry ?? [undefined, {} as Record<string, RouteTarget>];
    const cookieGroup = matchedPath ? routingGroups[matchedPath] : undefined;
    const group = paramKey ?? cookieGroup;
    const resolvedKey = group && groups[group] ? group : "*";
    const routeTarget = groups[resolvedKey];
    const target = routeTarget?.target ?? env.BACKEND;

    const response = await proxyRequest(request, target, url.pathname, search, resolvedKey);

    // Persist routing choice as cookie when ?.stable-entry. query param is present
    if (paramKey && matchedPath !== undefined) {
      if (resolvedKey === "*") {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete routingGroups[matchedPath];
      } else {
        routingGroups[matchedPath] = resolvedKey;
      }
      const hasSelections = Object.keys(routingGroups).length > 0;
      const cookieHeader = hasSelections
        ? serializeCookie(ROUTING_COOKIE, encodeURIComponent(JSON.stringify(routingGroups)), { path: "/" })
        : serializeCookie(ROUTING_COOKIE, "", { maxAge: 0, path: "/" });
      response.headers.append("set-cookie", cookieHeader);
    }

    return response;
  },
};
