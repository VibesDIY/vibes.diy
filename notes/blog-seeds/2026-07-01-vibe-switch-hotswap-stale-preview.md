# Opening the Vibe switch shouldn't rewind your app

**Hook:** You publish a vibe from the CLI, open it in the browser, tap the switch to
tweak it — and the live preview flashes back to yesterday's code. Nothing was
redeployed; the *preview* just lied to you.

**Source:** `#2997` / `vibes.diy/pkg/app/hooks/useInVibeGeneration.ts`

**The trade-off / why / gotcha:** The `/vibe` iframe hot-swaps its running source as
codegen streams — that's how in-place edits update the app without a reload. But the
same effect fired on *replayed chat history*: opening the edit card lazily opens the
codegen chat, which replays the persisted chat HEAD into `blocks`, and the hot-swap
pushed that HEAD's code into the iframe. The catch is that CLI `push`/`publish` mint a
production release but never append a chat turn, so the chat HEAD is a *stale dev
draft* that diverges from the live release. Merely opening the switch rewound the
preview to it.

Fix: gate the hot-swap on `hasLocalEdit` — only an edit made *this session* (which
always routes through `sendPrompt`, setting the flag synchronously) swaps the running
app. Replayed history never does. One line, but the subtlety is that "the code the
chat knows about" and "the code that's actually deployed" are two different lineages
once the CLI is in the loop — reconciling that lineage on push is the deeper follow-up.

(Issue #2997 also notes a second, separate mechanism — a same-slug app under a
different handle bleeding into the wrong vibe on a handle switch — left for a
resolution-scoping follow-up; the backend slug-resolution paths all key on the
URL's `(ownerHandle, appSlug)` today.)
