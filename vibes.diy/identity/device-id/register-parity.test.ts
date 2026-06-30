// Differential lift-verification harness (#2894) — runs the SAME inputs through
// BOTH the pre-lift implementation (`@fireproof/core-cli`, still installed) and
// the lifted in-repo one, and asserts they behave identically. This catches
// variance a single-impl golden test can't: a hand-copy typo in an arktype
// field, an accidentally-optional field, or any accept/reject drift in the
// request/response validators — the exact surface most at risk in a verbatim
// re-type, and the regression gate for the future arktype→zod conversion.
//
// This file deliberately imports `@fireproof/core-cli` (a TEST-only reference to
// the old source of truth — identity's runtime path no longer does). It is the
// proof that the lift is byte-equivalent; delete it once core-cli is removed
// (#2483), at which point `register-golden.test.ts` remains the standalone gate.
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppContext, Evento, Result } from "@adviser/cement";
import type { EventoHandler } from "@adviser/cement";
import {
  deviceIdRegisterEvento as oldEvento,
  isResDeviceIdRegister as oldIsRes,
} from "@fireproof/core-cli";
import { ensureSuperThis } from "../index.js";
import type { JWKPrivate, DeviceIdKeyBagItem, SuperThis } from "../index.js";
import { deviceIdRegisterEvento as newEvento, isResDeviceIdRegister as newIsRes } from "./register.js";

// base58btc(hashStringSync("FIREProof:deviceId")) — the fixed on-disk slot name
// shared by both keybag impls (pinned by keybag-golden.test.ts).
const DEVICE_ID_FILENAME = "z3QkefAC57rcrs.json";
const FIXTURE = (await import("../keybag/keybag-golden.fixture.json", { with: { type: "json" } })).default as {
  readonly item: { readonly deviceId: JWKPrivate; readonly cert: NonNullable<DeviceIdKeyBagItem["cert"]> };
};

const validReq = {
  type: "core-cli.device-id-register",
  commonName: "test-device",
  organization: "Org",
  locality: "City",
  state: "State",
  country: "WD",
  caUrl: "http://localhost:7370/fp/cloud/csr2cert",
  port: "",
  timeout: "60",
  forceRenew: false,
};

// Inputs spanning valid, every-field-missing, wrong-type, wrong-literal, extras,
// and non-objects. Old and new MUST agree on each.
const requestBattery: { name: string; input: unknown }[] = [
  { name: "valid", input: validReq },
  { name: "missing commonName", input: { ...validReq, commonName: undefined } },
  { name: "missing caUrl", input: { ...validReq, caUrl: undefined } },
  { name: "missing forceRenew", input: { ...validReq, forceRenew: undefined } },
  { name: "missing port", input: { ...validReq, port: undefined } },
  { name: "missing timeout", input: { ...validReq, timeout: undefined } },
  { name: "forceRenew as string", input: { ...validReq, forceRenew: "false" } },
  { name: "timeout as number", input: { ...validReq, timeout: 60 } },
  { name: "port as number", input: { ...validReq, port: 0 } },
  { name: "wrong type literal", input: { ...validReq, type: "core-cli.device-id-create" } },
  { name: "missing type", input: { ...validReq, type: undefined } },
  { name: "extra field", input: { ...validReq, bogus: 1 } },
  { name: "empty object", input: {} },
  { name: "null", input: null },
  { name: "undefined", input: undefined },
  { name: "string", input: "core-cli.device-id-register" },
];

const responseBattery: { name: string; input: unknown }[] = [
  { name: "valid res", input: { type: "core-cli.res-device-id-register", output: "ok" } },
  { name: "missing output", input: { type: "core-cli.res-device-id-register" } },
  { name: "output non-string", input: { type: "core-cli.res-device-id-register", output: 1 } },
  { name: "wrong type (create)", input: { type: "core-cli.res-device-id-create", output: "ok" } },
  { name: "request type, not response", input: validReq },
  { name: "extra field", input: { type: "core-cli.res-device-id-register", output: "ok", extra: true } },
  { name: "empty object", input: {} },
  { name: "null", input: null },
  { name: "undefined", input: undefined },
];

async function validateAccepts(evento: EventoHandler, enRequest: unknown): Promise<boolean> {
  // validate() only reads ctx.enRequest; a minimal stub is enough to diff routing.
  const r = await evento.validate?.({ enRequest } as never);
  if (!r) {
    throw new Error("evento has no validate()");
  }
  return r.Ok().IsSome();
}

describe("device-id register parity — request schema (old core-cli vs lifted)", () => {
  for (const { name, input } of requestBattery) {
    it(`agrees on accept/reject: ${name}`, async () => {
      const oldOk = await validateAccepts(oldEvento, input);
      const newOk = await validateAccepts(newEvento, input);
      expect(newOk).toBe(oldOk);
    });
  }
});

describe("device-id register parity — response guard (old core-cli vs lifted)", () => {
  for (const { name, input } of responseBattery) {
    it(`agrees on isResDeviceIdRegister: ${name}`, () => {
      expect(newIsRes(input)).toBe(oldIsRes(input));
    });
  }
});

// The enrolled short-circuit output (the no-relogin path) must be byte-identical
// between old and new. Each impl reads its OWN keybag backend (core-keybag vs the
// in-repo lift), so we seed each with the SAME on-disk fixture at the SAME slot
// — the byte-compat keybag-golden test proves both read it — and the only
// dynamic part of the output (the fingerprint) is derived purely from the key,
// so identical output proves the message template AND the fingerprint math match.
class CaptureSend {
  readonly results: unknown[] = [];
  send<IS, OS>(_t: unknown, data: IS): Promise<Result<OS>> {
    this.results.push(data);
    return Promise.resolve(Result.Ok(undefined as OS));
  }
  done<OS>(): Promise<Result<OS>> {
    return Promise.resolve(Result.Ok(undefined as OS));
  }
}

async function shortCircuitOutput(evento: EventoHandler): Promise<string> {
  // Fresh HOME + cold keybag per impl, pre-seeded with the enrolled fixture.
  const dir = mkdtempSync(join(tmpdir(), "register-parity-"));
  writeFileSync(join(dir, DEVICE_ID_FILENAME), JSON.stringify(FIXTURE));
  const sthis: SuperThis = ensureSuperThis();
  sthis.env.set("FP_KEYBAG_URL", `file://${dir}`);

  const ev = new Evento({
    encode: (i: unknown) => Promise.resolve(Result.Ok((i as { result: unknown }).result)),
    decode: (i: unknown) => Promise.resolve(Result.Ok(i)),
  });
  ev.push([evento]);
  const send = new CaptureSend();
  const appCtx = new AppContext().set("cliCtx", { sthis });
  const request = {
    type: "msg.cmd-ts",
    cmdTs: { raw: validReq, outputFormat: "text" },
    result: { ...validReq, forceRenew: false },
  };
  const triggered = await ev.trigger({ ctx: appCtx, send, request });
  if (triggered.isErr()) {
    throw triggered.Err();
  }
  const last = send.results[send.results.length - 1] as { readonly result: { readonly output: string } } | undefined;
  if (!last) {
    throw new Error("no response emitted");
  }
  return last.result.output;
}

describe("device-id register parity — enrolled short-circuit output (old vs lifted)", () => {
  it("produces byte-identical 'already has a certificate' output", async () => {
    const oldOut = await shortCircuitOutput(oldEvento);
    const newOut = await shortCircuitOutput(newEvento);
    expect(newOut).toBe(oldOut);
    expect(newOut).toContain("Device already has a certificate. Registration not needed.");
  });
});
