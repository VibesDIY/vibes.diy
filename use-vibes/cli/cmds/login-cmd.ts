import { command, flag, option, string } from "cmd-ts";
import { DeviceIdKey, DeviceIdCSR } from "@fireproof/core-device-id";
import { getKeyBag } from "@fireproof/core-keybag";
import { Subject, CertificatePayloadSchema } from "@fireproof/core-types-base";
import { decodeJwt } from "jose";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import open from "open";
import { exception2Result, Future, timeouted, isSuccess, isTimeout, BuildURI } from "@adviser/cement";
import { hostname } from "os";
import { CliCtx, DEFAULT_API_URL } from "../cli-ctx.js";

function apiUrlToCaUrl(apiUrl: string): string {
  return BuildURI.from(apiUrl).pathname("/settings/csr-to-cert").toString();
}

function buildSubject(commonName: string): Subject {
  return {
    commonName,
    organization: "use-vibes-cli",
    locality: "unset",
    stateOrProvinceName: "unset",
    countryName: "WD",
  };
}

export function loginCmd(ctx: CliCtx) {
  return command({
    name: "login",
    description: "Authenticate this device with vibes.diy cloud.",
    args: {
      apiUrl: option({
        long: "api-url",
        short: "u",
        description: "API base URL (used to derive the auth endpoint)",
        type: string,
        defaultValue: () => ctx.sthis.env.get("VIBES_API_URL") ?? DEFAULT_API_URL,
        defaultValueIsSerializable: true,
      }),
      force: flag({
        long: "force",
        description: "Re-register even if a certificate already exists",
      }),
      timeout: option({
        long: "timeout",
        description: "Seconds to wait for browser auth callback",
        type: string,
        defaultValue: () => "120",
        defaultValueIsSerializable: true,
      }),
    },
    handler: async function handleLogin(args: {
      readonly apiUrl: string;
      readonly force: boolean;
      readonly timeout: string;
    }): Promise<void> {
      const keyBag = await getKeyBag(ctx.sthis);
      const existing = await keyBag.getDeviceId();

      // Already registered — early exit unless --force
      if (existing.cert.IsSome() && !args.force) {
        if (existing.deviceId.IsSome()) {
          const rKey = await DeviceIdKey.createFromJWK(existing.deviceId.Unwrap());
          if (rKey.isOk()) {
            const fp = await rKey.Ok().fingerPrint();
            console.log(`Already logged in. Device fingerprint: ${fp}`);
            console.log("Use --force to re-register.");
          }
        }
        return;
      }

      if (args.force && existing.cert.IsSome()) {
        console.log("Force re-registering...");
      }

      // Step 1: Get or create device key
      const deviceIdKey = await (async (): Promise<DeviceIdKey | undefined> => {
        if (existing.deviceId.IsNone()) {
          console.log("Creating new device key...");
          const key = await DeviceIdKey.create();
          const jwkPrivate = await key.exportPrivateJWK();
          await keyBag.setDeviceId(jwkPrivate);
          return key;
        }
        const rKey = await DeviceIdKey.createFromJWK(existing.deviceId.Unwrap());
        if (rKey.isErr()) {
          console.error("Failed to load device key:", rKey.Err());
          return undefined;
        }
        return rKey.Ok();
      })();
      if (deviceIdKey === undefined) {
        process.exit(1);
        return;
      }

      const fingerprint = await deviceIdKey.fingerPrint();
      console.log(`Device fingerprint: ${fingerprint}`);

      // Step 2: Generate CSR
      console.log("Generating certificate signing request...");
      const subject = buildSubject(hostname());
      const deviceIdCSR = new DeviceIdCSR(ctx.sthis, deviceIdKey);
      const csrResult = await deviceIdCSR.createCSR(subject);
      if (csrResult.isErr()) {
        console.error("Failed to generate CSR:", csrResult.Err());
        process.exit(1);
        return;
      }
      const csrJWS = csrResult.Ok();

      // Step 3: Start local callback server
      const certFuture = new Future<string>();
      const app = new Hono();
      app.get("/cert", (c) => {
        const cert = c.req.query("cert");
        if (!cert) {
          certFuture.reject(new Error("Missing cert parameter"));
          return c.text("Missing cert parameter", 400);
        }
        console.log("\nCertificate received!");
        certFuture.resolve(cert);
        return c.text("Login complete. You can close this window.");
      });

      const port = Math.floor(Math.random() * (65535 - 49152) + 49152);
      const callbackUrl = `http://localhost:${port}/cert`;
      const serverInstance = serve({ fetch: app.fetch, port });

      // Step 4: Open browser
      const caUrl = apiUrlToCaUrl(args.apiUrl);
      const fullUrl = BuildURI.from(caUrl).setParam("csr", csrJWS).setParam("returnUrl", callbackUrl).toString();

      console.log("\nOpening browser for authentication...");
      const rOpen = await exception2Result(() => open(fullUrl));
      if (rOpen.isErr()) {
        console.log("Could not open browser. Please open this URL manually:");
        console.log(fullUrl);
      }

      // Step 5: Wait for certificate
      console.log("Waiting for authentication...\n");
      const timeoutMs = parseInt(args.timeout, 10) * 1000;
      const result = await timeouted(certFuture.asPromise(), { timeout: timeoutMs });

      serverInstance.close();

      if (!isSuccess(result)) {
        if (isTimeout(result)) {
          console.error(`Timed out after ${args.timeout}s waiting for authentication.`);
        } else {
          console.error("Failed to receive certificate:", result.state === "error" ? result.error : result);
        }
        process.exit(1);
        return;
      }

      // Step 6: Store certificate
      console.log("Storing credentials...");
      const decoded = decodeJwt(result.value);
      const certPayload = CertificatePayloadSchema.parse(decoded);
      const jwkPrivate = await deviceIdKey.exportPrivateJWK();
      await keyBag.setDeviceId(jwkPrivate, {
        certificateJWT: result.value,
        certificatePayload: certPayload,
      });

      console.log(`\nLogin complete! Device fingerprint: ${fingerprint}`);
    },
  });
}
