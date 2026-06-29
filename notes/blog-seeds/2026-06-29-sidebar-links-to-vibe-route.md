# Sidebar vibe links land on the running app, not the chat editor

Source: `claude/sidebar-links-vibe-route-ck2a5b`

The "My Apps" and "Memberships" lists in the session sidebar both linked each
row to `/chat/:ownerHandle/:appSlug` — dropping you into the chat/editor view
of the vibe rather than the vibe itself. Switched both `RecentVibes` and
`Memberships` to point at the canonical `/vibe/:ownerHandle/:appSlug` route, so
tapping a vibe in the sidebar opens the running app first. The gotcha worth a
line: there are two parallel route families for the same owner/slug pair
(`/chat/...` is the editor, `/vibe/...` is the app), and it's easy for new
nav surfaces to default to whichever one was copy-pasted from nearby code.
Both routes accept the same optional `:fsId?` segment, so the swap is a clean
prefix change with no param plumbing.
