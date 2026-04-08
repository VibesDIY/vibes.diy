# stable-entry

A Cloudflare Worker that proxies requests to different backends based on a per-path cookie. A small React SPA at `/@stable-entry/` lets you switch routes interactively.

## Environment variables

| Variable      | Required | Description                                      |
| ------------- | -------- | ------------------------------------------------ |
| `BACKEND`     | yes      | Fallback backend URL used when no config matches |
| `BACKEND_CFG` | no       | JSON routing config (see below)                  |

## `BACKEND_CFG` structure

```
{
  "<path-prefix>": {
    "*":          { "target": "<url>" },
    "<group-key>": { "desc": "<label>", "target": "<url>" },
    ...
  },
  ...
}
```

- **path-prefix** — URL prefix to match (e.g. `/api`, `/`). Longer prefixes win. Every path should have a `"*"` entry as the default.
- **group-key** — Arbitrary key identifying the group (e.g. `dev`, `prod`). The special key `"*"` is the default route when no cookie is set.
- **desc** — Optional human-readable label shown in the UI. Defaults to the group key.
- **target** — The backend URL to proxy to for this group.

### Example

```json
{
  "/api": {
    "*": { "target": "https://vibes.diy/api" },
    "dev": { "desc": "Dev", "target": "https://dev-v2.vibesdiy.net/api" },
    "prod": { "desc": "Prod", "target": "https://prod-v2.vibesdiy.net/api" }
  },
  "/": {
    "*": { "target": "https://vibes.diy" },
    "dev": { "desc": "Dev", "target": "https://dev-v2.vibesdiy.net" },
    "prod": { "desc": "Prod", "target": "https://prod-v2.vibesdiy.net" }
  }
}
```

## Routing

The active group for each path is stored in the `se-group` cookie as a URL-encoded JSON object:

```
se-group=%7B%22%2Fapi%22%3A%22dev%22%2C%22%2F%22%3A%22prod%22%7D
```

which decodes to `{"/api":"dev","/":"prod"}`.

You can also override routing for a single request with a query parameter — useful for testing without touching the cookie:

```
https://example.com/some/page?.stable-entry.=dev
```

The parameter is stripped before the request is forwarded upstream. When present, the routing choice is also persisted into the `se-group` cookie so subsequent requests continue routing to that backend.

Every proxied response includes an `X-Stable-Entry` header with the resolved group key.

## UI

Visit `/@stable-entry/` to see all configured paths and groups, switch the active group per path, and copy a ready-to-use `curl` command with the current cookie.

## Deployment

Tag with `se@*` to trigger the GitHub Actions deploy workflow (always deploys to the `production` environment).

```
git tag se@2026-03-30 -m "deploy"
git push origin se@2026-03-30
```
