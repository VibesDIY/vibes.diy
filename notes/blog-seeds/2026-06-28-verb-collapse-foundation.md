# Clearing the deck for in-place generation: the verb-collapse that mostly wasn't there

Source: #2679 (verb collapse), #2720 (handle-picker regression test), #1856 ("it's yours now"), prepping #2677

Goal: a solid base for #2677 (first-generation in place) by collapsing the legacy
copy-verb chrome (#2679), locking in the handle-picker behavior (#2720), and adding
the #1856 fork message. The most interesting finding: **most of the "verb chrome"
the epic earmarked for deletion never existed.**

Decisions / findings worth a full post:

- **Investigate before you delete.** The epic's §7 ledger lists the four-button
  action bar (#1708) and the EDIT/CLONE/REMIX submenu (#1709) as deletions. A full
  consumer sweep found they were *planned but never built* — and the
  `ExpandedVibesPill`'s Edit/Clone/Remix sub-buttons were never wired by the vibe
  route. So #2677 already has a clean base in that respect; the only real deletion
  was the now-dead `ExpandedVibesPill` (replaced by `UnifiedVibeCard`, referenced
  only by docs). "Delete the chrome" turned into "delete one dead component" — the
  diff that *doesn't* happen is the result.
- **The one surviving verb is design-gated, so it stays.** The visitor landing
  card's "Fresh Install" button is the only copy-verb left, but it lives on the
  pre-access gate, and replacing it with the implicit-fork-on-edit model is part of
  the access-view redesign the epic explicitly defers (§1e). Knowing what *not* to
  delete kept this PR from wandering into undesigned territory.
- **Plain functions beat a hook when the route's effect order fights you.** #2720
  asked for a `useHandlePicker` hook to make the create-ok/persist-fail path
  testable. But the route resolves `isOwner` *early* (before `refreshViewerFromWhoAmI`
  is defined) and the picker writes need that refresh *late* — a hook owning both
  hits a definition-order tangle. Extracting the two async writes as pure functions
  (`switchActiveHandle` / `createAndUseHandle`, deps injected) is more testable than
  a hook *and* sidesteps the ordering problem. The issue suggested a hook; the code
  said functions.
- **#1856 needs a transient signal, not the permanent one.** `remixOf` marks lineage
  forever, so it can't answer "did you *just* make this yours." The fork landing now
  carries a one-shot `?yours=1` flag that a tiny shared hook (`useYoursNowToast`)
  turns into a single toast and scrubs from the URL — on both landings (remix→/chat,
  clone→/vibe). Race-tolerant scrub: re-runs retry the delete but never re-toast.
- **isolate:false makes partial module mocks a liability.** A first cut mocked
  `react-hot-toast` as `{ toast: { success } }`; under the repo's `isolate:false`
  vitest config that bled into sibling files and made `toast.error` undefined three
  files away (and knocked over an unrelated ViewControls test). The fix: `vi.spyOn`
  the real `toast.success` instead of replacing the module — touch one method, leave
  the rest real, restore cleanly. When isolation is off, prefer spies over module
  mocks.
