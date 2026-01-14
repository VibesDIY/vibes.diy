import { Option, URI } from "@adviser/cement";
//   entryPointBaseUrl: string; // https://{fsid}{[-.]groupid}.vibes.app -> https://fsid{--groupId}.vibes.app

export interface CalcEntryPointUrlParams {
  urlTemplate: string;
  groupId?: string; // [-.]*groupid
  fsId: string;
}

export function calcEntryPointUrl({
  urlTemplate,
  groupId,
  fsId,
}: CalcEntryPointUrlParams): string {
  const uri = URI.from(urlTemplate);
  let hostname = uri.hostname.replace("{fsid}", fsId);
  switch (true) {
    case urlTemplate.includes("{.groupid}"):
      hostname = hostname.replace("{.groupid}", groupId ? `.${groupId}` : "");
      break;
    case urlTemplate.includes("{-groupid}"):
      hostname = hostname.replace("{-groupid}", groupId ? `-${groupId}` : "");
      break;
    case urlTemplate.includes("{--groupid}"):
      hostname = hostname.replace("{--groupid}", groupId ? `--${groupId}` : "");
      break;
    // case urlTemplate.includes("{groupid}"):
    //   hostname = hostname.replace("{groupid}", groupId ? `${groupId}` : "");
    //   break;
  }
  return uri.build().hostname(hostname).toString();
}

export interface FsIdAndGroupId {
  url: string;
  fsId: string;
  groupId?: string;
  path: string; // path after given template
}

export function extractFsIdAndGroupIdFromHost({
  matchURL,
  urlTemplate,
}: {
  matchURL: string;
  urlTemplate: string;
}): Option<FsIdAndGroupId> {
  const templateURI = URI.from(urlTemplate);
  if (templateURI.hostname.includes("groupid}")) {
    throw new Error(
      "urlTemplate must use {.groupid}, {-groupid}, or {--groupid} for groupId placeholder",
    );
  }
  const hostNameRegExpStr = templateURI.hostname.replace(
    "{fsid}",
    "(?<fsId>[^.-]+)",
  );
  //.replace("{.groupid}", "\\.(?<groupId>[^.]+)")
  //.replace("{-groupid}", "-(?<groupId>[^.]+)")
  //.replace("{--groupid}", "--(?<groupId>[^.]+)")
  const hostNameRegExp = new RegExp(`^${hostNameRegExpStr}$`);
  const matchURI = URI.from(matchURL);
  const match = hostNameRegExp.exec(matchURI.hostname);
  if (match && match.groups) {
    const calc = calcEntryPointUrl({
      urlTemplate,
      fsId: match.groups["fsId"],
      groupId: match.groups["groupId"],
    });
    let rest = matchURI.pathname.replace(URI.from(calc).pathname, "");
    if (!rest.startsWith("/")) {
      rest = `/${rest}`;
    }
    return Option.Some({
      url: calc,
      fsId: match.groups["fsId"],
      groupId: match.groups["groupId"],
      path: rest,
    });
  }
  return Option.None();
}
