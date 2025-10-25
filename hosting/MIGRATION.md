# Domain Migration

## Staged Rollout Progress

### Phase 1: vibecode.garden and vibesdiy.work ✅ COMPLETE
- ✅ Migrated from ai-builder-hosting worker to vibes-hosting-v2 worker
- ✅ Routes successfully deployed to new worker
- ✅ Using shared KV namespace: 342352a479b64835931b4e5f9f3277a0
- ✅ Using new queue: publish-events-v2
- Deployed: 2025-10-25

### Phase 2: vibesdiy.app and vibes-diy-api.com (ready for deployment)
- Routes added to new worker configuration
- Routes removed from old worker configuration
- Waiting for sequential deployment:
  1. Deploy old worker to release routes
  2. Deploy new worker to claim routes
- Old worker will be decommissioned (zero routes)
