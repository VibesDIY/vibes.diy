import { exception2Result, Lazy, Result } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";

const CAPI_SOURCE_URL = "https://vibes.diy/";
const sthis = Lazy(() => ensureSuperThis());

function encodeUtf8(value: string): ArrayBuffer {
  return Uint8Array.from(sthis().txt.encode(value)).buffer as ArrayBuffer;
}

function capiEndpoint(pixelId: string): string {
  return `https://graph.facebook.com/v19.0/${pixelId}/events`;
}

interface CompleteRegistrationUserData {
  readonly em: string;
}

interface CompleteRegistrationEvent {
  readonly event_name: "CompleteRegistration";
  readonly action_source: "website";
  readonly event_time: number;
  readonly event_source_url: string;
  readonly user_data: CompleteRegistrationUserData;
}

export interface CapiCompleteRegistrationPayload {
  readonly data: readonly [CompleteRegistrationEvent];
  readonly access_token: string;
}

export interface VerifyParams {
  readonly body: string;
  readonly svixId: string;
  readonly svixTimestamp: string;
  readonly svixSignature: string;
  readonly secret: string;
}

export interface CompleteRegistrationParams {
  readonly email: string;
  readonly capiToken: string;
  readonly pixelId: string;
}

// Svix signatures are prefixed "whsec_<base64>". We need the raw bytes.
function decodeSecret(secret: string): ArrayBuffer {
  const b64 = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer as ArrayBuffer;
}

export async function verifyClerkWebhookSignature(params: VerifyParams): Promise<Result<unknown>> {
  const { body, svixId, svixTimestamp, svixSignature, secret } = params;

  // Extract all "v1,<sig>" entries from the header (Svix may rotate keys)
  const signatures = svixSignature
    .split(" ")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("v1,"))
    .map((s) => s.slice("v1,".length));

  if (signatures.length === 0) {
    return Result.Err(new Error("svix-signature header missing or malformed"));
  }

  const tsSeconds = parseInt(svixTimestamp, 10);
  if (isNaN(tsSeconds) || Math.abs(Date.now() / 1000 - tsSeconds) > 300) {
    return Result.Err(new Error("svix-timestamp out of tolerance"));
  }

  const rKey = await exception2Result(async () => {
    const secretBytes = decodeSecret(secret);
    return crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  });
  if (rKey.isErr()) return Result.Err(rKey.Err());
  const key = rKey.Ok();

  const toSign = encodeUtf8(`${svixId}.${svixTimestamp}.${body}`);
  const rSig = await exception2Result(() => crypto.subtle.sign("HMAC", key, toSign));
  if (rSig.isErr()) return Result.Err(rSig.Err());

  const computedB64 = btoa(String.fromCharCode(...new Uint8Array(rSig.Ok())));

  const matched = signatures.some((s) => s === computedB64);
  if (matched === false) {
    return Result.Err(new Error("signature mismatch"));
  }

  const rParsed = exception2Result(() => JSON.parse(body) as unknown);
  if (rParsed.isErr()) return Result.Err(rParsed.Err());
  return Result.Ok(rParsed.Ok());
}

export async function buildCapiCompleteRegistration(params: CompleteRegistrationParams): Promise<CapiCompleteRegistrationPayload> {
  const { email, capiToken } = params;
  const lower = email.toLowerCase();
  const msgBuf = encodeUtf8(lower);
  const hashBuf = await crypto.subtle.digest("SHA-256", msgBuf);
  const em = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return {
    data: [
      {
        event_name: "CompleteRegistration",
        action_source: "website",
        event_time: Math.floor(Date.now() / 1000),
        event_source_url: CAPI_SOURCE_URL,
        user_data: { em },
      },
    ],
    access_token: capiToken,
  };
}

export async function sendCapiCompleteRegistration(params: CompleteRegistrationParams): Promise<void> {
  const payload = await buildCapiCompleteRegistration(params);

  const rRes = await exception2Result(() =>
    fetch(capiEndpoint(params.pixelId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );

  if (rRes.isErr()) {
    console.error("[capi] network error sending CompleteRegistration", rRes.Err());
    return;
  }
  const resp = rRes.Ok();
  if (resp.ok === false) {
    const rBody = await exception2Result(() => resp.text());
    console.error("[capi] non-ok CompleteRegistration response", resp.status, rBody.isOk() ? rBody.Ok() : String(rBody.Err()));
  }
}
