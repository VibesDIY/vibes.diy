# Closing an auth-bypass you can't close without breaking someone

Source: `claude/issue-2671-s65spx` — fix #2671 (device-id token verifier trusted
the embedded cert by issuer-NAME, never by CA signature)

The de-fireproof Task 5 lift brought the device-id token verifier in-repo
*verbatim* — including a latent auth bypass. `DeviceIdVerifyMsg` decided a cert
was trustworthy by `cert.iss === trustedCA.sub` (a string compare on the issuer
*name*) and then verified the token with the public key taken from that *same
client-supplied cert*. The CA's key never signed anything in that path. So any
logged-in user could forge a self-issued cert naming the CA as `iss`, embed their
own key, self-sign a token, and verify as valid. The CA name isn't secret — it's
the `iss` of every cert a user already holds.

The fix is the obvious one (verify the CA's signature over the cert), but the
*shape* of the fix is the interesting part:

- **The CA signature already existed client-side — it just wasn't on the wire.**
  The signer embedded the unsigned cert *payload* in the JWT `x5c` header and
  threw away the CA-signed `certificateJWT`. But the keybag stores BOTH
  (`{ certificateJWT, certificatePayload }`), so the chain signature was sitting
  on every enrolled device the whole time. That's what makes "no forced re-login"
  achievable: the signer just stops discarding it.

- **Additive header, not a replacement.** Rather than swap `x5c[0]` for the signed
  JWT (which would break `decode()`, the thumbprint math, and the de-fireproof
  byte-equivalence harness that pins us against upstream), the signer *adds* a new
  `x5c#jwt` protected header carrying the CA-signed `CERT+JWT`. Omit it and the
  header is byte-identical to upstream — so the cross-verification harness stayed
  100% green. The verifier `jwtVerify`s that header against the CA key it already
  holds (the CA cert payload's `subjectPublicKeyInfo`) and then binds it: the
  CA-signed payload must equal the `x5c[0]` cert that actually verified the token,
  or a forger could staple a real CA-signed cert over a different device key.

Worth a note:

- **You cannot close an auth bypass in a backward-compatible way.** Closing it
  means rejecting tokens you used to accept — by definition. There's no purely
  additive fix: a lenient-if-absent verifier is just the bypass with extra steps
  (the attacker omits the header). So enforcement *has* to reject CA-unsigned
  tokens, and that *will* break any client still minting the old shape.

- **So the rollout is the design, not an afterthought.** Device-id tokens are
  CLI-minted (Node keybag) and worker-verified, and the spec's wire-compat gate
  says older *published* CLIs must keep authenticating. The reconciliation:
  enforcement is gated behind `DEVICE_ID_REQUIRE_CA_SIGNATURE` (default OFF). This
  PR ships the full mechanism + tests and changes zero production behavior; the
  security close is a one-line env flip in the worker *after* the CA-signing CLI
  is published and adopted. A present-but-invalid chain signature is rejected
  regardless of the flag — only the *presence* requirement is gated.

- **An env flag is the honest form of a review checkpoint.** The issue asked for
  "an explicit review checkpoint" before the protocol change goes live. A default-
  off flag encodes that literally: the code, the tests, and the divergence from
  upstream all land and get reviewed now; the human owns the moment it bites.
