# Branding the browser's three connections with `Conn<K>` (#2714)

**Hook:** The browser opened three WebSocket connections (chat/vibe/shared) all
typed as the full `VibesDiyApiIface` — so nothing stopped a doc write from being
aimed at the codegen connection at compile time. We branded each one with the
kind-parameterized `Conn<K>` view so the compiler now refuses wrong-shard calls.

**Source:** `vibes.diy/pkg/app/vibes-diy-provider.tsx` (context + factories),
plus the hooks/components that receive those connections
(`useChatSession`, `useChatHydration`, `useChatOwnership`, `useShareModal`,
`DmThread`, `DmInbox`, `HandleAvatarEditor`, `CommentsSection`).

**The trade-off / gotcha:** Staging it as "alias first, then let the build
surface every wrong-kind site" worked — but it immediately exposed a latent bug
in the `Conn<K>` machinery itself: `AvailableMethods` routed *no-reqType* methods
(`close`, `getTokenClaims`, and every `on*` registrar) through the policy branch
because `never extends ReqType` is `true`, silently dropping them from every
shard view. Fix was a `[MethodReqType] extends [never]` tuple-wrapped guard, now
locked by a `shard-policy.test-d.ts` assertion. Lesson: a `extends X` check where
the input can be `never` will quietly take the wrong branch — wrap in a tuple to
defeat distribution and catch the empty case.

**Remaining tension:** the server-plane `srv-sandbox` genuinely holds *both*
planes and routes per-op internally, so it stays typed against the full
interface; the branded connections widen back to `VibesDiyApiIface` at that one
boundary (3 commented `TODO(#2714)` no-op widenings in the provider).
