// Owned device-id keybag item TYPES (#2937 — drop `@fireproof/core-types-base`).
//
// Reproduced from `core-types-base`'s `device-id-keybag-item.zod` / `key-bag-if`
// @ 0.24.19 (upstream tag fireproof-storage/fireproof@v0.24.19): the persisted
// keybag item shape (`DeviceIdKeyBagItem`) and the `getDeviceId`/`setDeviceId`
// result (`DeviceIdResult`). The keyed read schema is already owned in
// `../keybag/key-bag.ts` (`KeyedDeviceIdKeyBagItemSchema`); these are the matching
// hand-written types so the keybag never imports a `@fireproof/*` type.
import type { Option } from "@adviser/cement";
import type { JWKPrivate } from "./wire.js";
import type { CertificatePayload } from "./cert-payload.js";

export type DeviceIdKeyBagItem = Readonly<{
  deviceId: JWKPrivate;
  cert?: Readonly<{ certificateJWT: string; certificatePayload: CertificatePayload }>;
}>;

export interface DeviceIdResult {
  readonly deviceId: Option<JWKPrivate>;
  readonly cert: Option<DeviceIdKeyBagItem["cert"]>;
  readonly error?: Error;
}
