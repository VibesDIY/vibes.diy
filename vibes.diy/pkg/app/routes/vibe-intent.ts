export type VibeIntent = "install" | "join";

const VALID_INTENTS = new Set<VibeIntent>(["install", "join"]);

function isVibeIntent(value: string): value is VibeIntent {
  return VALID_INTENTS.has(value as VibeIntent);
}

export function readIntent(params: URLSearchParams): VibeIntent | undefined {
  const raw = params.get("intent");
  if (raw === null) return undefined;
  return isVibeIntent(raw) ? raw : undefined;
}

export function withIntent(pathAndQuery: string, intent: VibeIntent): string {
  const [path, query = ""] = pathAndQuery.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("intent", intent);
  return `${path}?${params.toString()}`;
}

export function withoutIntent(pathAndQuery: string): string {
  const [path, query = ""] = pathAndQuery.split("?", 2);
  const params = new URLSearchParams(query);
  if (params.has("intent") === false) return pathAndQuery;
  params.delete("intent");
  const next = params.toString();
  return next.length === 0 ? path : `${path}?${next}`;
}
