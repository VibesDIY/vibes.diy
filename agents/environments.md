# Environments

Four deploy environments:

| Tag/trigger    | Environment                   | Domain                                      |
| -------------- | ----------------------------- | ------------------------------------------- |
| `vibes-diy@d*` | dev                           | `dev-v2.vibesdiy.net`                       |
| `vibes-diy@p*` | prodv2                        | `prod-v2.vibesdiy.net` (behind `vibes.diy`) |
| `vibes-diy@c*` | cli (**exact clone of prod**) | `cli-v2.vibesdiy.net`                       |
| PR open/push   | preview                       | `pr-{N}-vibes-diy-v2.{account}.workers.dev` |

## PR preview

PRs that touch `vibes.diy/**/*` automatically get a preview deployment. The workflow (`.github/workflows/vibes-diy-pr-preview.yaml`) builds with `CLOUDFLARE_ENV=preview` and deploys as `pr-{N}-vibes-diy-v2` on workers.dev. A bot comment posts the live URL on the PR. On PR close, a cleanup workflow deletes the worker. Preview uses `[env.preview]` in wrangler.toml — shares dev's D1/R2/DO/queue bindings but has no routes (workers.dev only). No schema migrations run on preview — merge to main first.

## CLI is a prod clone

CLI environment is an exact clone of prod — same env vars, same Neon database, same Clerk, same behavior. It exists as a separate worker for CLI-specific routing via stable-entry, not for isolation. When setting env vars for CLI, mirror prod values. Single data plane: dev, prod, and cli all share one Neon database (intentional).

## Stable-entry routing

`vibes.diy` is the ONLY domain that goes through the stable-entry worker. All other domains (`dev-v2.vibesdiy.net`, sandbox subdomains like `app--user.dev-v2.vibesdiy.net`) are either proxy targets or direct access.

The stable-entry worker (`vibes.diy/stable-entry/worker.ts`) sits in front of `vibes.diy` and routes to different backends:

- Reads `se-group` cookie or `.stable-entry.` query param
- Forwards `x-stable-entry` header to the backend
- `"*"` = default group (no override)
- Config in `BACKEND_CFG` env var maps paths to backend groups

## How sandbox iframes get the right backend

The root loader reads `x-stable-entry` header and appends `.stable-entry.` param to `pkgRepos.workspace`. This flows through:

1. Client gets `svcVars.pkgRepos.workspace` with the param baked in
2. Client passes it as `?npmUrl=` on iframe sandbox URLs
3. Sandbox backend uses it as `privateUrl` for import map `/vibe-pkg/` URLs
4. Browser fetches packages through stable-entry with the correct group

## Testing with stable-entry

Set cookie in browser console: `document.cookie = "se-group=" + encodeURIComponent(JSON.stringify({"/": "dev"})) + "; path=/"`

Or visit `/@stable-entry/` on vibes.diy to use the admin UI.
