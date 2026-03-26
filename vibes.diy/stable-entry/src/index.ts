import { type } from "arktype";

interface Env {
  BACKEND: string;
  BACKENDS?: string;
}

const backendsType = type("Record<string, string>");
type BackendsMap = typeof backendsType.infer;

let cachedBackends: BackendsMap | null = null;
let cachedBackendsRaw: string | undefined;

function parseBackends(raw: string | undefined): BackendsMap | null {
  if (!raw) return null;
  if (raw === cachedBackendsRaw && cachedBackends !== null) return cachedBackends;
  try {
    const result = backendsType(JSON.parse(raw));
    if (result instanceof type.errors) {
      console.error("BACKENDS validation failed:", result.summary);
      return null;
    }
    cachedBackendsRaw = raw;
    cachedBackends = result;
    return result;
  } catch (e) {
    console.error("Failed to parse BACKENDS JSON:", e);
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

function resolveBackendUrl(request: Request, env: Env): string | null {
  const backends = parseBackends(env.BACKENDS);

  if (backends) {
    const cookieKey = getCookie(request, "Vibes-Backend");
    if (cookieKey && Object.hasOwn(backends, cookieKey)) {
      return backends[cookieKey];
    }
  }

  if (env.BACKEND) return env.BACKEND;
  return null;
}

function rewriteHeaderValue(value: string, backendHost: string, requestHost: string, requestProtocol: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.host === backendHost) {
      parsed.host = requestHost;
      parsed.protocol = requestProtocol;
      return parsed.toString();
    }
  } catch {
    // not an absolute URL — leave as-is
  }
  return value;
}

const HEADERS_TO_STRIP = ["Server", "Via", "X-Powered-By"];
const HEADERS_TO_REWRITE = ["Location", "Link", "Refresh", "Content-Location"];

function sanitizeResponseHeaders(response: Response, requestUrl: URL, backendOrigin: string): Response {
  const headers = new Headers(response.headers);
  const backendHost = new URL(backendOrigin).host;
  const requestProtocol = requestUrl.protocol;

  for (const name of HEADERS_TO_STRIP) {
    headers.delete(name);
  }

  for (const name of HEADERS_TO_REWRITE) {
    const value = headers.get(name);
    if (value) {
      headers.set(name, rewriteHeaderValue(value, backendHost, requestUrl.host, requestProtocol));
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/.stable-entry/config.json") {
      const backends = parseBackends(env.BACKENDS);
      const keys = backends ? Object.keys(backends) : [];
      return new Response(JSON.stringify({ keys }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const backendParam = url.searchParams.get("backend");
    if (backendParam !== null) {
      const backends = parseBackends(env.BACKENDS);
      url.searchParams.delete("backend");
      const headers = new Headers();
      headers.set("Location", url.pathname + url.search);
      if (backendParam && backends && Object.hasOwn(backends, backendParam)) {
        headers.set("Set-Cookie", `Vibes-Backend=${backendParam}; Path=/; SameSite=Lax; Max-Age=86400`);
      } else {
        headers.set("Set-Cookie", "Vibes-Backend=; Path=/; SameSite=Lax; Max-Age=0");
      }
      return new Response(null, { status: 302, headers });
    }

    const backendUrl = resolveBackendUrl(request, env);
    if (!backendUrl) {
      return new Response("Service temporarily unavailable", { status: 502 });
    }

    const targetUrl = `${backendUrl}${url.pathname}${url.search}`;

    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    try {
      const response = await fetch(proxyRequest);
      return sanitizeResponseHeaders(response, url, backendUrl);
    } catch (e) {
      console.error("Proxy fetch failed:", e);
      return new Response("Bad gateway", { status: 502 });
    }
  },
} satisfies ExportedHandler<Env>;
