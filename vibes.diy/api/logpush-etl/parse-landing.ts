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
const LANDING_RE = /^\[landing\] (\S+) (\S+) (.*)$/;

export function parseLandingLine(message: string, ts: string, logKey: string, lineIdx: number): LandingRow | null {
  const m = LANDING_RE.exec(message);
  if (m === null) return null;
  const [, landHref, , ua] = m;
  const rParsed = exception2Result(() => {
    const u = URI.from(landHref);
    return { host: u.hostname, path: u.pathname, fbclid: u.getParam("fbclid") ?? "", utm: u.getParam("utm_campaign") ?? "" };
  });
  if (rParsed.isErr()) return null;
  const { host, path, fbclid, utm } = rParsed.Ok();
  if (fbclid === "") return null; // a landing event must carry fbclid
  return { logKey, lineIdx, ts, landHref, landHost: host, landPath: path, fbclid, utmCampaign: utm, ua };
}
