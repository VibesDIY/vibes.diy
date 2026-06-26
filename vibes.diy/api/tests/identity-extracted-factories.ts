// The swap point for the wire-compat cross-verification harness. Each factory
// returns the IMPLEMENTATION UNDER TEST. v1 delegates to @fireproof/* so the
// harness is green before any extraction; as each @vibes.diy/identity module
// lands, repoint the matching factory at it (via the exported `./node` subpath).
// When all point at the extracted impl and the cross-verify tests stay green,
// the fireproof backing is provably equivalent and can be dropped.
// Tasks 2-3: device-id crypto (key/sign/csr) + server verifier + CA are the
// in-repo lifts, reached through the exported ./node subpath (the package exports
// only . / ./server / ./node — no ./device-id/*).
import { DeviceIdKey, DeviceIdSignMsg, DeviceIdCSR, DeviceIdVerifyMsg, DeviceIdCA } from "@vibes.diy/identity/node";

export const extracted = {
  DeviceIdKey,
  DeviceIdSignMsg,
  DeviceIdCSR,
  DeviceIdVerifyMsg,
  DeviceIdCA,
};
