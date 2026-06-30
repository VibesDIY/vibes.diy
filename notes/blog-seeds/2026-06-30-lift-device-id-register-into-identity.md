# Lifting the device-id register flow out of the fireproof build tool

Source: `claude/type-building-refactor-mjighw` (#2894)

`@vibes.diy/identity` still re-exported its `vibes-diy login` device-id
registration symbols (`deviceIdRegisterEvento`, `isResDeviceIdRegister`,
`ReqDeviceIdRegister`) straight from `@fireproof/core-cli` — the last *value*
import dragging the heavy fireproof graph (core-keybag, core-device-id,
core-runtime) back into identity through the CLI barrel's back door, even though
identity already owns all of that crypto in-repo. We lifted the register handler
verbatim into `identity/device-id/register.ts`, re-wired onto the owned
`getKeyBag` / `DeviceIdKey` / `DeviceIdCSR` / `CertificatePayloadSchema`.

The interesting trade-off is **doing the lift without re-architecting the
types**. The rest of identity is zod; this slice is arktype. The tidy instinct
is to re-type as you move — but that fuses two risks (relocation + revalidation)
into one diff, and the register path's whole job is to keep an enrolled device
registering with *no re-login*. So we kept arktype byte-identical, made the lift
provably wire-compatible, and left the arktype→zod conversion as an explicit
follow-up. "Lift now, optimize later" keeps the blast radius of each step
auditable.

Gotcha worth capturing: the handler still needs the cmd-ts streaming glue
(`sendMsg`/`sendProgress`), which is framework, not identity. Rather than import
it (a value import from core-cli, which is exactly what we're killing), we kept
two tiny module-private copies and referenced only the `WrapCmdTSMsg`/
`CmdProgress` *types* from core-cli — type-only imports are the permitted end
state. The other subtlety: the evento reaches `sthis` off the registering CLI's
`cliCtx`, but typing that against the CLI's `CliCtx` would invert the dependency
(the CLI depends on identity, not vice-versa), so we typed it structurally as
`{ sthis }`.
