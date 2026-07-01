# The handle picker forgot that some people collect handles

Source: `claude/vibe-handles-menu-scroll-k313xk`

The Vibe card header tag opens the `HandlePickerMenu` — the "acting as" switcher
you use to pick which handle you're joined to a shared vibe as. It rendered every
handle in one unbounded `position: absolute` list with no `max-height` and no
`overflow`, on the quiet assumption that you have two or three handles. People who
have a dozen discovered the tail of the list just ran off the bottom of the
viewport with nowhere to scroll.

Two moves, both small: wrap only the `handles.map` in a `maxHeight: 40vh;
overflowY: auto` scroll region (so the list scrolls but the "New handle" and new
"Log out" rows stay pinned and reachable no matter how long the roster is), and
add an optional `onLogout` row at the bottom wired to the same `clerk.signOut()`
the SessionSidebar and Settings page use.

The angle worth writing up: **the scroll boundary belongs around the unbounded
thing, not the whole popover.** Slapping `overflow: auto` on the menu root would
have made the escape hatches (New handle, Log out) scroll away too — the exact
rows you most need when the list is long. Bounding the *list* keeps the actions
fixed. The gotcha: the menu is deliberately pure-presentational (the host injects
select/create/logout), so "add a logout button" isn't a one-file change — the
callback threads `HandlePickerMenu` → `UnifiedVibeCard` → the vibe route, and the
row only renders when the host actually passes `onLogout`, so the shared-storybook
and non-authed callers don't sprout a dead button.

The *other* gotcha, caught in review before merge: the obvious "open the menu
upward, there's more room above" instinct is wrong **for this card**. The tag
sits at the card's *top* header, and the card clips its own overflow
(`overflow: hidden` on the dialog) — so `placement="up"` renders the menu above
the card's top edge and clips it to a sliver, making switch/create/logout
unreachable. The room is actually *below* the tag, inside the tall card body.
Lesson: "up vs down" for a popover isn't about the viewport, it's about which
direction stays inside the nearest clipping ancestor. Upward placement only
becomes safe once the picker is portaled out of the clipped container.
