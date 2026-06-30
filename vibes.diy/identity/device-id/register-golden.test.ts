// Golden harness for the lifted device-id register flow (#2894).
//
// `deviceIdRegisterEvento` moved verbatim from `@fireproof/core-cli`'s
// `device-id-cmd.js` into identity, re-wired onto the in-repo keybag /
// `DeviceIdKey` / `DeviceIdCSR`. This harness pins the one register behavior the
// epic calls out — an already-enrolled device must keep registering with NO
// re-login: when the keybag already holds a cert and `--force-renew` is absent,
// register short-circuits with the "already has a certificate" message and never
// touches the network/CA. It also pins the request/response wire contract
// (arktype `type` literals + `isResDeviceIdRegister`) that `vibes-diy login`
// (`login-cmd.ts`) and the CLI output switch (`main.ts`) depend on.
//
// The full enroll round-trip (CSR → localhost callback → CA cert) starts a Hono
// server and opens a browser, so it is exercised end-to-end by the CLI/api
// integration suites, not here; this gate locks the deterministic, in-process
// branch and the schema shapes.
import { describe, it, expect } from "vitest";
import { type } from "arktype";
import { AppContext, Evento, Result } from "@adviser/cement";
import type { HandleTriggerCtx } from "@adviser/cement";
import { ensureSuperThis } from "../index.js";
import type { JWKPrivate, DeviceIdKeyBagItem, SuperThis } from "../index.js";
import { getKeyBag } from "../keybag/keybag.js";
import { deviceIdRegisterEvento, isResDeviceIdRegister, ReqDeviceIdRegister, ResDeviceIdRegister } from "./register.js";

// A real device-id keybag (genuine ES256 key + full CA-issued cert), shared with
// the keybag golden harness.
const FIXTURE = (await import("../keybag/keybag-golden.fixture.json", { with: { type: "json" } })).default as {
  readonly item: { readonly deviceId: JWKPrivate; readonly cert: NonNullable<DeviceIdKeyBagItem["cert"]> };
};
const deviceId = FIXTURE.item.deviceId;
const cert = FIXTURE.item.cert;

// Captures every `ctx.send.send` payload, mirroring core-cli's TestSendProvider.
class TestSendProvider {
  readonly results: unknown[] = [];
  send<IS, OS>(_trigger: unknown, data: IS): Promise<Result<OS>> {
    this.results.push(data);
    return Promise.resolve(Result.Ok(undefined as OS));
  }
  done<OS>(): Promise<Result<OS>> {
    return Promise.resolve(Result.Ok(undefined as OS));
  }
}

// Drive the register evento in-process with a `cliCtx` carrying just `sthis`,
// exactly as the CLI's `cmdTsEvento()` would route it.
async function triggerRegister(sthis: SuperThis, raw: Omit<ReqDeviceIdRegister, "type">): Promise<unknown> {
  const evento = new Evento({
    encode: (i: unknown) => Promise.resolve(Result.Ok((i as { result: unknown }).result)),
    decode: (i: unknown) => Promise.resolve(Result.Ok(i)),
  });
  evento.push([deviceIdRegisterEvento]);
  const send = new TestSendProvider();
  const appCtx = new AppContext().set("cliCtx", { sthis });
  const request = {
    type: "msg.cmd-ts",
    cmdTs: { raw, outputFormat: "text" },
    result: { type: "core-cli.device-id-register", ...raw },
  };
  const triggered = await evento.trigger({ ctx: appCtx, send, request });
  if (triggered.isErr()) {
    throw triggered.Err();
  }
  const triggerCtx = triggered.unwrap() as HandleTriggerCtx<unknown, unknown, unknown> & { error?: Error };
  if (triggerCtx.error) {
    throw triggerCtx.error;
  }
  const last = send.results[send.results.length - 1] as { readonly result: unknown } | undefined;
  if (!last) {
    throw new Error("register evento emitted no response");
  }
  return last.result;
}

function memSthis(): SuperThis {
  const sthis = ensureSuperThis();
  sthis.env.set("FP_KEYBAG_URL", `memory://register-golden-${sthis.nextId().str}`);
  return sthis;
}

const baseArgs: Omit<ReqDeviceIdRegister, "type"> = {
  commonName: "test-device",
  organization: "You did not set the Organization",
  locality: "You did not set the City",
  state: "You did not set the State",
  country: "WD",
  caUrl: "http://localhost:7370/fp/cloud/csr2cert",
  port: "",
  timeout: "60",
  forceRenew: false,
};

describe("device-id register — already-enrolled short-circuit (no re-login)", () => {
  it("returns 'already has a certificate' without hitting the CA when a cert exists", async () => {
    const sthis = memSthis();
    const kb = await getKeyBag(sthis);
    await kb.setDeviceId(deviceId, cert); // simulate an enrolled device

    const msg = await triggerRegister(sthis, baseArgs);

    expect(isResDeviceIdRegister(msg)).toBe(true);
    if (isResDeviceIdRegister(msg)) {
      expect(msg.output).toContain("Device already has a certificate. Registration not needed.");
      expect(msg.output).toContain("Use --force-renew to renew the certificate.");
      expect(msg.output).toContain("Existing Device ID Fingerprint:");
    }
    // The short-circuit must not have re-written the keybag.
    const devid = await kb.getDeviceId();
    expect(devid.cert.IsSome()).toBe(true);
    expect(devid.cert.Unwrap()).toEqual(cert);
  });
});

describe("device-id register — wire contract", () => {
  it("the request schema accepts the shape emitted by `vibes-diy login`", () => {
    const req = { type: "core-cli.device-id-register", ...baseArgs };
    const parsed = ReqDeviceIdRegister(req);
    expect(parsed instanceof type.errors).toBe(false);
    expect((parsed as ReqDeviceIdRegister).type).toBe("core-cli.device-id-register");
  });

  it("isResDeviceIdRegister only matches the register response type literal", () => {
    expect(isResDeviceIdRegister({ type: "core-cli.res-device-id-register", output: "ok" })).toBe(true);
    expect(isResDeviceIdRegister({ type: "core-cli.res-device-id-create", output: "ok" })).toBe(false);
    expect(isResDeviceIdRegister({ type: "core-cli.res-device-id-register" })).toBe(false);
    expect(isResDeviceIdRegister(undefined)).toBe(false);
  });

  it("ResDeviceIdRegister round-trips a valid response", () => {
    const res: ResDeviceIdRegister = { type: "core-cli.res-device-id-register", output: "done" };
    expect(isResDeviceIdRegister(res)).toBe(true);
  });
});
