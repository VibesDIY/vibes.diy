# The CI guard that catches fake publish coverage drift

Source: `charlie/issue-2889-pack-script-guard` (follow-up from #2889)

The tricky part of publish-path CI coverage is not just "does a pack job run"
— it's whether every publishable workspace package still has a real
`scripts.pack` path behind that check. This guard made that contract explicit:
non-private packages must define `scripts.pack`, only a short allowlist can use
`echo` stubs, and the allowlist itself fails when it goes stale. It turns a
quiet coverage drift into a loud lint failure.
