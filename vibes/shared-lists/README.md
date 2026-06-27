# shared-lists

The Productive category starter for the Instant Starter Stack — a multi-list collaborative todo with per-list friends and drag-sortable items. Owned by the `system` handle.

Each list is a Fireproof channel (`list:<id>` + `list:<id>/admin`); the creator is sole admin and invites friends by handle, who get full read/write on items. Items carry a float `position` so a drag-reorder writes only the moved doc. Access policy lives in [`access.js`](access.js) (exported as `sharedLists`, matching the database name). Reads are anonymous; writes require login.

Live: https://vibes.diy/vibe/system/shared-lists

## Commands

```sh
npx vibes-diy push --vibe system/shared-lists   # deploy this directory
npx vibes-diy pull --vibe system/shared-lists   # fetch the deployed source
```

Always pass `--vibe system/shared-lists` so it isn't published under a personal handle.
Run `npx prettier --write .` before committing — CI's `compile_test` runs `format:check`.
