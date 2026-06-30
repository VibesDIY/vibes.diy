# Turning on a privileged write means resolving exactly one string — correctly

Source: `claude/admin-allowlist-jchris-prod` — populating `VIBES_ADMIN_USER_IDS`
in `[env.prod]` with jchris's account so admin-on-behalf cached-suggestion
blessing (#2942) goes from inert to live for him. One env var, one value. The
story is entirely in *getting the value right*.

- **"Add my user" is a userId lookup, and the obvious source was wrong.** The
  allowlist matches `claims.userId` exactly, so I had to know precisely what that
  string is — not the handle, not the email. First instinct: resolve
  `jchris@gmail.com` (the git/operator email) via the Clerk Backend API → a
  `user_…` id. But cross-checking against the *authoritative* source — the
  `VIBES_DEVICE_ID` cert the server actually verifies — revealed the cert's
  `creatingUser.claims.userId` belonged to a **different account**
  (`jchris@vibes.diy`), with `public_meta.reports:["*"]`. Two real Clerk accounts,
  two different `user_…` ids. The lookup that *looked* authoritative (admin secret
  + email) resolved the wrong one for the credential actually in play.

- **A fail-safe wrong value is still a wrong value — so confirm, don't guess.**
  Misconfiguring the allowlist fails closed (the admin just can't bless — no
  security hole), which is the right failure mode but a terrible reason to skip
  verification: the feature would silently not work. Because admin-on-behalf is
  server-only right now (no UI), the account that can actually *invoke* it is the
  one making authed CLI/API calls — the device-id identity (`jchris@vibes.diy`),
  not the git email. That's the one that went on the list, confirmed before
  writing prod config.

- **The cross-check also settled a load-bearing assumption for free.** The same
  device-cert decode proved `claims.userId` *is* the Clerk `user_…` id (the
  `creatingUser.claims.userId` matched the resolved Clerk id format), so the
  allowlist format is right. Worth doing once: the entire gate keys on that
  equality holding.

Preview is a separate Clerk instance with a different `user_…` for the same
person, so enabling admin-on-behalf there is its own one-line change with its own
resolved id — not a copy of the prod value.
