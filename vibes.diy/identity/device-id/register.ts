// Login device-id register flow, lifted verbatim from @fireproof/core-cli@0.24.19
// `cmds/device-id-cmd.js` (the `register` subcommand handler — Bucket C / #1616,
// the localhost cert-callback enrollment round-trip behind `vibes-diy login`).
//
// This is identity/PKI domain code that happened to ship inside the fireproof
// build-tool package; lifting it here removes the last `@fireproof/core-cli`
// *value* import from identity's runtime path (#2894). The handler is now wired
// to the already-owned in-repo `getKeyBag` / `DeviceIdKey` / `DeviceIdCSR` /
// `CertificatePayloadSchema` instead of `@fireproof/core-keybag` /
// `@fireproof/core-device-id` / `@fireproof/core-types-base`.
//
// THE LIFT ONLY — the request/response schemas stay arktype (NOT re-typed to
// the zod the rest of identity uses): keeping the wire/validation contract
// byte-identical so an enrolled device keeps registering with no re-login. The
// arktype→zod re-type is a deliberate follow-up, not part of this lift.
//
// The two `ctx.send.send`-based streaming helpers (`sendMsg` / `sendProgress`)
// are generic cmd-ts framework glue (the cli-kit seam, #2478) — kept here as
// module-private copies rather than imported, so identity carries no value
// import from core-cli. The `WrapCmdTSMsg` / `CmdProgress` types come from the
// in-repo `@vibes.diy/cmd-tools` package (the owned cli-kit seam).
import { decodeJwt } from "jose";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import open from "open";
import { Future, timeouted, isSuccess, isTimeout, BuildURI, Result, Option, EventoResult } from "@adviser/cement";
import type { EventoHandler, HandleTriggerCtx, ValidateTriggerCtx, EventoResultType } from "@adviser/cement";
import { type } from "arktype";
import type { WrapCmdTSMsg, CmdProgress } from "@vibes.diy/cmd-tools";
import type { Subject, SuperThis } from "@fireproof/core-types-base";
import { getKeyBag } from "../keybag/keybag.js";
import { DeviceIdKey } from "./key.js";
import { DeviceIdCSR } from "./csr.js";
import { CertificatePayloadSchema } from "../types/cert-payload.js";

// The evento handler reaches `sthis` off the registering CLI's context; only the
// `sthis` field is needed, so type it structurally to avoid a dependency on the
// CLI's `CliCtx` (which is the wrong direction — the CLI depends on identity).
interface CliCtxLike {
  readonly sthis: SuperThis;
}

// --- cmd-ts streaming glue (cli-kit seam, lifted from core-cli cmd-evento.js) ---
// Kept module-private so the public identity surface gains no framework API.
async function sendMsg<Q, S>(ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, Q, S>, result: S): Promise<Result<EventoResultType>> {
  await ctx.send.send(ctx, {
    ...ctx.request,
    result,
  });
  return Result.Ok(EventoResult.Continue);
}

async function sendProgress<Q, S>(
  ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, Q, S>,
  level: CmdProgress["level"],
  message: string
): Promise<void> {
  await ctx.send.send(ctx, {
    ...ctx.request,
    result: {
      type: "core-cli.progress",
      level,
      message,
    },
  });
}

function buildSubject(args: ReqDeviceIdRegister): Subject {
  return {
    commonName: args.commonName,
    organization: args.organization,
    locality: args.locality,
    stateOrProvinceName: args.state,
    countryName: args.country,
  };
}

export const ReqDeviceIdRegister = type({
  type: "'core-cli.device-id-register'",
  commonName: "string",
  organization: "string",
  locality: "string",
  state: "string",
  country: "string",
  caUrl: "string",
  port: "string",
  timeout: "string",
  forceRenew: "boolean",
});
export type ReqDeviceIdRegister = typeof ReqDeviceIdRegister.infer;

export const ResDeviceIdRegister = type({
  type: "'core-cli.res-device-id-register'",
  output: "string",
});
export type ResDeviceIdRegister = typeof ResDeviceIdRegister.infer;

export function isResDeviceIdRegister(u: unknown): u is ResDeviceIdRegister {
  return !(ResDeviceIdRegister(u) instanceof type.errors);
}

export const deviceIdRegisterEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqDeviceIdRegister, ResDeviceIdRegister> = {
  hash: "core-cli.device-id-register",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqDeviceIdRegister, ResDeviceIdRegister>) => {
    if (!(ReqDeviceIdRegister(ctx.enRequest) instanceof type.errors)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest as ReqDeviceIdRegister)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqDeviceIdRegister, ResDeviceIdRegister>) => {
    const cliCtx = ctx.ctx.getOrThrow<CliCtxLike>("cliCtx");
    const sthis = cliCtx.sthis;
    const args = ctx.validated;
    const keyBag = await getKeyBag(sthis);
    const existingDeviceIdResult = await keyBag.getDeviceId();
    if (existingDeviceIdResult.cert.IsSome() && !args.forceRenew) {
      const jwk = existingDeviceIdResult.deviceId.Unwrap();
      const deviceIdKey = (await DeviceIdKey.createFromJWK(jwk)).Ok();
      const fingerprint = await deviceIdKey.fingerPrint();
      return sendMsg(ctx, {
        type: "core-cli.res-device-id-register",
        output: [
          "Device already has a certificate. Registration not needed.",
          "Use --force-renew to renew the certificate.",
          `Existing Device ID Fingerprint: ${fingerprint}`,
        ].join("\n"),
      });
    }
    if (args.forceRenew && existingDeviceIdResult.cert.IsSome()) {
      await sendProgress(ctx, "info", "Force renewing certificate...");
    }
    let deviceIdKey: DeviceIdKey;
    if (existingDeviceIdResult.deviceId.IsNone()) {
      await sendProgress(ctx, "info", "Creating new device ID key pair...");
      deviceIdKey = await DeviceIdKey.create();
      const jwkPrivate = await deviceIdKey.exportPrivateJWK();
      await keyBag.setDeviceId(jwkPrivate);
      const fingerprint = await deviceIdKey.fingerPrint();
      await sendProgress(ctx, "info", `Created Device ID Fingerprint: ${fingerprint}`);
    } else {
      await sendProgress(ctx, "info", "Using existing device ID key...");
      const jwkPrivate = existingDeviceIdResult.deviceId.Unwrap();
      const createResult = await DeviceIdKey.createFromJWK(jwkPrivate);
      if (createResult.isErr()) {
        return Result.Err(`Error loading existing device ID: ${createResult.Err()}`);
      }
      deviceIdKey = createResult.Ok();
      const fingerprint = await deviceIdKey.fingerPrint();
      await sendProgress(ctx, "info", `Device ID Fingerprint: ${fingerprint}`);
    }
    await sendProgress(ctx, "info", "Generating Certificate Signing Request (CSR)...");
    const deviceIdCSR = new DeviceIdCSR(sthis, deviceIdKey);
    const subject = buildSubject(args);
    const csrResult = await deviceIdCSR.createCSR(subject);
    if (csrResult.isErr()) {
      return Result.Err(`Failed to generate CSR: ${csrResult.Err()}`);
    }
    const csrJWS = csrResult.Ok();
    await sendProgress(ctx, "info", "CSR generated successfully.");
    const certFuture = new Future<string>();
    const app = new Hono();
    app.get("/cert", (c) => {
      const cert = c.req.query("cert");
      if (!cert) {
        certFuture.reject(new Error("Missing cert parameter"));
        return c.text("Missing cert parameter", 400);
      }
      void sendProgress(ctx, "info", "\nCertificate received from CA!");
      certFuture.resolve(cert);
      return c.text("Certificate received successfully. You can close this window.");
    });
    const port = args.port ? parseInt(args.port, 10) : Math.floor(Math.random() * (65535 - 49152) + 49152);
    const callbackUrl = `http://localhost:${port}/cert`;
    await sendProgress(ctx, "info", `Starting local server on port ${port}...`);
    const serverInstance = serve({
      fetch: app.fetch,
      port,
    });
    const caUri = BuildURI.from(args.caUrl).setParam("csr", csrJWS).setParam("returnUrl", callbackUrl);
    const caUrlWithParams = caUri.toString();
    await sendProgress(ctx, "info", "\nOpening browser to CA for certificate signing...");
    await sendProgress(ctx, "info", `URL: ${caUrlWithParams}\n`);
    try {
      await open(caUrlWithParams);
    } catch {
      await sendProgress(ctx, "warn", "Could not automatically open browser. Please open this URL manually:");
      await sendProgress(ctx, "warn", caUrlWithParams);
    }
    await sendProgress(ctx, "info", "Waiting for certificate from CA...");
    await sendProgress(ctx, "info", "(The browser should redirect back to this application after signing)\n");
    const timeoutMs = parseInt(args.timeout, 10) * 1000;
    const result = await timeouted(certFuture.asPromise(), { timeout: timeoutMs });
    serverInstance.close();
    if (!isSuccess(result)) {
      if (isTimeout(result)) {
        return Result.Err(`Timeout waiting for certificate from CA (${args.timeout}s).`);
      } else {
        return Result.Err(`Failed to receive certificate: ${result.state === "error" ? result.error : result}`);
      }
    }
    const receivedCert = result.value;
    await sendProgress(ctx, "info", "Storing certificate...");
    const decoded = decodeJwt(receivedCert);
    const certPayload = CertificatePayloadSchema.parse(decoded);
    const jwkPrivate = await deviceIdKey.exportPrivateJWK();
    const certToStore = {
      certificateJWT: receivedCert,
      certificatePayload: certPayload,
    };
    await keyBag.setDeviceId(jwkPrivate, certToStore);
    const fingerprint = await deviceIdKey.fingerPrint();
    return sendMsg(ctx, {
      type: "core-cli.res-device-id-register",
      output: [
        "\n✓ Registration complete! Certificate successfully stored with Device ID.",
        `Device ID Fingerprint: ${fingerprint}`,
      ].join("\n"),
    });
  },
};
