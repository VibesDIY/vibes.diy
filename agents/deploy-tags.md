# Deploy Tags

## Cloudflare deploy (`vibes-diy-deploy.yaml`)

| Prefix         | Environment | Job          | Queue deploys?            |
| -------------- | ----------- | ------------ | ------------------------- |
| `vibes-diy@p*` | prodv2      | compile_test | Yes (CLOUDFLARE_ENV=prod) |
| `vibes-diy@c*` | cli         | deploy_cli   | No (shared prod queue)    |
| `vibes-diy@d*` | dev         | compile_test | No                        |

## Package publish (`package-deploy.yaml`)

| Prefix   | Environment | Workflow             |
| -------- | ----------- | -------------------- |
| `pkg@p*` | production  | CI Vibes.Diy Publish |
| `pkg@s*` | staging     | CI Vibes.Diy Publish |
| `pkg@d*` | dev         | CI Vibes.Diy Publish |

Convention: `pkg@d2.0.0-dev-cli-<letter>` for dev CLI iterations.

The `pkg` tags publish the CLI (`vibes-diy` / `use-vibes` npm packages) and related workspace packages. Use `pkg@p*` for production releases.

## Tagging procedure

### Cloudflare deploys (`vibes-diy@*`)

1. List existing tags by creation date:
   ```
   git tag -l 'vibes-diy@p*' --sort=creatordate --format='%(creatordate:short) %(refname:short)'
   git tag -l 'vibes-diy@c*' --sort=creatordate --format='%(creatordate:short) %(refname:short)'
   git tag -l 'vibes-diy@d*' --sort=creatordate --format='%(creatordate:short) %(refname:short)'
   ```
2. Pick next `0.x.y` — **use the same version number across all environments** when deploying the same code (e.g. `p0.2.16` and `c0.2.16`). Keep numbers sequential for easy ordering downstream
3. Tag the ref (branch or commit):
   ```
   git tag -a vibes-diy@p0.X.Y <ref> -m "description"
   git tag -a vibes-diy@c0.X.Y <ref> -m "description"
   git tag -a vibes-diy@d0.X.Y <ref> -m "description"
   ```
4. Push: `git push origin vibes-diy@p0.X.Y vibes-diy@c0.X.Y` (add `vibes-diy@d0.X.Y` if deploying dev too)
5. Tags are immutable — never delete/move, bump the version instead

### Package publishes (`pkg@*`)

1. List existing tags: `git tag -l 'pkg@p*' --sort=-creatordate | head -5`
2. Pick next sequential patch: e.g. `pkg@p2.0.8` → `pkg@p2.0.9`
3. Tag and push:
   ```
   git tag -a pkg@p2.0.9 -m "description"
   git push origin pkg@p2.0.9
   ```
4. Tags are immutable — never delete/move, bump the version instead

## Say notification

`echo 'message' | say` is a **completion** signal — it must come after the deploy actually finishes, not after the action that kicks it off.

- ❌ Wrong: `git push origin vibes-diy@c2.2.X && echo 'c2.2.X deploying' | say` — the deploy hasn't run yet, CI takes minutes, the user gets a false "done."
- ✅ Right: push the tag → wait/poll `gh run list` until the run shows `completed success` → then `echo 'c2.2.X deployed' | say`.
- Word it as past tense (`deployed`, `published`, `green`), not progressive (`deploying`, `publishing`). The audible signal exists to call the human back when something they were waiting on is *done*.
- If the deploy fails, say something distinct (`deploy failed`) — never speak success on failure.

The same rule applies to npm publishes, package releases, queue drains — anything where the action you triggered runs asynchronously somewhere else.

## Queue architecture

One shared prod queue consumer for all environments. CLI and prod main workers both produce to `vibes-service-prod`. Dev has its own queue `vibes-service-dev`.
