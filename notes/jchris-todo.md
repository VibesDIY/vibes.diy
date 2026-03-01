# JChris TODO

- generate app icons
- consider @ routing like `/@mabels/the-app-slug` instead of `/vibe/mabels/the-app-slug`
    - see at-routing.md
- show code view during initial generation (not blank preview)
    - switch to app when code ready
- review logged out experience
- begin sync integration
- EOL `hosting/` package (fully replaced by `api/svc`, no cross-imports)
- eval faster default model
- dynamic slice loading in generation prompt
- prompt64 might be too long — add a POST option for prompt delivery
- dev iframe scroll
- normalize "preview" and "app" view to a single "app" concept; the only real difference is dev/production, so factor it away
    - see [app-preview.md](notes/app-preview.md)
    - next step research existing

## Done

- sugar "Allow Database Sharing" — auto-default instead of required choice, only prompt in edge cases (`d0330eb`)
    - see app-data-sharing.md
- curated slug word lists (slug-words.ts, 3-word format) (`e2d2b7b`)