# Keybag corruption should collapse into one re-enroll path

Source: #2726 — `vibes.diy/identity/node.ts`, `vibes-diy/cli/main.ts`, `vibes-diy/cli/device-id-env.ts`, and keybag/token regression tests.

When the on-disk device keybag was truncated, empty, or non-JSON, auth flows could leak raw
`read bag failed` throws from deep in keybag reads. The bug wasn't just the throw — different call
sites surfaced different messages, so recovery guidance was inconsistent.

What changed:

- `getKeyBag()` now normalizes unreadable/corrupt bytes into the same structured `DeviceIdResult.error`
  shape used by schema-invalid JSON, instead of exploding the read path.
- Added `isUnreadableDeviceIdKeybagError()` + `deviceIdKeybagReEnrollMessage()` so CLI, login, and
  token minting share one remediation: re-enroll with `vibes-diy login --force` (with headless env
  var guidance where applicable).
- Updated tests to lock the new contract: corrupt bytes should produce structured errors/clean guidance,
  and raw `read bag failed` text should not leak to users.

This is a robustness seam worth keeping: one low-level corruption mode, one user-visible recovery path.
