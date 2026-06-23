# Why "owner" was the wrong primitive inside a vibe's access function

Source: `claude/vibe-save-permissions-zehx4d` (PR pending)

A real vibe locked its own owner out of saving. The cause: write authority ran
through a magic `user.isOwner` boolean resolved across three independent code
paths, and the access function granted owner-write *only* via that flag — so the
moment it resolved false anywhere (multi-handle user, handle-binding gap, client
predictor), the owner was stuck behind a `requireRole("editor")` they were never
granted. The fix is a mindset flip worth a post: stop treating "owner" as an
ambient super-user inside data access, and instead have the *generator declare*
the roles the owner should be seeded with at deploy time. Declaration beats
runtime extraction because the model already knows the role names it just wrote.
The trade-off worth expanding: a reserved always-seeded `owner` role looks like
the thing you deleted, but a visible/revocable/transferable grant is categorically
different from a boolean evaluated in three places.
