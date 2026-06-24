# Teaching the codegen model that "owner" isn't the default — author-owned is

Source: `claude/owner-role-seeding-prompts` (phase 1 of #2553 / #2554)

The interesting half of retiring `isOwner` wasn't the runtime seed — it was the
prompt. The old codegen guidance reflexively reached for `if (!user.isOwner)
throw "owner only"`, which made "the owner must grant roles before anyone can
participate" the *default* shape of every generated app. The fix flips the
default to author-owned (anyone signed-in creates and edits their own), demotes
owner-managed channels to the advanced case, and — the subtle enabler — gates
owner-only docs on `ctx.requireRole("owner")` instead of `user.isOwner`, which
works with *zero* declaration because the runtime always seeds the owner into a
reserved `owner` role. Worth a post on how a one-line prompt default ("author-
owned, not owner-gated") changes the generated permission model of thousands of
apps, plus the clean separation it forced: public/private is the owner's ACL
envelope, never something `access.js` implements.
