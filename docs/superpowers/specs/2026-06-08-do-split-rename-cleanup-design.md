# AppSessions DO split — rename + cleanup

**Issues:** [#2263](https://github.com/VibesDIY/vibes.diy/issues/2263), [#2264](https://github.com/VibesDIY/vibes.diy/issues/2264)
**Parent:** [#2253](https://github.com/VibesDIY/vibes.diy/pull/2253) (merged)

## Summary

Follow-up to the AppSessions DO split (PR #2253). One PR with four commits: mechanical rename of connection-role names, stale URL param removal, edge case tests for `resolveShardDO`, and dead DocNotify callback code removal. No behavior changes.

## Commit 1: Rename `vibeDiyApi` → `chatApi`, `appDiyApi` → `vibeApi`

282 references across 39 files. Pure find-replace.

| Old name | New name | What it is |
|----------|----------|------------|
| `vibeDiyApi` | `chatApi` | Chat streaming connection (`/api`) |
| `appDiyApi` | `vibeApi` | Vibe-scoped data connection (`/api/app?vibe=...`) |

### Renamed symbols

- `VibesDiyCtx.vibeDiyApi` → `VibesDiyCtx.chatApi`
- `VibesDiyCtx.appDiyApi` → `VibesDiyCtx.vibeApi`
- All destructures: `const { vibeDiyApi } = useVibesDiy()` → `const { chatApi } = useVibesDiy()`
- Fallback pattern: `const api = appDiyApi ?? vibeDiyApi` → `const api = vibeApi ?? chatApi`

### Not renamed

- `VibesDiyApi` (class) — implementation name, not a connection role
- `VibesDiyApiIface` (interface) — same reason
- `vibesDiyApis` (KeyedResolvOnce cache) — internal to provider
- `useVibesDiy()` (hook) — returns the full context, not a single connection

### Files touched

Provider: `vibes-diy-provider.tsx`
srv-sandbox: `srv-sandbox.ts`
Components: `DmThread.tsx`, `DmInbox.tsx`, `ModelSettingsCards.tsx`, `RecentVibes.tsx`, `YourAppsFooter.tsx`, `MyAppsSection.tsx`, `CommentsSection.tsx`, `MembersSection.tsx`, `ShareModal.tsx`, `useShareModal.ts`, `AppChatsTab.tsx`, `useSharingPanel.ts`, `settings-tab/index.tsx`, `ChatInput.tsx`, `ColorsetPicker.tsx`
Hooks: `useBuildCompletionNotifications.ts`, `useRecentVibes.ts`, `useMemberships.ts`, `useIframeCurrentTokens.ts`
Routes: `vibe.$ownerHandle.$appSlug.tsx`, `remix.$ownerHandle.$appSlug.tsx`, `chat/chat.$ownerHandle.$appSlug.tsx`, `chat/prompt.tsx`, `settings.tsx`, `vibes/mine.tsx`, `vibes/memberships.tsx`, `messages.tsx`, `messages.$ownerHandleA.$ownerHandleB.tsx`, `settings/csr-to-cert.tsx`
Utils: `titleGenerator.ts`
Tests: `settings-profile.test.tsx`, `ShareModal.test.tsx`, `comments-section-avatar.test.tsx`, `vibe-route-ssr.test.tsx`, `iframe-source-capture.test.ts`, `srv-sandbox-set-db-acl.test.ts`, `srv-sandbox-put-doc.test.ts`, `srv-sandbox-who-am-i.test.ts`, `srv-sandbox-put-asset.test.ts`, `srv-sandbox-img-gen.test.ts`

## Commit 2: Remove stale `shard` param from app connection URL

`VibesDiyApi` constructor appends `?shard=<uuid>` to every connection URL. For the app connection (`/api/app?vibe=...`), AppSessions ignores the shard param — it routes by the `vibe` param. The stale `?shard=` is cosmetic noise in logs and devtools.

**Fix:** In `vibes-diy-provider.tsx`, ensure the app connection constructor call does not receive a `shardKey`. The provider already constructs `appApiUrl` separately — just omit `shardKey` from that `VibesDiyApi` instantiation.

## Commit 3: Add `resolveShardDO` edge case tests

`resolveShardDO` (18 lines in `pkg/workers/resolve-shard-do.ts`) routes shard IDs to the correct DO namespace by prefix. Charlie's review requested edge case coverage.

New test file alongside existing `route-decision.test.ts`:

| Input | Expected ns | Expected name | Reason |
|-------|------------|---------------|--------|
| `"app:foo"` | APP_SESSIONS | `"foo"` | Basic prefix routing |
| `"foo"` | CHAT_SESSIONS | `"foo"` | No prefix — default |
| `"foo:bar"` | CHAT_SESSIONS | `"foo:bar"` | Unknown prefix — falls through to default |
| `"app:foo:bar"` | APP_SESSIONS | `"foo:bar"` | Only first colon is the delimiter |
| `"app:"` | APP_SESSIONS | `""` | Empty suffix — degenerate but valid |

Tests mock `env.APP_SESSIONS` and `env.CHAT_SESSIONS` as distinct sentinel objects.

## ~~Commit 4: Remove dead `docNotifyCallbacks` / `userNotifyCallbacks`~~ (already done)

These functions were already removed as part of PR #2253's refactor commit (`86ba7c32c`). Verified on `origin/main` — `cf-serve.ts` has no remaining `docNotifyCallbacks` or `userNotifyCallbacks` references. No work needed.

## Out of scope

- Deleting DocNotify/AccessFnDO DO classes (requires wrangler migration after traffic drains)
- SharedSessions singleton DO (#2264 architecture item)
- `/chat/` route deprecation (#2264 architecture item)

## Follow-up issue

File a follow-up issue for items deferred from #2264:
- DocNotify/AccessFnDO DO class deletion migration
- SharedSessions singleton DO for sidebar/settings/models queries
- `/chat/` route deprecation
