import { type } from "arktype";

// --- Types ---

interface Env {
  BACKEND: string;
  BACKENDS?: string;
}

const backendsType = type("Record<string, string>");
const validKey = /^[a-z0-9-]+$/;
type BackendsMap = typeof backendsType.infer;

interface StableEntryCtx {
  readonly backends: BackendsMap | null;
  readonly defaultBackend: string;
}

type RouteResult =
  | { readonly type: "config"; readonly keys: readonly string[] }
  | { readonly type: "set-backend"; readonly key: string; readonly redirect: string }
  | { readonly type: "clear-backend"; readonly redirect: string }
  | { readonly type: "proxy"; readonly targetUrl: string }
  | { readonly type: "error" };

// --- Pure core ---

function normalizeUrl(url: string): string {
  return new URL(url).toString().replace(/\/$/, "");
}

function parseBackends(raw?: string): BackendsMap | null {
  if (!raw) return null;
  try {
    const result = backendsType(JSON.parse(raw));
    if (result instanceof type.errors) {
      throw new Error(`BACKENDS validation failed: ${result.summary}`);
    }
    const normalized: BackendsMap = Object.create(null);
    for (const [k, v] of Object.entries(result)) {
      if (!validKey.test(k)) {
        throw new Error(`BACKENDS key "${k}" must match ${validKey}`);
      }
      normalized[k] = normalizeUrl(v);
    }
    return normalized;
  } catch (e) {
    console.error("BACKENDS config error, serving BACKEND:", e);
    return null;
  }
}

function getCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("Cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return undefined;
}

function handleRequest(url: URL, cookieValue: string | undefined, ctx: StableEntryCtx): RouteResult {
  const backendParam = url.searchParams.get("_backend");
  const validKey = backendParam && ctx.backends && Object.hasOwn(ctx.backends, backendParam);
  const backendUrl = cookieValue && ctx.backends && Object.hasOwn(ctx.backends, cookieValue)
    ? ctx.backends[cookieValue]
    : ctx.defaultBackend;

  url.searchParams.delete("_backend");
  const cleanPath = url.pathname + url.search;

  switch (true) {
    case url.pathname === "/.stable-entry/config.json":
      return { type: "config", keys: ctx.backends ? Object.keys(ctx.backends) : [] };

    case backendParam !== null && Boolean(validKey):
      return { type: "set-backend", key: backendParam, redirect: cleanPath };

    case backendParam !== null:
      return { type: "clear-backend", redirect: cleanPath };

    case Boolean(backendUrl):
      return { type: "proxy", targetUrl: `${backendUrl}${cleanPath}` };

    default:
      return { type: "error" };
  }
}

// --- IO glue ---

function routeToResponse(result: RouteResult, request: Request): Response | Promise<Response> {
  switch (result.type) {
    case "config":
      return new Response(JSON.stringify({ keys: result.keys }), {
        headers: { "Content-Type": "application/json" },
      });

    case "set-backend":
      return new Response(null, {
        status: 302,
        headers: {
          "Location": result.redirect,
          "Set-Cookie": `Vibes-Backend=${result.key}; Path=/; SameSite=Lax; Max-Age=86400`,
        },
      });

    case "clear-backend":
      return new Response(null, {
        status: 302,
        headers: {
          "Location": result.redirect,
          "Set-Cookie": "Vibes-Backend=; Path=/; SameSite=Lax; Max-Age=0",
        },
      });

    case "proxy": {
      const proxyRequest = new Request(result.targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
      return fetch(proxyRequest).catch((e) => {
        console.error("Proxy fetch failed:", e);
        return new Response("Bad gateway", { status: 502 });
      });
    }

    case "error":
      return new Response("Service temporarily unavailable", { status: 502 });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const ctx: StableEntryCtx = {
      backends: parseBackends(env.BACKENDS),
      defaultBackend: normalizeUrl(env.BACKEND),
    };
    const cookieValue = getCookie(request, "Vibes-Backend");
    const result = handleRequest(url, cookieValue, ctx);
    return routeToResponse(result, request);
  },
} satisfies ExportedHandler<Env>;
