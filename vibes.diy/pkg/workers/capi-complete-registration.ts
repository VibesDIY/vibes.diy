import { exception2Result } from "@adviser/cement";
import { capiEndpoint } from "./meta-capi.js";

interface CompleteRegistrationUserData {
  readonly fbc: string;
  readonly client_ip_address: string;
  readonly client_user_agent: string;
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

export interface CompleteRegistrationParams {
  readonly fbclid: string;
  readonly fbclidTs?: number;
  readonly landingUrl?: string;
  readonly capiToken: string;
  readonly pixelId: string;
  readonly request: Request;
}

export function buildCapiCompleteRegistration(params: CompleteRegistrationParams): CapiCompleteRegistrationPayload {
  const { fbclid, fbclidTs, landingUrl, capiToken, request } = params;
  const now = Date.now();
  const fbc = `fb.1.${fbclidTs ?? now}.${fbclid}`;

  return {
    data: [
      {
        event_name: "CompleteRegistration",
        action_source: "website",
        event_time: Math.floor(now / 1000),
        event_source_url: landingUrl ?? request.url,
        user_data: {
          fbc,
          client_ip_address: request.headers.get("CF-Connecting-IP") ?? "",
          client_user_agent: request.headers.get("User-Agent") ?? "",
        },
      },
    ],
    access_token: capiToken,
  };
}

export async function sendCapiCompleteRegistration(params: CompleteRegistrationParams): Promise<void> {
  const payload = buildCapiCompleteRegistration(params);

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
