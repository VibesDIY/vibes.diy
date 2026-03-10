import { Result } from "@adviser/cement";
import { DeviceIdKey, DeviceIdCSR } from "@fireproof/core-device-id";
import { getKeyBag } from "@fireproof/core-keybag";
import { CertificatePayloadSchema } from "@fireproof/core-types-base";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { decodeJwt } from "jose";
import type { CliOutput } from "./cli-output.js";

const DEFAULT_CA_URL = "https://vibes.diy/csr2cert";
const CA_URL_ENV = "VIBES_DIY_CA_URL";
const DEFAULT_TIMEOUT_S = 120;

export interface LoginServer {
  close(): void;
  readonly finished: Promise<void>;
}

export interface LoginPlatform {
  readonly serve: (
    opts: { port: number; hostname: string; signal: AbortSignal },
    handler: (req: Request) => Response | Promise<Response>,
  ) => LoginServer;
  readonly openBrowser: (url: string) => Promise<void>;
  readonly getEnv: (key: string) => string | undefined;
}

export interface LoginOptions {
  readonly caUrl?: string;
  readonly timeout?: number;
  readonly forceRenew?: boolean;
}

export async function runLogin(options: LoginOptions, output: CliOutput, platform: LoginPlatform): Promise<Result<void>> {
  const sthis = ensureSuperThis();
  const keyBag = await getKeyBag(sthis);
  const existing = await keyBag.getDeviceId();

  // Check if already registered
  if (existing.cert.IsSome() && !options.forceRenew) {
    const jwk = existing.deviceId.unwrap();
    const deviceIdKey = (await DeviceIdKey.createFromJWK(jwk)).unwrap();
    const fingerprint = await deviceIdKey.fingerPrint();
    output.stdout(`Already registered. Device fingerprint: ${fingerprint}\n`);
    output.stdout("Use --force-renew to renew the certificate.\n");
    return Result.Ok(undefined);
  }

  // Step 1: Create or load device key
  let deviceIdKey: DeviceIdKey;
  if (existing.deviceId.IsNone()) {
    output.stdout("Creating device key pair...\n");
    deviceIdKey = await DeviceIdKey.create();
    const jwkPrivate = await deviceIdKey.exportPrivateJWK();
    await keyBag.setDeviceId(jwkPrivate);
  } else {
    const createResult = await DeviceIdKey.createFromJWK(existing.deviceId.unwrap());
    if (createResult.isErr()) {
      return Result.Err(`Failed to load device key: ${createResult.Err()}`);
    }
    deviceIdKey = createResult.Ok();
  }

  const fingerprint = await deviceIdKey.fingerPrint();
  output.stdout(`Device fingerprint: ${fingerprint}\n`);

  // Step 2: Generate CSR
  output.stdout("Generating certificate signing request...\n");
  const deviceIdCSR = new DeviceIdCSR(sthis, deviceIdKey);
  const csrResult = await deviceIdCSR.createCSR({
    commonName: `use-vibes-cli@${fingerprint}`,
    organization: "vibes.diy",
    locality: "SF",
    stateOrProvinceName: "CA",
    countryName: "US",
  });
  if (csrResult.isErr()) {
    return Result.Err(`CSR generation failed: ${csrResult.Err()}`);
  }
  const csrJWS = csrResult.Ok();

  // Step 3: Start localhost callback server
  const state = crypto.randomUUID();
  const port = Math.floor(Math.random() * (65535 - 49152) + 49152);
  const callbackUrl = `http://127.0.0.1:${port}/cert`;
  const timeoutMs = (options.timeout ?? DEFAULT_TIMEOUT_S) * 1000;

  let certResolve: (cert: string) => void;
  const certPromise = new Promise<string>((resolve, _reject) => {
    certResolve = resolve;
  });

  const abortController = new AbortController();

  const server = platform.serve(
    { port, hostname: "127.0.0.1", signal: abortController.signal },
    (req: Request) => {
      const url = new URL(req.url);
      if (url.pathname !== "/cert") {
        return new Response("Not Found", { status: 404 });
      }
      const cert = url.searchParams.get("cert");
      const returnedState = url.searchParams.get("state");

      if (!cert) {
        return new Response("Missing cert parameter", { status: 400 });
      }
      if (returnedState !== state) {
        return new Response("State mismatch", { status: 403 });
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- assigned synchronously in Promise constructor
      certResolve!(cert);
      return new Response("Certificate received. You can close this window.", {
        headers: { "Content-Type": "text/plain" },
      });
    }
  );

  // Step 4: Open browser
  const caUrl = options.caUrl ?? platform.getEnv(CA_URL_ENV) ?? DEFAULT_CA_URL;
  const browserUrl = `${caUrl}?csr=${encodeURIComponent(csrJWS)}&returnUrl=${encodeURIComponent(callbackUrl)}&state=${encodeURIComponent(state)}`;

  output.stdout(`\nOpen this URL in your browser to authorize:\n${browserUrl}\n\n`);

  // Try to open browser automatically
  try {
    await platform.openBrowser(browserUrl);
    output.stdout("Browser opened. Waiting for authorization...\n");
  } catch {
    output.stdout("Waiting for authorization...\n");
  }

  // Step 5: Wait for certificate with timeout
  let receivedCert: string;
  try {
    receivedCert = await Promise.race([
      certPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${options.timeout ?? DEFAULT_TIMEOUT_S}s`)), timeoutMs)
      ),
    ]);
  } catch (err) {
    abortController.abort();
    await server.finished;
    return Result.Err(err instanceof Error ? err.message : "Login failed");
  }

  // Step 6: Shut down server immediately
  server.close();
  await server.finished;

  // Step 7: Validate and store certificate
  output.stdout("Certificate received. Storing...\n");
  try {
    const decoded = decodeJwt(receivedCert);
    const certPayload = CertificatePayloadSchema.parse(decoded);
    const jwkPrivate = await deviceIdKey.exportPrivateJWK();
    await keyBag.setDeviceId(jwkPrivate, {
      certificateJWT: receivedCert,
      certificatePayload: certPayload,
    });
  } catch (err) {
    return Result.Err(`Failed to store certificate: ${err instanceof Error ? err.message : err}`);
  }

  output.stdout(`Login successful! Device fingerprint: ${fingerprint}\n`);
  return Result.Ok(undefined);
}
