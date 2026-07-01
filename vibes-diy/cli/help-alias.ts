/**
 * `vibes-diy help` and `vibes-diy help <cmd>` are not real cmd-ts subcommands —
 * cmd-ts only wires up the `--help` flag and a bare invocation. But our docs, the
 * README template, the CLI footer, and the editor's "copy agent instructions"
 * brief all tell users (and coding agents) to run `npx vibes-diy help`, so we
 * normalize a leading `help` token into the flag cmd-ts understands:
 *
 *   vibes-diy help        -> vibes-diy --help
 *   vibes-diy help pull   -> vibes-diy pull --help
 *
 * Anything that isn't a leading `help` passes through untouched.
 */
export function normalizeHelpArgv(argv: readonly string[]): string[] {
  if (argv[0] !== "help") return [...argv];
  const rest = argv.slice(1);
  // `help` alone → top-level help; `help <subcommand> …` → that subcommand's help.
  return rest.length === 0 ? ["--help"] : [...rest, "--help"];
}
