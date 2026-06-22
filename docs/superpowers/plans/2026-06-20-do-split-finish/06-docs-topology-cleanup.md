# Docs cleanup — exorcise the pre-split topology

> **Status: done in this PR** (docs/comments only; no behavior change).

After A1→A3 shipped (DocNotify + AccessFnDO deleted, doc ops off the chat plane,
local QuickJS eval on the DOs), the repo still described the old topology in a
few **living** docs and stale temporal code comments. This cleanup makes the
living docs match reality.

## Principle: update living docs, don't rewrite history

- **Living docs** (describe how the system works _now_) → updated.
- **Dated design records** under `docs/superpowers/specs/` and `plans/` →
  **left as-is**. They are point-in-time artifacts; rewriting them is
  revisionist and destroys their value. At most they get a one-line status
  banner pointing at the living source of truth.

## Changes

| File                                                                                               | Change                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agents/do-session-split.md`                                                                       | Retitled "Architecture"; "Current state" now reflects the reached state (no DocNotify/AccessFnDO, doc ops on AppSessions, ChatSessions chat-only + local QuickJS); added "What shipped" (A1–A3) and "Remaining" (SharedSessions, lazy ChatSessions, /chat deprecation — Track B/C). |
| `agents/do-migrations.md`                                                                          | Corrected the DocNotify "leave it dormant, almost never worth deleting" advice — both DOs were in fact deleted. Added a "Delete a DO class for real" recipe with the two real shapes: Case A cross-script/cli-first (DocNotify), Case B local/single-PR (AccessFnDO).               |
| `agents/firefly-access-fn-impl-prompt.md`                                                          | Evaluation path no longer "routes to `ACCESS_FN_DO`"; describes in-process local QuickJS eval + fail-closed.                                                                                                                                                                        |
| `api/svc/chat-msg-evento.ts`, `api/svc/evento-handler-manifest.ts`, `pkg/workers/chat-sessions.ts` | Freshened temporal comments ("retirement gate"/"so AccessFnDO can be retired"/"until #2263") to present tense now that the work shipped.                                                                                                                                            |
| `docs/superpowers/specs/2026-06-20-do-split-finish-design.md`, `plans/.../00-overview.md`          | One-line status banner: Track A shipped; B/C pending; living truth → `agents/do-session-split.md`. (History otherwise untouched.)                                                                                                                                                   |

## Not touched (intentionally)

- Dated specs/plans predating this effort (e.g. `2026-06-05-app-sessions-do-split-design.md`, `2026-06-09-docnotify-retire-*`) — historical record.
- `CLAUDE.md` — no topology ghosts (verified).

## Merge ordering

Docs match `main`'s code (A3 already merged). Safe to merge anytime; ideally
after A3 is **deployed** to prod + cli so docs and running infra agree.
