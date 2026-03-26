interface Env {
  BACKEND: string;
  BACKENDS?: string;
}

interface BackendsMap {
  [key: string]: string;
}

let cachedBackends: BackendsMap | null = null;
let cachedBackendsRaw: string | undefined;

function parseBackends(raw: string | undefined): BackendsMap | null {
  if (!raw) return null;
  if (raw === cachedBackendsRaw && cachedBackends !== null) return cachedBackends;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      console.error("BACKENDS must be a JSON object, got:", typeof parsed);
      return null;
    }
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v !== "string") {
        console.error(`BACKENDS["${k}"] must be a string URL, got:`, typeof v);
        return null;
      }
    }
    cachedBackendsRaw = raw;
    cachedBackends = parsed as BackendsMap;
    return cachedBackends;
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

function serveUI(backends: BackendsMap | null): Response {
  const keys = backends ? Object.keys(backends) : [];
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>stable-entry</title>
  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@18?bundle",
      "react-dom/client": "https://esm.sh/react-dom@18/client?external=react&bundle"
    }
  }
  </script>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    import React from "react";
    import { createRoot } from "react-dom/client";

    const h = React.createElement;
    const KEYS = ${JSON.stringify(keys)};

    function getCookie(name) {
      for (const part of document.cookie.split(";")) {
        const [k, ...rest] = part.trim().split("=");
        if (k === name) return rest.join("=");
      }
      return "";
    }

    function App() {
      const current = getCookie("Vibes-Backend") || "(default)";

      function select(key) {
        if (key) {
          document.cookie = "Vibes-Backend=" + key + "; Path=/; SameSite=Lax; Max-Age=86400";
        } else {
          document.cookie = "Vibes-Backend=; Path=/; SameSite=Lax; Max-Age=0";
        }
        window.location.href = "/";
      }

      return h("div", { style: { fontFamily: "system-ui", maxWidth: "400px", margin: "80px auto", padding: "20px" } },
        h("h2", null, "stable-entry"),
        h("p", null, "Current backend: ", h("strong", null, current)),
        h("div", null,
              KEYS.length > 0
                ? h("div", null,
                    h("p", null, "Select a backend:"),
                    h("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } },
                      KEYS.map(function(key) {
                        return h("button", {
                          key: key,
                          onClick: function() { select(key); },
                          style: {
                            padding: "8px 16px",
                            cursor: "pointer",
                            fontWeight: current === key ? "bold" : "normal",
                            border: current === key ? "2px solid #333" : "1px solid #ccc",
                            borderRadius: "4px",
                            background: current === key ? "#f0f0f0" : "#fff"
                          }
                        }, key);
                      })
                    )
                  )
                : h("p", { style: { color: "#888" } }, "No alternate backends configured."),
              current !== "(default)"
                ? h("button", {
                    onClick: function() { select(""); },
                    style: {
                      padding: "8px 16px",
                      cursor: "pointer",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      background: "#fff",
                      marginTop: "8px"
                    }
                  }, "Reset to default")
                : null
            )
      );
    }

    createRoot(document.getElementById("root")).render(h(App));
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/.stable-entry")) {
      const backends = parseBackends(env.BACKENDS);
      return serveUI(backends);
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
