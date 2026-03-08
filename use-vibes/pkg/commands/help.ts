const helpText = `use-vibes — build and deploy React + Fireproof apps

  Agent workflow:  skills → system → generate → live/publish
  Human workflow:  login → dev → edit → publish

Auth:
  login                      Device-code auth, stores credentials locally
  whoami                     Print the logged-in user (used as default owner)

Develop:
  dev                        Live-push to dev group (sugar for: live dev)
  live <group>               Watch files, push every save to target group
  generate <slug> "prompt"   AI-create a new vibe (slug.jsx)
  edit <slug|file> "prompt"  AI-edit an existing vibe, stream diff

Prompts:
  skills                     List available RAG skills with descriptions
  system [--skills ...]      Emit assembled system prompt to stdout

Deploy:
  publish [group]            One-time push to target group (default: 'default')
  invite <group> [flags]     Generate a join link (default: writer + inviteWriter)
                             --reader, --no-invite, --invite-reader, --invite-writer

Targets:
  Bare name:      work-lunch             → {whoami}/{app}/work-lunch
  Fully qualified: jchris/app/group      → used as-is

Example — agent building an app from scratch:

  $ use-vibes skills                           # read skill catalog
  $ use-vibes system --skills fireproof,d3     # get system prompt
  $ use-vibes generate dashboard "sales dashboard"  # AI-create dashboard.jsx
  $ use-vibes dev                              # push to dev, get URL
  $ use-vibes publish demo                     # freeze for sharing
`;

export async function help(_args: string[]): Promise<void> {
  process.stdout.write(helpText);
}
