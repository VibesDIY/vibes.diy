# A friend-invite link's add-intent leaks through the iframe — confirm before acting on it

**Hook:** Pickathon Picker (and Rolling Today) share friends via a `?friend=<handle>`
link: open it, and the app records a mutual follow so you can see each other's
schedules. The tidy version strips the param after reading it (`history.replaceState`)
so the visitor doesn't re-share it by accident. Problem: the app runs in a **cross-origin
iframe**, and the param that actually matters lives on the **parent** `vibes.diy` URL —
which the iframe cannot rewrite. So `strip(window.top.location, …)` silently no-ops, and
if the visitor copies their address bar and sends it to a *third* person, that person
opens the app and gets silently added to the *first* person's crew.

**Source:** `vibes/pickathon-picker/App.jsx` (branch `claude/rolling-today`). Two layers:
1. Best-effort strip of the param from the iframe URL (and a try at the parent, which
   usually no-ops cross-origin) — still worth doing to reduce accidental re-shares from
   within the app's own context.
2. The real fix: **don't auto-act on the intent — confirm it.** Adding someone who can
   see your schedule is a deliberate choice, so opening a friend link now pops a
   dialog ("This link wants to add @X to your crew") unless you already follow them.

```js
// effect runs once the friends list is loaded, so "already friends" is knowable
if (friends.some((f) => f.friendSlug === linkedFriend)) { jumpToTheirSchedule(); return; }
setFriendConfirm(linkedFriend); // else: ask first
```

A `handledFriendRef` Set records handles you've resolved (added or declined) this
session, so the prompt doesn't re-fire when the friends list updates after you confirm.

**Gotcha worth repeating:** when a URL param encodes an *action* (add-friend, accept-invite,
apply-coupon) and your app lives in a cross-origin iframe, you cannot guarantee the param
is gone from what the user will re-share — the parent URL is out of your reach. Treat any
such param as an untrusted *proposal*, not a command: confirm before you mutate state.
The strip is hygiene; the confirmation is the actual safety boundary.
