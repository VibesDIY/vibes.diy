// Lifted verbatim from @fireproof/core-device-id@0.24.19 `device-id-key.js`
// (upstream tag fireproof-storage/fireproof@v0.24.19). ES256 P-256 device key:
// generate / import-from-JWK / export / public-key / fingerprint. Only imports
// were adjusted — the jose calls and JWK validation are byte-for-byte the same,
// so keys minted here are interchangeable with the upstream impl (proven by the
// wire-compat cross-verification harness in vibes.diy/api/tests).
import { Result } from "@adviser/cement";
import { JWKPrivateSchema, JWKPublicSchema } from "../types/wire.js";
import type { JWKPrivate, JWKPublic } from "@fireproof/core-types-base";
import type { DeviceIdKeyIf } from "@fireproof/core-types-device-id";
import { generateKeyPair, exportJWK, calculateJwkThumbprint, type GenerateKeyPairOptions } from "jose";
import { sts } from "@fireproof/core-runtime";

export class DeviceIdKey implements DeviceIdKeyIf {
  readonly #privateKey: CryptoKey;

  static async create(opts: GenerateKeyPairOptions = { extractable: true }): Promise<DeviceIdKey> {
    const pair = await generateKeyPair("ES256", opts);
    return new DeviceIdKey(pair.privateKey as CryptoKey);
  }

  static async createFromJWK(jwk: JWKPrivate, opts: GenerateKeyPairOptions = { extractable: true }): Promise<Result<DeviceIdKey>> {
    const parsed = JWKPrivateSchema.safeParse(jwk);
    if (!parsed.success) {
      return Result.Err(`Invalid JWK: ${parsed.error.message}`);
    }
    const j = parsed.data;
    const rKey = await sts.importJWK(j, undefined, opts);
    if (rKey.isErr()) {
      return Result.Err(rKey);
    }
    return Result.Ok(new DeviceIdKey(rKey.Ok().key as CryptoKey));
  }

  private constructor(pair: CryptoKey) {
    this.#privateKey = pair;
  }

  async fingerPrint(): Promise<string> {
    return calculateJwkThumbprint(await this.exportPrivateJWK(), "sha256");
  }

  async exportPrivateJWK(): Promise<JWKPrivate> {
    const jwk = await exportJWK(this.#privateKey);
    const { success, data } = JWKPrivateSchema.safeParse(jwk);
    if (!success || !data) {
      throw new Error("Invalid JWK");
    }
    return data;
  }

  async publicKey(): Promise<JWKPublic> {
    const privateJWK = await exportJWK(this.#privateKey);
    const { success, data, error } = JWKPublicSchema.safeParse(privateJWK);
    if (!success || !data) {
      throw new Error(`Invalid public JWK: ${error.message}`);
    }
    return data;
  }
}
