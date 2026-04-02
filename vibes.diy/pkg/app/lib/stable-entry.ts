import { BuildURI } from "@adviser/cement";

export function getStableEntryGroup(path = "/"): string | undefined {
  const match = document.cookie.match(/(?:^|;\s*)se-group=([^;]*)/);
  if (!match) return undefined;
  try {
    const groups = JSON.parse(decodeURIComponent(match[1])) as Record<string, string>;
    const sorted = Object.keys(groups).sort((a, b) => b.length - a.length);
    const matched = sorted.find((p) => path.startsWith(p));
    return matched ? groups[matched] : undefined;
  } catch {
    return undefined;
  }
}

export function applyStableEntry(uri: BuildURI): BuildURI {
  const group = getStableEntryGroup();
  if (group) {
    uri.setParam("@stable-entry@", group);
  }
  return uri;
}
