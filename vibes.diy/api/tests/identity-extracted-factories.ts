// The swap point for the wire-compat cross-verification harness. Each factory
// returns the IMPLEMENTATION UNDER TEST. v1 delegates to @fireproof/* so the
// harness is green before any extraction; as each @vibes.diy/identity module
// lands, repoint the matching factory at it (via the exported `./node` subpath).
// When all point at the extracted impl and the cross-verify tests stay green,
// the fireproof backing is provably equivalent and can be dropped.
import { DeviceIdKey, DeviceIdSignMsg, DeviceIdVerifyMsg } from "@fireproof/core-device-id";

export const extracted = {
  DeviceIdKey,
  DeviceIdSignMsg,
  DeviceIdVerifyMsg,
};
