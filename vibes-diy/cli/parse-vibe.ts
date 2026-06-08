export function parseVibe(raw: string): { handle: string | undefined; appSlug: string } {
  const slashIdx = raw.indexOf("/");
  if (slashIdx === -1) return { handle: undefined, appSlug: raw };
  return { handle: raw.slice(0, slashIdx), appSlug: raw.slice(slashIdx + 1) };
}

export function resolveVibeArgs(args: { vibe: string; handle: string; appSlug: string; positionalAppSlug: string }): {
  handle: string;
  appSlug: string;
} {
  if (args.vibe) {
    const parsed = parseVibe(args.vibe);
    return { handle: parsed.handle ?? "", appSlug: parsed.appSlug };
  }
  const positional = args.positionalAppSlug ? parseVibe(args.positionalAppSlug) : undefined;
  const handle = args.handle || positional?.handle || "";
  const appSlug = args.appSlug || positional?.appSlug || "";
  return { handle, appSlug };
}
