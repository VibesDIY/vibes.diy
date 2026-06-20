# C — `/chat/` route deprecation (design + outline)

> **Status: design-level.** Largest, most product-facing track, and it depends
> on Track B (lazy ChatSessions). Before executing, run `brainstorming` then
> `writing-plans`. The img-gen heavy/light session split it relies on does not
> yet have a spec — write `docs/superpowers/specs/<date>-heavy-light-session-design.md`
> as part of C's brainstorm (it is the documented exit for the `#2350` stopgap).

**Goal:** Fold chat into the `/vibe/` route. No standalone chat page: `vibeApi`
(AppSessions) is the primary connection; `chatApi` is lazy and scoped to the
prompt UI. Simplifies routing and finishes the target architecture in
`agents/do-session-split.md`. Closes #2265 §3.

**Spec:** `../../specs/2026-06-20-do-split-finish-design.md` (Track C).

**Depends on:** Track B (lazy ChatSessions); benefits from Track A (clean roles).

---

## Open decisions (resolve in brainstorm before planning)

1. **URL strategy.** Does the editor get a distinct URL (e.g. `/vibe/:o/:s/edit`)
   or is edit an in-page mode on `/vibe/:o/:s`? Affects SEO, deep links,
   analytics, and the redirect map.
2. **Deep-link + analytics preservation.** `/chat/:o/:s` and `routes/chat/prompt.tsx`
   (new-vibe-from-prompt entry) are linked/tracked externally. Define 301/302
   redirects and confirm PostHog/GTM events survive.
3. **img-gen heavy/light split.** `imgGenAppSessionStopgapHandlers` re-exposes
   `openChat`/`promptChatSection` on AppSessions because img-gen rides
   `vibeApi`. Removing the stopgap requires img streaming to move to the lazy
   chat session — design that first (the missing heavy-light-session spec).
4. **`vibesMsgEvento` retirement.** Once `chat.$ownerHandle.$appSlug.tsx` and
   the default-evento path are gone, can `vibes-msg-evento.ts` be deleted, or do
   tests still depend on the combined evento? (Tests currently import it
   heavily — they would migrate to `appMsgEvento` + explicit mocks.)

---

## File map (provisional)

| File                                                           | Change                                                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx`      | render prompt/chat UI inline behind an edit affordance; lazy-open `chatApi` on first prompt focus |
| `vibes.diy/pkg/app/routes/chat/chat.$ownerHandle.$appSlug.tsx` | retire (logic merged into the vibe route)                                                         |
| `vibes.diy/pkg/app/routes/chat/prompt.tsx`                     | keep new-vibe entry until replaced; eventually redirect into the vibe route                       |
| router config                                                  | `301`/`302` `/chat/:o/:s` → `/vibe/:o/:s` per decision 1                                          |
| `vibes.diy/pkg/app/vibe-api-target.ts`                         | simplify once `/chat/` no longer needs a `vibeApi` target                                         |
| `vibes.diy/api/svc/evento-handler-manifest.ts`                 | remove `imgGenAppSessionStopgapHandlers` after img-gen moves (decision 3)                         |
| `vibes.diy/api/svc/app-msg-evento.ts`                          | drop the stopgap spread                                                                           |
| `vibes.diy/api/svc/vibes-msg-evento.ts`                        | delete if unused (decision 4)                                                                     |

---

## Task outline (expand into TDD plan)

1. **Prereq spec:** heavy/light session split for img-gen (decision 3).
2. **Inline chat UI on the vibe route**, lazy `chatApi` on first prompt focus
   (leans on Track B's lazy ChatSessions). Test: visiting `/vibe/:o/:s` opens
   no chat connection until the prompt is focused.
3. **Redirects** `/chat/:o/:s` → `/vibe/:o/:s` (decision 1); preserve
   `prompt.tsx` new-vibe flow. Tests for redirect + deep-link.
4. **Move img streaming to the lazy chat session**; remove
   `imgGenAppSessionStopgapHandlers` and the `app-msg-evento` spread. Parity
   test update.
5. **Retire `chat.$ownerHandle.$appSlug.tsx`** and, if unused, `vibesMsgEvento`
   (migrate dependent tests to `appMsgEvento` + explicit access mocks).
6. **Update `agents/do-session-split.md`** to mark the target architecture
   reached; **verify + deploy + close #2265 §3** (and #2264 if any architecture
   checkbox remains).

---

## Risks

- Highest user-facing surface area of the three tracks (URL/SEO/deep links) —
  decision 1/2 must be settled with product before coding.
- The img-gen stopgap removal is itself a sub-project; do not block the rest of
  C on it — sequence it as task 4 with its own spec/plan.
- Test-suite churn if `vibesMsgEvento` is deleted (many tests import it). Plan a
  mechanical migration step with its own commit.
