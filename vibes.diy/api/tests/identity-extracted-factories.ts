// The swap point for the wire-compat cross-verification harness. Each factory
// returns the IMPLEMENTATION UNDER TEST. v1 delegates to @fireproof/* so the
// harness is green before any extraction; as each @vibes.diy/identity module
// lands, repoint the matching factory at it (via the exported `./node` subpath).
// When all point at the extracted impl and the cross-verify tests stay green,
// the fireproof backing is provably equivalent and can be dropped.
import { DeviceIdVerifyMsg } from "@fireproof/core-device-id";
// Task 2: device-id client crypto (key/sign/csr) is the in-repo lift, reached
// through the exported ./node subpath (the package exports only . / ./server /
// ./node — no ./device-id/*). The verifier stays fireproof until Task 3.
import { DeviceIdKey, DeviceIdSignMsg, DeviceIdCSR } from "@vibes.diy/identity/node";

export const extracted = {
  DeviceIdKey,
  DeviceIdSignMsg,
  DeviceIdCSR,
  DeviceIdVerifyMsg,
};
