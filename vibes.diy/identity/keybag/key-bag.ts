// The device-id slice of @fireproof/core-keybag@0.24.19 `key-bag.js`, lifted
// verbatim (upstream tag fireproof-storage/fireproof@v0.24.19). Only `getDeviceId`
// / `setDeviceId` + their `KeyedResolvOnce` cache are carried: the general
// keystore methods (`getNamedKey`/`getJwt`/`setRawObj`/…) are dead on arrival in
// the identity keybag — nothing reaches them through `getKeyBag` (the database-key
// path uses firefly's own keybag), so they are intentionally not lifted (the later
// cleanup pass owns that boundary). Behavior of the carried path is byte-identical
// (gated by the keybag golden harness).
//
// The keyed-item schema is rebuilt from the already-owned `JWKPrivateSchema`
// (types/wire.ts) and `CertificatePayloadSchema` (types/cert-payload.ts) so the
// read path validates exactly as upstream's `KeyedDeviceIdKeyBagItemSchema` did,
// with no `@fireproof/core-types-base` VALUE import. It stays un-exported so its
// inferred Zod type never crosses the package declaration boundary (TS2883).
import { KeyedResolvOnce, Lazy, Option } from "@adviser/cement";
import type { URI } from "@adviser/cement";
import { hashStringAsync, hashStringSync } from "../runtime/hashing.js";
import type { SuperThis } from "../types/sthis.js";
import type { JWKPrivate } from "../types/wire.js";
import type { DeviceIdResult, DeviceIdKeyBagItem } from "../types/keybag-item.js";
import { z } from "zod";
import { JWKPrivateSchema } from "../types/wire.js";
import { CertificatePayloadSchema } from "../types/cert-payload.js";

const KeyedDeviceIdKeyBagItemSchema = z
  .object({
    id: z.string(),
    clazz: z.literal("DeviceIdKeyBagItem"),
    item: z
      .object({
        deviceId: JWKPrivateSchema,
        cert: z
          .object({
            certificateJWT: z.string(),
            certificatePayload: CertificatePayloadSchema,
          })
          .readonly()
          .optional(),
      })
      .readonly(),
  })
  .readonly();

export interface KeyBagProvider {
  get(id: string): Promise<unknown>;
  set(id: string, item: unknown): Promise<void>;
  del(id: string): Promise<void>;
}

export interface KeyBagRuntime {
  readonly url: URI;
  readonly sthis: SuperThis;
  getBagProvider(): Promise<KeyBagProvider>;
  id(): string;
}

const deviceIdKey = hashStringSync("FIREProof:deviceId");
const namedKeyItemsPerUrl = new Map<string, KeyedResolvOnce<DeviceIdResult>>();

export class KeyBag {
  readonly rt: KeyBagRuntime;
  readonly #namedKeyItems: KeyedResolvOnce<DeviceIdResult>;

  static async create(rt: KeyBagRuntime): Promise<KeyBag> {
    const urlHash = await hashStringAsync(rt.url.toJSON());
    const namedKeyItems = namedKeyItemsPerUrl.get(urlHash) ?? new KeyedResolvOnce<DeviceIdResult>();
    return new KeyBag(rt, namedKeyItems);
  }

  private constructor(rt: KeyBagRuntime, namedKeyItems: KeyedResolvOnce<DeviceIdResult>) {
    this.rt = rt;
    this.#namedKeyItems = namedKeyItems;
  }

  provider = Lazy(() => this.rt.getBagProvider());

  async getDeviceId(): Promise<DeviceIdResult> {
    const id = deviceIdKey;
    return this.#namedKeyItems.get(id).once(async () => {
      const raw = await this.provider().then((p) => p.get(id));
      const r = KeyedDeviceIdKeyBagItemSchema.safeParse(raw);
      let error = undefined;
      if (!r.success) {
        error = r.error;
        return {
          deviceId: Option.None<JWKPrivate>(),
          cert: Option.None<NonNullable<DeviceIdKeyBagItem["cert"]>>(),
          error,
        };
      }
      return {
        deviceId: Option.Some(r.data.item.deviceId as JWKPrivate),
        cert: Option.From(r.data.item.cert as DeviceIdKeyBagItem["cert"]),
        error,
      };
    });
  }

  async setDeviceId(_deviceId: JWKPrivate, _cert?: DeviceIdKeyBagItem["cert"]): Promise<DeviceIdResult> {
    const id = deviceIdKey;
    this.#namedKeyItems.unget(id);
    return this.#namedKeyItems.get(id).once(async () => {
      await this.provider().then((p) =>
        p.set(id, {
          id,
          clazz: "DeviceIdKeyBagItem",
          item: {
            deviceId: _deviceId,
            cert: _cert,
          },
        })
      );
      return {
        deviceId: Option.Some(_deviceId),
        cert: Option.From(_cert),
      };
    });
  }
}
