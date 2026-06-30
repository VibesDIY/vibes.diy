// Device-id TEST helpers, lifted verbatim from @fireproof/core-device-id@0.24.19
// `create-test-device-id.js` / `create-test-user.js` (upstream tag
// fireproof-storage/fireproof@v0.24.19), wired to the in-repo DeviceIdCA /
// DeviceIdKey / DeviceIdCSR / DeviceIdSignMsg (#2937). These mint a throwaway
// device CA and an enrolled "user" whose `getDashBoardToken()` produces the
// legacy (CA-unsigned, no `x5c#jwt`) device-id token shape the api auth tests
// drive. Exposed on the dedicated `@vibes.diy/identity/testing` subpath so test
// code never reaches into `@fireproof/core-device-id`, and so the helpers stay
// out of the shipped `.` / `./node` surfaces.
import { Lazy } from "@adviser/cement";
import type { SuperThis } from "../types/sthis.js";
import type { DeviceIdCAIf } from "../types/device-id-types.js";
import type { DashAuthType } from "../types/wire.js";
import { DeviceIdCA } from "./ca.js";
import { DeviceIdKey } from "./key.js";
import { DeviceIdCSR } from "./csr.js";
import { DeviceIdSignMsg } from "./sign.js";

export async function createTestDeviceCA(sthis: SuperThis): Promise<DeviceIdCA> {
  const caKey = await DeviceIdKey.create();
  const caSubject = {
    commonName: "Test Device CA",
    organization: "Test Organization",
    locality: "Test City",
    stateOrProvinceName: "Test State",
    countryName: "US",
  };
  return new DeviceIdCA({
    base64: sthis.txt.base64,
    caKey,
    caSubject,
    actions: {
      generateSerialNumber: async () => sthis.nextId(32).str,
    },
  });
}

const sessionId = Lazy((sthis: SuperThis) => sthis.nextId().str);
const seqUserIdGlobal = Lazy((sthis: SuperThis) => ({ id: parseInt(sessionId(sthis).replace(/[^0-9]/g, ""), 10) }));

export interface CreateTestUserParams {
  readonly sthis: SuperThis;
  readonly deviceCA: DeviceIdCAIf;
  readonly session?: string;
  readonly seqUserId?: number;
}

export interface TestUser {
  readonly devkey: DeviceIdKey;
  readonly deviceIdSigner: DeviceIdSignMsg;
  getDashBoardToken(): Promise<DashAuthType>;
}

export async function createTestUser({ sthis, session, seqUserId, deviceCA }: CreateTestUserParams): Promise<TestUser> {
  const devid = await DeviceIdKey.create();
  const devkey = (await DeviceIdKey.createFromJWK(await devid.exportPrivateJWK())).Ok();
  const deviceIdCSR = new DeviceIdCSR(sthis, devkey);
  const rCsrResult = await deviceIdCSR.createCSR({ commonName: "test-device-id" });
  const userId = `${session ?? sessionId(sthis)}-${seqUserId ?? seqUserIdGlobal(sthis).id++}`;
  const rProcessResult = await deviceCA.processCSR(rCsrResult.Ok(), {
    azp: `test-app-${userId}-${sthis.nextId().str}`,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    iss: "test-issuer",
    jti: sthis.nextId().str,
    nbf: Math.floor(Date.now() / 1000),
    params: {
      nick: `nick-${userId}`,
      email: `email-${userId}@example.com`,
      email_verified: true,
      first: `first-${userId}`,
      image_url: `http://example.com/image-${userId}.png`,
      last: `last-${userId}`,
      name: `name-${userId}`,
      public_meta: `{ "role": "tester-${userId}" }`,
    },
    role: "device-id",
    sub: `device-id-subject-${sthis.nextId().str}`,
    userId: `user-id-${userId}`,
    aud: ["http://test-audience.localhost/"],
  } as never);
  const deviceIdSigner = new DeviceIdSignMsg(sthis.txt.base64, devkey, rProcessResult.Ok().certificatePayload);
  let seq = 0;
  const getDashBoardToken = async (): Promise<DashAuthType> => {
    const now = Math.floor(Date.now() / 1000);
    const token = await deviceIdSigner.sign(
      {
        iss: "app-id",
        sub: "device-id",
        deviceId: await devkey.fingerPrint(),
        seq: ++seq,
        exp: now + 120,
        nbf: now - 2,
        iat: now,
        jti: sthis.nextId().str,
      },
      "ES256"
    );
    return { type: "device-id", token };
  };
  return { devkey, deviceIdSigner, getDashBoardToken };
}
