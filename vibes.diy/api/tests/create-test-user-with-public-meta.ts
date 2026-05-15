import { ensureSuperThis } from "@fireproof/core-runtime";
import { DeviceIdCAIf } from "@fireproof/core-types-device-id";
import { DeviceIdCSR, DeviceIdKey, DeviceIdSignMsg } from "@fireproof/core-device-id";

// Local variant of @fireproof/core-device-id's createTestUser that takes
// a custom public_meta. The shipped helper hardcodes
// public_meta to a string sentinel, which is fine for general tests but
// not for tests that exercise claims.params.public_meta-based gates
// (e.g. report endpoints reading publicMetadata.reports).
export interface CreateTestUserWithPublicMetaParams {
  readonly sthis: ReturnType<typeof ensureSuperThis>;
  readonly deviceCA: DeviceIdCAIf;
  readonly userId: string;
  readonly publicMeta: unknown;
}

export async function createTestUserWithPublicMeta(params: CreateTestUserWithPublicMetaParams): Promise<{
  readonly userId: string;
  readonly getDashBoardToken: () => Promise<{ readonly type: "device-id"; readonly token: string }>;
}> {
  const { sthis, deviceCA, userId, publicMeta } = params;

  const devid = await DeviceIdKey.create();
  const devkey = (await DeviceIdKey.createFromJWK(await devid.exportPrivateJWK())).Ok();
  const deviceIdCSR = new DeviceIdCSR(sthis, devkey);
  const rCsrResult = await deviceIdCSR.createCSR({ commonName: `test-device-${userId}` });

  const now = Math.floor(Date.now() / 1000);
  const rProcessResult = await deviceCA.processCSR(rCsrResult.Ok(), {
    azp: `test-app-${userId}-${sthis.nextId().str}`,
    exp: now + 3600,
    iat: now,
    iss: "test-issuer",
    jti: sthis.nextId().str,
    nbf: now,
    params: {
      nick: `nick-${userId}`,
      email: `${userId}@example.com`,
      email_verified: true,
      first: `first-${userId}`,
      image_url: `http://example.com/image-${userId}.png`,
      last: `last-${userId}`,
      name: `name-${userId}`,
      public_meta: publicMeta,
    },
    role: "device-id",
    sub: `device-id-subject-${sthis.nextId().str}`,
    userId,
    aud: ["http://test-audience.localhost/"],
  });

  const deviceIdSigner = new DeviceIdSignMsg(sthis.txt.base64, devkey, rProcessResult.Ok().certificatePayload);
  let seq = 0;
  const getDashBoardToken = async (): Promise<{ readonly type: "device-id"; readonly token: string }> => {
    const tNow = Math.floor(Date.now() / 1000);
    const token = await deviceIdSigner.sign(
      {
        iss: "app-id",
        sub: "device-id",
        deviceId: await devkey.fingerPrint(),
        seq: ++seq,
        exp: tNow + 120,
        nbf: tNow - 2,
        iat: tNow,
        jti: sthis.nextId().str,
      },
      "ES256"
    );
    return { type: "device-id", token };
  };

  return { userId, getDashBoardToken };
}
