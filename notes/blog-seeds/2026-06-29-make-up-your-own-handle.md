# Let people name their own handle instead of being assigned one

Source: `vibes.diy/base/components/HandlePickerMenu.tsx`,
`vibes.diy/pkg/app/routes/handle-picker-actions.ts`

The active-handle switcher's "New handle" row used to be a one-click action: it
called `createHandleBinding({})` and the server minted a random three-word slug
(`fresh-blue-otter`). Functional, but it *decided for you* — there was no way to
say "I want to be `@ziggy`." The API already accepted an optional `ownerHandle`;
only the UI never offered a place to type one.

Fix: clicking "New handle" now reveals an inline form inside the picker dropdown
(a text input + Create), rather than firing the create immediately. A "Surprise
me with a random one" button preserves the old zero-effort path for people who
don't care. `onNewHandle` went from `() => void` to `(handle?: string) => void`,
and `createAndUseHandle` forwards `ownerHandle ? { ownerHandle } : {}` so the
empty case still gets the server's random slug.

- **The live preview is the load-bearing detail.** The server sanitizes a typed
  handle through `toRFC2822_32ByteLength` (lowercase, non-`[a-z0-9-]` → `-`,
  collapse/trim dashes, 32-char cap). If the input echoed raw text, "My Cool
  Handle!" would silently become `@my-cool-handle` on submit and surprise the
  user. So the form previews `@<sanitized>` as you type — what you see is the
  binding you get. The Create button stays disabled while the sanitized result is
  empty (e.g. you typed only `---`), which doubles as the client-side validity
  gate.
- **One sanitizer, not two — and idempotency is the contract that lets them be
  one.** The first cut hand-copied the server regex into `base` with "mirror of
  the server" comments on both sides. Two reviewers (Codex + Charlie) immediately
  found the drift it invited: the original ordering sliced to 32 chars _after_
  trimming dash edges, so truncation could land on a dash (`31 letters + "!b"` →
  `…a-b` → slice → `…a-`). The picker submits its already-sanitized slug and the
  server sanitizes _again_ on write; that second pass strips the trailing dash, so
  the persisted handle (`…a`, 31 chars) differed from the preview (`…a-`). The fix
  is two moves: (1) slice _before_ the trailing-dash trim so the function is
  **idempotent** — `f(f(x)) === f(x)` — which is exactly the property that lets a
  client preview equal a server-rewritten value; and (2) hoist the one true
  `toRFC2822_32ByteLength` into the shared leaf `@vibes.diy/vibe-types` (where the
  db-ACL eval already lives as "single source of truth, shared by api-svc and
  vibe-runtime"), so `base` imports it and the server re-exports it for its
  existing callers. No more copy, no more drift, and the server picked up the
  idempotency fix for free across its other slug call sites (fork, chat-id).

The success toast also changed from `Now acting as @${created}` to
`… — click the avatar circle to set a photo`, because a freshly minted handle has
no avatar and the photo editor *is* the avatar circle in the card header (there's
deliberately no "Edit photo" menu row — we tried and removed one in #2666). The
toast is the only moment we know the user just made a handle, so it's the right
place to point them at the one non-obvious next step.

Gotcha: the form's open/draft state lives in `HandlePickerMenu`, which unmounts
when the dropdown closes (`pickerOpen` flips false in `UnifiedVibeCard`). That's
why there's no explicit "reset the form on close" — reopening remounts it clean.
Convenient, but it means the form can't persist a half-typed handle across an
accidental close; that's an acceptable trade for not threading the state up.
