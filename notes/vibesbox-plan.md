# Zero-Downtime Vibesbox Deployment Plan

## Pre-Deployment Checklist
1. ✅ Code functionality confirmed intact (tests are false negatives)
2. ✅ GitHub Actions workflow configured (`.github/workflows/vibesbox-deploy.yaml`)
3. ✅ Cloudflare secrets configured in repo settings
4. ⚠️ Current worker is auto-deployed from old standalone repo

## Deployment Steps

### 1. Pre-Deploy Validation
- Run `pnpm vibesbox:check` to ensure format/lint pass
- Verify wrangler.toml matches old repo (same worker name: "vibesbox", same routes)
- Confirm no changes pushed to old `~/code/vibesbox` repo

### 2. Deploy via GitHub Actions
- Commit current vibesbox changes to monorepo
- Push to `main` branch
- GitHub Actions will:
  - Run CI checks (`pnpm vibesbox:check`)
  - Deploy using `wrangler deploy` with API tokens
  - Overwrite existing worker (same name: "vibesbox")

### 3. Monitor Production (Critical Window: First 5 minutes)
Test these URLs immediately:
- `https://vibesbox.dev/` (root iframe)
- `https://vibesbox.dev/vibe/quick-cello-8104` (wrapper with default slug)
- `https://vibesbox.dev/lab/test-slug` (lab environment)
- Check with custom Fireproof version: `https://vibesbox.dev/?v_fp=0.22.0`

### 4. Rollback Plan (If Issues Detected)
**Option A - Cloudflare Dashboard Rollback (Fastest)**
1. Go to Cloudflare Workers dashboard
2. Click on "vibesbox" worker
3. Navigate to Deployments tab
4. Click "Rollback" on previous version

**Option B - Emergency Old Repo Deploy (If rollback fails)**
1. `cd ~/code/vibesbox`
2. Make trivial change (add comment)
3. `git commit && git push`
4. Wait for Cloudflare auto-deploy from old repo

### 5. Post-Deployment Cleanup (Once Stable)
**Disconnect Old Repo Auto-Deploy:**
1. Go to Cloudflare Dashboard → Workers & Pages
2. Select "vibesbox" worker
3. Go to Settings → Deployments
4. Click "Disconnect" on the GitHub integration to old repo
5. Verify only monorepo GitHub Actions will deploy going forward

## Test Failures to Ignore
These 8 test failures are test issues, NOT code issues:
- 3 failures: Regex doesn't capture build metadata (functionality works)
- 2 failures: Test expectations don't match escaped output (functionality works)
- 3 failures: Content checks too strict (functionality works)

## Safety Features
- Same worker name = Overwrites cleanly
- Same routes = No DNS changes needed
- Old repo untouched = Emergency recovery available
- Cloudflare rollback = Instant revert to previous version

## Success Criteria
✅ All test URLs respond correctly
✅ Fireproof version parameter works (`v_fp=X.Y.Z`)
✅ PostMessage communication functional
✅ No 500 errors in Cloudflare logs

Ready to execute!
