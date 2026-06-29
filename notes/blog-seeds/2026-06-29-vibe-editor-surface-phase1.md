# Building on the seams a refactor already cut

Source: `claude/retire-chat-phase-1-vibe-editor` — Phase 1 of retiring `/chat`
(#2518): the in-page tabbed editor surface (Code/Data/Chat/Settings) on `/vibe`

Phase 1 added a four-tab editor surface to the running-app route — and almost
none of it was new code. The Code tab is a thin read-only shiki viewer over the
*existing* `code-view-files` utils and the `hydratedFileSystem` that
`useChatHydration` already populates; Data reuses `DataView` verbatim (it only
ever read route params); Settings reuses `SettingsTab` with one new optional
`hide` prop; the card just gained an `onOpenEditor` nav button next to the
existing Edit/Share. The surface is composition, not construction.

Worth a note:

- **The cheapest features ride existing seams.** The unified card already had a
  `body`/`selectedNav` slot pattern (built for the Share panel); the editor
  surface is the same slot with more tab values. When a refactor leaves a clean
  seam, the next feature should look like "one more case," not a new subsystem.
  If it doesn't, that's a signal the seam is wrong.
- **A plan's nouns are hypotheses; execution falsifies them.** The plan assumed
  `useChatHydration` would give the Code tab *and* the Chat tab content. It
  hydrates the file system, not the message log — so the Chat tab came up empty
  for an already-built vibe. The honest fix wasn't to fake history or silently
  drop the tab: it was to say "history isn't loaded here yet" (it exists, it just
  isn't replayed into this view) and defer the heavier chat-session replay to the
  issue that owns it (#2677). Name the boundary in the UI copy, not just the
  changelog.
- **Keep the heavy dep behind the lazy boundary it came with.** The Code tab
  deliberately uses shiki via a dynamic `import("shiki")` rather than the Monaco
  editor — Monaco's `lazy()` boundary already kept it out of the `/vibe` bundle,
  and view-first lets Phase 1 skip Monaco entirely. The editing path (and Monaco)
  is Phase 2, where the save-state machine gets its own tests.
- **Review the wiring, not just the green check.** Two real bugs survived a
  green build: file tabs that set state nobody read (so clicking did nothing),
  and a "no code" empty-state that hid legitimately-streamed source. Typecheck
  can't see "this control is inert" — reading the diff can.
