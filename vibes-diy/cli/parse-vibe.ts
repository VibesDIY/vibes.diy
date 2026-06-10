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
    if (args.handle && parsed.handle && args.handle !== parsed.handle) {
      throw new Error(`Conflicting values: --vibe "${args.vibe}" disagrees with --handle "${args.handle}"`);
    }
    if (args.appSlug && args.appSlug !== parsed.appSlug) {
      throw new Error(`Conflicting values: --vibe "${args.vibe}" disagrees with --app-slug "${args.appSlug}"`);
    }
    return { handle: parsed.handle ?? "", appSlug: parsed.appSlug };
  }
  const positional = args.positionalAppSlug ? parseVibe(args.positionalAppSlug) : undefined;
  const handle = args.handle || positional?.handle || "";
  const appSlug = args.appSlug || positional?.appSlug || "";
  return { handle, appSlug };
}

// Resolve the vibe for commands that take it as a positional alongside trailing
// positionals (edit's `prompt`, chats' `chatId`). cmd-ts binds positionals
// left-to-right into declared slots, so a single positional always lands in the
// vibe slot. When `--vibe` supplies the vibe, the value the user typed is really
// the next argument, so the whole positional list shifts to `trailing`; without
// `--vibe`, the leading positional is the vibe and the rest are trailing.
// Throws the same shape of error as resolveVibeArgs when no vibe can be resolved.
export function resolveVibePositionals(args: { vibe: string; handle: string; positionals: readonly (string | undefined)[] }): {
  handle: string;
  appSlug: string;
  trailing: string[];
} {
  const present = args.positionals.filter((v): v is string => v !== undefined && v !== "");
  // For multi-slot commands (edit, chats), filling EVERY slot while also passing
  // --vibe is the stale "placeholder vibe + override" form. There are only
  // (slots - 1) trailing args, so a full set means the leading positional is a
  // leftover placeholder — reject it loudly rather than silently reinterpreting
  // it as the prompt/chatId.
  if (args.vibe && args.positionals.length > 1 && present.length === args.positionals.length) {
    throw new Error(
      "--vibe already supplies the vibe — drop the extra leading positional (the placeholder vibe argument is no longer needed)."
    );
  }
  const positionalAppSlug = args.vibe ? "" : (present[0] ?? "");
  const trailing = args.vibe ? present : present.slice(1);
  const resolved = resolveVibeArgs({ vibe: args.vibe, handle: args.handle, appSlug: "", positionalAppSlug });
  if (resolved.appSlug === "") {
    throw new Error("No vibe specified — pass a vibe (handle/app-slug) as a positional or use --vibe.");
  }
  return { handle: resolved.handle, appSlug: resolved.appSlug, trailing };
}
