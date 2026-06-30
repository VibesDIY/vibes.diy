# The test that passed when sharded and failed when not

Source: `jchris/sharemodal-test-isolation`

`pkg@p3.0.5`'s npm publish failed on a single test — `ShareModal "renders nothing
when closed"` — that had passed minutes earlier in the same commit's ship
fan-out. The tell: the fan-out runs the suite **sharded** (`test×4`); the package
publish runs it **unsharded**. The app suite uses `isolate: false` (a deliberate
~870s-prepare speed win that reuses one browser page across files in a worker),
so `document.body` is shared. ShareModal portals its dialog into `document.body`,
and the closed-state test asserted global *absence* (`screen.queryByRole("dialog")`).
Any earlier file in the same worker that leaked a dialog tripped it — and which
files share a worker depends on sharding, so the bug hides under `test×4` and
only surfaces in the single unsharded publish run.

The angle: under `isolate:false`, asserting on the *absence* of global DOM is a
latent order-dependent flake. The fix is to assert the **delta** — "this render
added no dialog of its own" — never the global count. Also a good story about
why an order-dependent bug can be impossible to reproduce locally (file→worker
assignment differs from CI) yet trivial to reproduce *mechanically* by seeding
the leak yourself.
