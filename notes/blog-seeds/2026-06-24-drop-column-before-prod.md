# Deleting a column before it ever reached prod — the cheapest migration is the one you don't run

Source: `claude/drop-ownerroles-column` (follows the access-model design doc)

The owner-role-seeding work shipped an `ownerRoles` column on AccessFunctionBindings to let the
generator declare custom owner roles. By the time the design finalized, we'd decided not to
build the *producer* (codegen never declares them) and that the reserved `owner` role + app-level
grant docs subsume the use case — so the column was always NULL with no writer. Because the
drizzle schema-push hadn't run in prod yet, removing it cost nothing; leaving it would have baked
a dead column into Postgres behind a future `DROP COLUMN` migration. The post worth writing:
"is this column without purpose?" is a question with a hard deadline (the next deploy), and the
discipline of asking it *before* the migration runs is what keeps a schema honest. Plus the
satisfying shape of the diff — a feature collapses back to its actual mechanism (seed one
reserved role from the ownerHandle), and ~50 references across six hot-path reduce sites melt
away, while behavior is identical.
