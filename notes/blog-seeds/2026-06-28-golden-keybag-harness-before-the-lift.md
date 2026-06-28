# Harness-first on a credential write path: pinning the keybag contract before lifting it

Source: de-fireproof Task 6.1, issue #2716, branch `claude/defireproof-keybag-harness-2716`. The proof gate that lands *before* the actual keybag lift.

The keybag is the credential **write** path — `vibes-diy login` persists the device key + CA cert to `~/.fireproof/keybag/<id>.json`. It had zero enroll/persist unit coverage. The discipline we agreed (with Charlie's design review on #2716): don't lift it until a characterization harness pins the on-disk contract, so the lift can't silently strand a logged-in user.

What made this interesting:

- **The cache hid the real read behavior — and a quick probe nearly encoded the wrong contract.** My first probe wrote a device-id with a *minimal* cert, read it back via `getDeviceId()`, and saw `cert.IsSome()` — so I almost pinned "minimal cert round-trips." Wrong: `getKeyBag` caches per-URL in-memory, so the read returned the value `setDeviceId` had just stashed, never touching the strict schema. Forcing a **cold** read (fresh temp dir → fresh URL → cold cache, or reading the file bytes directly) exposed the truth: the read path **strict-parses the full `CertificatePayloadSchema`**, and the minimal cert is *rejected*. Write is opaque; read is strict. That asymmetry is exactly the kind of thing a harness must lock, and exactly the kind of thing a careless probe gets backwards.

- **Two-phase write is the real contract.** Enroll isn't one write — `deviceIdRegisterEvento` persists **key-only** first, then **key+cert** after the CA callback. So the harness pins both states, and asserts the `cert` key is *absent* (not null) in the key-only file. Charlie's call-site read is what surfaced this; my first sketch only covered the single key+cert round-trip.

- **Real fixture, generated once, frozen forever.** The strict read means the fixture needs a genuine full CA-issued cert, not a hand-stub. Generated it once through the api/tests CA helper (`createTestDeviceCA` → CSR → `processCSR`) and committed the resulting `~/.fireproof/keybag/<id>.json` verbatim. Because the keybag read is purely structural (no expiry check), a cert with fixed `notBefore/notAfter` stays valid indefinitely — no flaky clock dependence.

- **The harness imports through the facade, on purpose.** It pulls `getKeyBag` from `@vibes.diy/identity/node` — the exact re-export the lift will repoint. So the same tests run against fireproof-backed today and the in-repo keybag later, and fail loudly on any drift. The filename (`z3QkefAC57rcrs.json` = `base58btc(hashStringSync("FIREProof:deviceId"))`), the `{id, clazz, item}` envelope, the default `$HOME/.fireproof/keybag` path, and the strict-reject-on-malformed-cert behavior are all locked.

The lesson worth a post: on a write path with no coverage, the harness isn't a formality — it's where you *discover* the contract, and a fast probe will lie to you if you don't defeat the cache first.
