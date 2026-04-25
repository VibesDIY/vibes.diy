# Chrome DevTools MCP debugging loop

When iterating on a UI/streaming bug with the user driving the dev server, follow this loop. It compresses signal-to-noise: real reproduction, structured snapshots from the page, no premature edits.

## Loop

1. **Add logging before reproducing.** Drop `console.log`/`console.warn` breadcrumbs at the suspect call sites — and a `window.__<feature>Debug` snapshot the page can write each render. Console alone is too noisy; the window object lets you `evaluate_script` to pull a structured shape after the fact. Mark the logging clearly in the commit message as temporary so it's easy to remove later.
2. **Open the page via `mcp__chrome-devtools__navigate_page`.** If a tab is already open, prefer `navigate_page` (reload or new URL) over `new_page` so the user keeps their session.
3. **Reproduce** — let the user drive. While they do, the only acceptable actions are read-only ones (`take_screenshot`, `take_snapshot`, `list_console_messages`, `evaluate_script` for inspection, `list_network_requests`). Do not edit code while the user is reproducing unless they ask.
4. **Inspect:**
   - `list_console_messages` with `types: ["log", "warn", "error"]` for breadcrumbs.
   - `evaluate_script` calling `() => window.__<feature>Debug` to retrieve the structured snapshot.
   - For server-persisted state, `evaluate_script` an `async () => fetch(...)` to read what the iframe is actually loading. The persisted asset and the in-memory resolved buffer are not always the same — diff them.
   - `take_snapshot` (a11y tree) is better than screenshots for reading text content like chat history labels.
5. **Form a hypothesis** — write it down before changing anything.
6. **Write a failing test** that captures the hypothesis. Pure-function logic gets a unit test; UI logic gets a component test or a hook test.
7. **Fix the code** until the failing test passes. Run the rest of the affected package's tests to catch regressions.
8. **Re-verify in dev** — reload the page (`navigate_page` with `type: "reload", ignoreCache: true`), let the user reproduce again, confirm the breadcrumb shape now shows the expected state.
9. **Loop** on the next bug.

## Restarting the dev server

Vite HMRs client-side TS, but Server-side TS imported via React-Router SSR may hold stale modules in its module cache. When a fix in a server-only path (e.g. `vibes.diy/api/svc/...`) doesn't take effect after editing, kill the dev server PID listening on the relevant port and restart with `pnpm dev`. Use `Monitor` with an `until curl ...` poll loop to detect ready-state without sleeping.

## Common pitfalls

- **`window.__*Debug` only exists when the resolver actually ran.** If the snapshot is `null`, the code path you're debugging didn't execute — e.g. the React effect hasn't fired yet, or the wrong fsId is in the URL.
- **fsIds are content-addressed hashes.** Two failing turns can produce the same fsId because empty content always hashes to the same value. Don't assume "same fsId = same turn." Compare content lengths and snapshot timestamps.
- **The iframe sandbox loads from a different host** (`<appSlug>--<userSlug>.localhost.vibesdiy.net:8888`). Fetching the persisted asset to confirm what the iframe sees is the only way to distinguish "client-only fix landed" from "fully fixed."
- **Replace markers (`<<<<<<< SEARCH`) inside chat history bubbles** are visible to the user — that's a UX issue, not a parser bug.

## Cleanup

When the loop ends, remove temporary `console.log`/`console.warn` breadcrumbs and the `window.__*Debug` writer. Keep telemetry only if it's already in a structured `debug` namespace the project ships with.
