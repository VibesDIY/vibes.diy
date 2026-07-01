# Publishing a brand-new npm package name (trusted publishing / OIDC)

**Read this before adding any new published package to the workspace.** The first
publish of a new `@vibes.diy/*` (or `use-vibes`/`call-ai`/`vibes-diy`) name will
**fail in CI** unless you do a two-step bootstrap first. This is not a token
problem and re-running won't fix it.

## Symptom

A `pkg@p*` publish run gets partway, then dies on the new package with:

```
<pkg> publish: npm error code ENEEDAUTH
<pkg> publish: npm error need auth This command requires you to be logged in to https://registry.npmjs.org/
```

…**while existing packages publish fine in the same run with the same setup.**
Same run + same OIDC, only the new name fails → it's the new name, not auth
generally.

## Root cause

CI publishes via **npm trusted publishing (OIDC)** — GitHub Actions exchanges an
OIDC token, and npm accepts it **only for packages that have this repo configured
as a trusted publisher**. Trusted publishing is configured **per package**. A
brand-new name has no trusted-publisher entry, so the OIDC credential is rejected
and npm falls back to "you're not logged in" → `ENEEDAUTH`.

- It is **not** a token allowlist, and **not** an ownership problem (npm org-team
  ownership is auto-added and does not grant OIDC publish).
- There is **no org/scope-level** trusted-publishing setting — you cannot
  pre-authorize future `@vibes.diy/*` names. It is per-package, every time.
- You **cannot** configure trusted publishing on a package that does not exist
  yet — hence the bootstrap publish below has to come first.

### Why each failed attempt burns a version

The publish walks packages in dependency order. Everything **before** the new
name publishes successfully (burning that version number), then the run wedges on
the new name; everything after it never runs. `npm publish` has no skip-existing,
so you cannot just re-run the same `pkg@p<ver>` — the already-published packages
would `E409` over their existing version. **Bump to the next patch** on retry.

## The recipe (one-time per new package)

1. **Bootstrap-publish the new name so it exists** (needs an npm _owner_ login +
   OTP — `npm whoami` must be a `@vibes.diy` owner, e.g. `jchris`). Build + pack
   with the repo tooling (a naive `npm publish` from source ships `.ts` with a
   broken `main`), then publish the tarball under a **non-`latest` tag** so a
   throwaway bootstrap version doesn't become `latest`:

   ```bash
   pnpm --filter <pkg-name> run build
   pnpm --filter <pkg-name> run pack        # → repo-root dist/<...>.tgz (a 0.0.0-smoke-* version)
   npm publish "$(pwd)/dist/<tarball>.tgz" --access public --tag smoke --otp=<code>
   ```

   Note: `npm publish <relative-path>` is misparsed as a git spec — pass an
   **absolute** path. New scoped packages can take a couple of minutes to
   propagate to the read API (the `+ <pkg>@<ver>` success line is authoritative;
   ignore a transient 404 from `npm view`).

2. **Configure trusted publishing** for it — web UI (Package → Settings → Trusted
   Publishing → GitHub Actions) or CLI:

   ```bash
   npm trust github <pkg-name> \
     --file .github/workflows/package-deploy.yaml \
     --repo VibesDIY/vibes.diy \
     --env production \
     --allow-publish --yes
   ```

   Trusted-publisher form values (must match `package-deploy.yaml` exactly):

   | Field               | Value                                                               |
   | ------------------- | ------------------------------------------------------------------- |
   | Organization / user | `VibesDIY`                                                          |
   | Repository          | `vibes.diy`                                                         |
   | Workflow filename   | `package-deploy.yaml`                                               |
   | Environment         | `production` (workflow sets `environment: production` for `pkg@p*`) |

   One config per package; `npm trust revoke --id <id>` to change it. `npm trust`
   supports **bulk** via shell scripting (~80 packages within one 5-minute OTP
   window) if you're onboarding several at once.

3. **Re-cut the pkg tag at the next patch** (e.g. `pkg@p4.0.2` after `4.0.1` was
   partially burned). CI now publishes the whole set cleanly, and `latest` moves
   off the bootstrap `smoke` version onto the real version.

## What does NOT need this

- **Existing** published packages (already on npm at any version) already have
  trusted publishing — untouched.
- **Private** workspace packages (`private: true`, e.g. `build-cli`,
  `deploy-cli`, `cmd-harness`) are never published.
- Skill scaffold templates under `.claude/skills/**/sample/` (`my-agent`,
  `sample`) are **not** pnpm workspace members — they're not in the publish set,
  ignore their npm 404s.

## Provenance

First hit and documented during the **4.0.0** ship: the de-Fireproof / Bucket F
lift added `@vibes.diy/cmd-tools`. `pkg@p4.0.0` and `pkg@p4.0.1` both wedged on it
(`ENEEDAUTH`); fixed by bootstrap-publishing `@vibes.diy/cmd-tools` under
`--tag smoke`, adding the repo as a trusted publisher, then cutting `pkg@p4.0.2`.
See [deploy-tags.md](deploy-tags.md) for the tag/deploy mechanics.
