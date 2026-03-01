# JChris TODO

- home page should focus text area
- generate app icons
- dev iframe scroll
- consider @ routing like `/@mabels/the-app-slug` instead of `/vibe/mabels/the-app-slug`
    - see at-routing.md
- review logged out experience
- begin sync integration
- EOL `hosting/` package (fully replaced by `api/svc`, no cross-imports)
- prompt64 might be too long — add a POST option for prompt delivery

- call-ai stress testing
- normalize "preview" and "app" view to a single "app" concept; the only real difference is dev/production, so factor it away
    - see [app-preview.md](notes/app-preview.md)
    - next step research existing

## Done

- sugar "Allow Database Sharing" — auto-default instead of required choice, only prompt in edge cases (`d0330eb`)
    - see app-data-sharing.md
- curated slug word lists (slug-words.ts, 3-word format) (`e2d2b7b`)
- upgrade default model to Claude Sonnet 4.6, add Opus 4.6, demote 4.5 variants (`2bd9d5d`)
- show code view during initial generation, switch to app when ready (`52f9c8e`)