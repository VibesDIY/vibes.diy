/**
 * Build the markdown a user pastes into their favourite coding harness (Claude
 * Code, Cursor, …) so the agent can pull THIS vibe, edit it locally, and push it
 * back with the `vibes-diy` CLI. Rendered by the "Copy instructions for your
 * coding agent" affordance on the vibe editor's Code tab.
 *
 * The copy is written AT the agent, not the user, and encodes three things the
 * platform wants every harness to know:
 *   1. `npx vibes-diy help` is the entry point — no install, discovers everything.
 *   2. The agent should run `vibes-diy login` ITSELF when it's on the user's
 *      machine — `login` auto-opens a browser for the human to approve, so there's
 *      no need to hand the login step back to the user.
 *   3. `pull` works for anyone who can open the vibe (you get the published
 *      source); only `push` needs an editor grant.
 */
export interface AgentInstructionsInput {
  readonly ownerHandle: string;
  readonly appSlug: string;
  /** Human title if we have one; falls back to the slug in the heading. */
  readonly title?: string;
}

export function buildAgentInstructions({ ownerHandle, appSlug, title }: AgentInstructionsInput): string {
  const vibe = `${ownerHandle}/${appSlug}`;
  const heading = title?.trim() ? title.trim() : appSlug;
  const dir = appSlug;
  return `# Edit "${heading}" with your coding agent

You're looking at the source of **${vibe}**, a single-file React app hosted on vibes.diy. Point your coding agent (Claude Code, Cursor, Codex, …) at the \`vibes-diy\` CLI to pull this vibe, edit it locally, and push your changes back. Paste this whole message to your agent.

## 1. Discover the CLI

\`\`\`sh
npx vibes-diy help
\`\`\`

No install needed — \`npx\` fetches the CLI on demand and \`help\` lists every command.

## 2. Log in — agent, do this yourself; don't ask the user

\`\`\`sh
npx vibes-diy login
\`\`\`

If you're running on the user's own machine, **run \`login\` yourself**. It opens a browser tab for the user to approve and returns automatically once they do — you do **not** need to stop and ask the user to run \`login\` by hand. (Headless/CI only: set the \`VIBES_DEVICE_ID\` env var instead of logging in interactively.)

## 3. Pull this vibe locally

\`\`\`sh
npx vibes-diy pull ${vibe} --dir ${dir}
cd ${dir}
\`\`\`

This writes the top-level source — \`App.jsx\`, the \`access.js\` access-control file, and any other root files — into \`./${dir}/\`. Anyone who can open this vibe can pull its source (you get the published version). You only need an **editor** grant to push changes back.

## 4. Edit

- Run \`npx vibes-diy system\` first for the current vibe coding rules.
- Edit \`App.jsx\` and friends like any React source. The source is **flat** — keep every editable file at the root; \`push\` does not recurse into subdirectories.

## 5. Push it back

\`\`\`sh
npx vibes-diy push --vibe ${vibe}
\`\`\`

Then verify: re-pull into a scratch directory and confirm your change shipped. Pushing requires an editor grant on the vibe.
`;
}
