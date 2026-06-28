# Bringing the toast Copy button inside the card (and scrolling the text)

Source: `vibes.diy/pkg/app/components/CopyableToaster.tsx`

The Copy button on error/warning toasts worked, but it *looked* wrong: it sat as a
bare flex sibling after the message, so on wider toasts it drifted to the far edge
and read as floating outside the card rather than being part of it. Worse, long or
unbroken debug text (a URL, a stack-trace-ish line with no spaces) had no
min-width-0 constraint, so it pushed the card's content past its own side instead
of wrapping or scrolling.

Fix: for copyable toasts only, render the message inside an explicit flex row —
`{icon}` · message-box · `CopyButton`. The message box is `min-w-0 flex-1
max-h-40 overflow-auto`, which is the whole trick:

- **`min-w-0` is load-bearing.** Flex items default to `min-width: auto`, so a long
  unbroken token refuses to shrink below its content width and overflows the card.
  `min-w-0` lets the box shrink, and `overflow-auto` then turns the excess into a
  scrollbar instead of spillover. This is the "container with overflow scroll" the
  bug report asked for.
- **The button is a sibling, not detached.** Keeping `CopyButton` inside the same
  flex row (with `self-start shrink-0`) anchors it to the top-right *inside* the
  card. Dropped the old `ml-1` since the row's `gap-1` now owns the spacing.

Non-copyable toasts (success/plain) keep the default `{icon}{message}` passthrough —
they don't have a button to balance and rarely carry overflow-length text, so
there's no reason to wrap them.

Gotcha: react-hot-toast's `ToastBar` already wraps its children in a flex container,
so it's tempting to skip the inner `<div>` and rely on it. But that container is
shared with the non-copyable path and centers its items; the explicit
`items-start` row is what keeps Copy pinned to the top when the message scrolls
several lines tall.
