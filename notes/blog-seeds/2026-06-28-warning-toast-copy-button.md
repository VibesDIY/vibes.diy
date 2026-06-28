# Copy buttons on warning toasts, not just errors

Source: `vibes.diy/pkg/app/components/CopyableToaster.tsx`, `vibes.diy/pkg/app/components/ResultPreview/PreviewApp.tsx`

`CopyableToaster` already appended a "Copy" button to error toasts so a user could
grab a stack-trace-ish message for debugging. Warnings — "preview may be stale",
"Hot-swap failed: …" — are just as worth copying (they carry the failure detail
the user needs to report), but the button was gated on `t.type === "error"`.

Decisions worth a full post:

- **react-hot-toast has no "warning" type — the icon *is* the type.** Warnings are
  plain `toast("…")` calls (type `"blank"`) distinguished only by `icon: "⚠️"`.
  Keying the Copy button off `t.type === "blank"` would have splattered Copy onto
  every neutral toast. So the discriminator is the icon itself: a shared
  `WARNING_ICON` constant, exported from `CopyableToaster` and imported at the
  call sites, keeps the producer and the detector from drifting. The detection
  collapsed into one predicate, `isCopyableToast(t)` = error-or-warning **and**
  has plain text — pure and unit-testable without a DOM.
- **Duration is part of the feature, not a detail.** Error toasts already got a
  10s duration *specifically* so there's time to click Copy. A copy button on a
  4s default-duration warning is a button that vanishes before you reach it — so
  the two warning call sites now pass `duration: 10000` too. The affordance and
  the time-to-use it have to ship together.

Gotcha: the longer error duration lives in `<Toaster toastOptions={{ error: {...} }}>`
(per-*type* config), but warnings are type `"blank"` — you can't bump warning
duration there without bumping *all* blank toasts. So warning duration is set
per-call at the two `toast(...)` sites instead. If a third warning toast appears,
it needs the same `WARNING_ICON` + `duration: 10000` pair or it'll regress on both
axes silently.
