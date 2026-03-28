# Usage Report

This directory contains the database inspection and usage-report tooling for team reporting.

Files:

- `inspect-db.ts`: read-only database inspector for connection info, table listings, table samples, and ad hoc SQL.
- `inspect-db-report.ts`: report generator that queries the database, writes CSV snapshots, and produces the HTML report.
- `inspect-db-report-template.ts`: HTML template/rendering module used by the report generator.

Commands:

```bash
pnpm --dir /Users/jchris/code/fp/vibes.diy/vibes.diy/api/svc run inspect:db info
pnpm --dir /Users/jchris/code/fp/vibes.diy/vibes.diy/api/svc run inspect:db tables
pnpm --dir /Users/jchris/code/fp/vibes.diy/vibes.diy/api/svc run inspect:db-report
```

Local configuration:

- Put `NEON_DATABASE_URL=...` in `/Users/jchris/code/fp/vibes.diy/vibes.diy/api/svc/.dev.vars`
- `.dev.vars` is gitignored

Generated output:

- HTML and CSV files are written to `vibes.diy/api/svc/dist/inspect-db-report`
- rerunning the report overwrites the same files in place
