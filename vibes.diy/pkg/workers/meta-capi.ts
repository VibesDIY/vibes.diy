import { BuildURI, exception2Result, URI } from "@adviser/cement";

interface CapiUserData {
  readonly fbc: string;
  readonly client_ip_address: string;
  readonly client_user_agent: string;
}

interface CapiEvent {
  readonly event_name: "PageView";
  readonly action_source: "website";
  readonly event_time: number;
  readonly event_source_url: string;
  readonly user_data: CapiUserData;
}

export interface CapiPayload {
  readonly data: readonly [CapiEvent];
  readonly access_token: string;
}

const CAPI_ENDPOINT = "https://graph.facebook.com/v19.0/1027305316625975/events";

export function buildCapiPayload(request: Request, capiToken: string): CapiPayload | undefined {
  const url = URI.from(request.url);
  const fbclid = url.getParam("fbclid");
  if (fbclid === undefined) return undefined;

  const now = Date.now();
  const fbc = `fb.1.${now}.${fbclid}`;
  const eventSourceUrl = BuildURI.from(request.url).delParam("fbclid").toString();

  return {
    data: [
      {
        event_name: "PageView",
        action_source: "website",
        event_time: Math.floor(now / 1000),
        event_source_url: eventSourceUrl,
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

export async function sendCapiPageView(request: Request, capiToken: string): Promise<void> {
  const payload = buildCapiPayload(request, capiToken);
  if (payload === undefined) return;

  const rRes = await exception2Result(() =>
    fetch(CAPI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );

  if (rRes.isErr()) {
    console.error("[capi] network error sending PageView", rRes.Err());
    return;
  }
  const resp = rRes.Ok();
  if (resp.ok === false) {
    const rBody = await exception2Result(() => resp.text());
    console.error("[capi] non-ok response from Meta", resp.status, rBody.isOk() ? rBody.Ok() : String(rBody.Err()));
  }
}
