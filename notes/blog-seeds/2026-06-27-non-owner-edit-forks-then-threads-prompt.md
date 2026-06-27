# Non-owner edit: route through the fork, not into someone else's chat

**Hook:** the obvious wiring — every chip navigates to `/chat/$owner/$app?prompt64` — silently dead-ends for the majority case. A non-owner can't write the owner's chat.

**Source:** `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx` (`handleEditPrompt` branches on `isOwner`), `vibes.diy/pkg/app/routes/remix.$ownerHandle.$appSlug.tsx` (forwards `prompt64` onto the forked copy's chat URL).

The merge checkpoint pre-filled the chat composer from `?prompt64`. But the card shows suggestion chips to *anyone* with access, and a non-owner who taps one was being routed to `/chat/$owner/$app` — the owner's chat context. The composer pre-fills fine, then **send is rejected server-side**: `prompt-chat-section.ts` looks up the chatContext by `(userId, chatId)`, so a non-matching userId gets "Creation Chat ID not found". The prompt was a write into a session that isn't theirs.

**The trade-off / why:** the spec (§2 "Ownership decides, at the moment of the write") says a non-owner's edit *forks* — makes it theirs. So `handleEditPrompt` branches: owner → `/chat/$owner/$app?prompt64` (edit in place); non-owner → `/remix/$owner/$app?prompt64`. The `/remix` route already does the fork, the login gate (it's behind the auth layout — login-on-first-write, for free), and the `remixOf` lineage seed. We taught it one new trick: forward `prompt64` onto the `/chat/$you/$newSlug` URL it navigates to, where the existing pre-fill effect seeds the composer. No `forkApp` backend change — the prompt rides the URL the whole way.

**Gotcha 1 — the round-trip:** a logged-out non-owner hits the auth layout first. It sets `fallbackRedirectUrl = pathname + search`, so `?prompt64` survives the Clerk sign-in and the remix route still sees it on return. Free, but only because the prompt lives in the URL, not component state.

**Gotcha 2 — TDZ:** `handleEditPrompt` reads `isOwner` in its `useCallback` deps. The deps array is evaluated *during render*, so the callback must be defined **after** the `const [isOwner] = useState(...)` line — putting it up with the other early callbacks throws "Cannot access 'isOwner' before initialization". Move the declaration, not just the reference.
