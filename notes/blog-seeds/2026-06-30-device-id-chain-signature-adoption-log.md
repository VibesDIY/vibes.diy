# Measuring a security flag-flip instead of guessing a date

Source: `claude/issue-2824-2wt725`

The #2671 device-id auth bypass was fixed in #2819, but the enforcement that
actually rejects forged tokens (`DEVICE_ID_REQUIRE_CA_SIGNATURE`) ships
default-off so pre-3.0 CLIs keep authenticating during rollout. The plan for
turning it on was "bake a few days, then flip" — a calendar guess about whether
the CA-signing CLI had propagated.

This adds the ~5-line adoption-visibility log the issue recommended:
`DeviceIdApiToken.verify` now decodes the token header and logs
`chainSignature: present|absent` (alongside the current `requireCASignature`
state) for each device-id verify. "Present" means the client already emits the
CA-signed cert chain (`x5c#jwt`); "absent" means a legacy minter. So "flip in a
few days" becomes "flip when `absent` ≈ 0" — a measured rollout you can watch in
the logs instead of a date you hope is late enough.

The signal-quality subtlety (caught in review by Codex and Charlie on #2956):
the log MUST fire only after a *successful* verify, not on every attempt.
`/_auth/session`'s bearer bridge probes `Object.keys(tokenApi)` until one type
verifies, and `tokenApi` registers `device-id` before `clerk` — so a plain Clerk
bearer is tried against the device-id verifier first and fails. Logging before
that check would stamp every Clerk request as `chainSignature:absent` and bury
the legacy-device-id signal under ordinary Clerk traffic. Gating on `res.valid`
keeps "absent" meaning a genuine legacy device-id minter.

The interesting gotcha was the test, not the code. `tokenApi` is wrapped in
cement's `Lazy`, which memoizes on the *first* call and ignores later args — so
`tokenApi(mockLoggerSthis, ...)` handed back the instance bound to the shared
test sthis, and the MockLogger collector stayed empty while the logs went to
stdout. The fix was to export `DeviceIdApiToken` from the server facade and
`new` it directly with the MockLogger-backed sthis, bypassing the memo. Worth
remembering whenever you want a fresh instance from a `Lazy` factory under test.
