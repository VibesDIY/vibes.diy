# Deploy Tags

Tag prefixes trigger different deploy jobs via `.github/workflows/vibes-diy-deploy.yaml`:

| Prefix         | Environment | Job          | Queue deploys?            |
| -------------- | ----------- | ------------ | ------------------------- |
| `vibes-diy@p*` | prodv2      | compile_test | Yes (CLOUDFLARE_ENV=prod) |
| `vibes-diy@c*` | cli         | deploy_cli   | No (shared prod queue)    |
| `vibes-diy@d*` | dev         | compile_test | No                        |

## Safety

**Never push prod tags (`vibes-diy@p*`) without explicit user confirmation.** Prod tags trigger live deploys — always ask before creating and pushing them.

## Tagging procedure

1. List existing tags by creation date:
   ```
   git tag -l 'vibes-diy@p*' --sort=creatordate --format='%(creatordate:short) %(refname:short)'
   git tag -l 'vibes-diy@c*' --sort=creatordate --format='%(creatordate:short) %(refname:short)'
   git tag -l 'vibes-diy@d*' --sort=creatordate --format='%(creatordate:short) %(refname:short)'
   ```
2. Pick next `0.x.y` — **use the same version number across all environments** when deploying the same code (e.g. `p0.2.16` and `c0.2.16`). Keep numbers sequential for easy ordering downstream
3. Tag the ref (branch or commit):
   ```
   git tag vibes-diy@p0.X.Y <ref> -m "description"
   git tag vibes-diy@c0.X.Y <ref> -m "description"
   git tag vibes-diy@d0.X.Y <ref> -m "description"
   ```
4. Push: `git push origin vibes-diy@p0.X.Y vibes-diy@c0.X.Y` (add `vibes-diy@d0.X.Y` if deploying dev too)
5. Tags are immutable — never delete/move, bump the version instead

## Queue architecture

One shared prod queue consumer for all environments. CLI and prod main workers both produce to `vibes-service-prod`. Dev has its own queue `vibes-service-dev`.
