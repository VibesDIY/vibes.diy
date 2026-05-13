export type VibeIntent = "install" | "join";

const VALID_INTENTS = new Set<VibeIntent>(["install", "join"]);

export function readIntent(params: URLSearchParams): VibeIntent | undefined {
  const raw = params.get("intent");
  return raw && VALID_INTENTS.has(raw as VibeIntent) ? (raw as VibeIntent) : undefined;
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
  if (!params.has("intent")) return pathAndQuery;
  params.delete("intent");
  const next = params.toString();
  return next ? `${path}?${next}` : path;
}
