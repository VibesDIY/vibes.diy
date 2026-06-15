import { exception2Result, URI } from "@adviser/cement";

export interface LandingRow {
  logKey: string;
  lineIdx: number;
  ts: string;
  landHref: string;
  landHost: string;
  landPath: string;
  fbclid: string;
  utmCampaign: string;
  ua: string;
}

// Parsed [landing] log line: "[landing] <full-url> <pathname> <user-agent...>"
// The pathname token is redundant (derived from the URL) but kept for symmetry with
// [referer]; the UA is the free-form remainder because user-agents contain spaces.
export const LANDING_RE = /^\[landing\] (\S+) (\S+) (.*)$/;

export function parseLandingLine(message: string, ts: string, logKey: string, lineIdx: number): LandingRow | null {
  const m = LANDING_RE.exec(message);
  if (m === null) return null;
  const [, landHref, , ua] = m;
  const rUri = exception2Result(() => URI.from(landHref));
  if (rUri.isErr()) return null;
  const uri = rUri.Ok();
  const fbclid = uri.getParam("fbclid") ?? "";
  if (fbclid === "") return null; // a landing event must carry fbclid
  const utmCampaign = uri.getParam("utm_campaign") ?? "";
  return { logKey, lineIdx, ts, landHref, landHost: uri.hostname, landPath: uri.pathname, fbclid, utmCampaign, ua };
}
