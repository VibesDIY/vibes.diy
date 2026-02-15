import { Option, URI } from "@adviser/cement";
import { VibeBindings } from "@vibes.diy/use-vibes-base";
//   entryPointBaseUrl: string; // https://{fsid}{[-.]groupid}.vibes.app -> https://fsid{--groupId}.vibes.app

export interface CalcEntryPointUrlParams {
  hostnameBase: string;
  bindings: VibeBindings;
  protocol: "https" | "http";
}

export function calcEntryPointUrl({ hostnameBase, protocol, bindings }: CalcEntryPointUrlParams): string {
  const hostname = `${bindings.appSlug}--${bindings.userSlug}.${hostnameBase}`;
  return `${protocol}://${hostname}/~${bindings.fsId}~/`;
}

export interface ExtractedHostToBindings {
  url: string;
  userSlug: string;
  appSlug: string;
  fsId?: string;
  groupId?: string;
  path: string; // path after given template
}

export function extractHostToBindings({ matchURL }: { matchURL: string }): Option<ExtractedHostToBindings> {
  const uri = URI.from(matchURL);
  const match = /^([a-zA-Z0-9][a-zA-Z0-9-]*?)--([a-zA-Z0-9][a-zA-Z0-9-]+)/.exec(uri.hostname);
  if (!match) {
    return Option.None();
  }
  const appSlug = match[1].toLowerCase();
  const userSlug = match[2].toLowerCase();
  const restPath = uri.pathname.match(/^\/~(z[a-zA-Z0-9]{8,})~(\/.*)?$/);
  if (restPath) {
    return Option.Some({
      url: matchURL,
      appSlug,
      userSlug,
      fsId: restPath[1],
      path: restPath[2] ?? "/",
    });
  }
  return Option.Some({
    url: matchURL,
    appSlug,
    userSlug,
    path: uri.pathname,
  });
}
