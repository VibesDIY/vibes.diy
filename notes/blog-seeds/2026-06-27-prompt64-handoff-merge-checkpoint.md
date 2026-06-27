# prompt64 handoff: a merge checkpoint instead of a live-edit surface

**Hook:** how do you ship the agent-in-vibe card before in-page live editing exists? Don't build the hard part — hand off to the route that already does it.

**Source:** `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx` (chips + "describe a change" → `handleEditPrompt`), `vibes.diy/pkg/app/routes/chat/chat.$ownerHandle.$appSlug.tsx` (the `?prompt64` pre-fill effect).

The UnifiedVibeCard's suggestion chips and "Describe a change to edit this app live:" box need somewhere to send the user's intent. The real destination is in-page live update (#2677), which isn't built. Rather than block the whole epic on it — or keep an integration branch alive — we made a checkpoint: both surfaces `sthis.txt.base64.encode(text)` the prompt and `navigate('/chat/$owner/$app?prompt64=…')`. The chat route already speaks prompt64 (the `/chat/prompt` create flow decodes it), so we taught the *existing-vibe* chat route to read it too.

**The trade-off / why:** we **pre-fill the composer** rather than auto-submit. Landing in the chat with the prompt seeded — user taps send — is strictly lower-risk than firing a codegen turn on navigation: no accidental turns from a stray chip tap, the user can edit first, and it reuses the same `chatInput.current?.setPromptIfEmpty()` path the theme/palette restyle flows already use. `setPromptIfEmpty` (not `setPrompt`) means an incoming prompt never clobbers a half-typed message.

**Gotcha:** `URLSearchParams` to build the query — base64's `+ / =` are URL-significant and would corrupt on a naive string concat. And strip the param after seeding (`setSearchParams(..., { replace: true })`) so a reload doesn't re-seed over what the user has since typed. The strip re-runs the effect, but `prompt64` is now gone so it early-returns — no loop. Guard the effect with `inConstruction` so the create flow (which consumes prompt64 itself) doesn't double-handle.
