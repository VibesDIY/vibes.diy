# access.js Root Cause Investigation

**Question:** Why do web-UI-created vibes 404 on access.js pull when CLI-pushed vibes work fine?

## Findings

### Test 1: CLI push + pull — works perfectly

```
cd /tmp/test-access-cli
npx vibes-diy@latest push --handle jchris --app-slug test-access-cli-2188
# → Deployed: jchris/test-access-cli-2188

npx vibes-diy@latest pull --handle jchris test-access-cli-2188
# → Wrote 2 file(s): access.js (216 B), App.jsx (602 B)

curl "https://test-access-cli-2188--jchris.prod-v2.vibesdiy.net/access.js?source=true"
# → HTTP 200, full source content
```

CLI push uses `mode: "production"`. fsId on prod sandbox: `zAEvWDpwozimikTS9aqyJgCf5gGTMGPVY2RYwRHNWufEH` (real hash).

### Test 2: Web UI creation — pull fails

Created vibe via web UI: "a simple shared note-taking app where only signed-in users can write notes". The Code tab shows both `/App.jsx` and `/access.js` tabs — the LLM DID produce access.js as a code block.

```
npx vibes-diy@latest pull --handle jchris shared-notes
# → Error: Failed to fetch access.js: HTTP 404
```

Both sandbox environments return "Filesystem not found":
```
curl "https://shared-notes--jchris.cli-v2.vibesdiy.net/access.js?source=true"
# → HTTP 404, {"type":"error","message":"Filesystem not found ..."}

curl "https://shared-notes--jchris.prod-v2.vibesdiy.net/access.js?source=true"
# → HTTP 404, {"type":"error","message":"Filesystem not found ..."}
```

But the ROOT of the cli-v2 sandbox loads fine — it serves the HTML shell. The key discovery:

```
curl "https://shared-notes--jchris.cli-v2.vibesdiy.net/" | grep fsId
# → "fsId":"pending"
```

### Root cause: `fsId: "pending"`

The web-UI vibe has `fsId: "pending"` — the files exist in the streaming/chat state but have NOT been committed to a real fsId in the `apps` table. The sandbox HTML shell loads (it's served by a different path that doesn't need fsId), but individual file fetches via `/{fileName}?source=true` fail because `serv-entry-point` looks up the app by fsId and finds nothing.

Meanwhile, the pull command calls `getAppByFsId` which DOES find the app's fileSystem (including access.js) from the latest promptContext/apps row. So pull knows about access.js and tries to fetch it from the sandbox — but the sandbox can't serve it because the fsId is "pending".

### Why CLI works but web UI doesn't

- **CLI push** uses `mode: "production"` by default. `ensureAppSlugItem` stores files and gets a real fsId. The sandbox can serve files immediately.
- **Web UI** uses `mode: "dev"`. The streaming LLM response produces code blocks. `handlePromptContext` calls `ensureAppSlugItem` with the resolved files. This DOES store files and create a real fsId in the `apps` table. But the sandbox URL the pull command hits doesn't route to the right fsId.

### The real problem: pull fetches from sandbox, not from storage

The pull command (`pull-cmd.ts:113-131`) does this:
1. `api.getAppByFsId()` → gets the fileSystem array with file names, CIDs, URIs
2. For each file, constructs `https://{appSlug}--{ownerHandle}.{hostnameBase}/{fileName}?source=true`
3. Fetches from the SANDBOX via HTTP

Step 2 is the problem. The sandbox serves files from the LATEST published version (resolved via hostname → appSlug → ownerHandle → latest fsId). If the latest fsId is from a dev-mode push, the sandbox may not resolve it correctly.

The file content is already available at step 1 — the `FileSystemItem` has `assetURI` pointing directly to the R2/storage blob. Pull could fetch from `assetURI` instead of going through the sandbox HTTP round-trip. That would be more reliable AND faster.

### Summary

**The bug is NOT that access.js is missing from fileSystem.** access.js IS in fileSystem (the pull command found it in the metadata). The bug is that the pull command fetches file CONTENT from the sandbox via HTTP, and the sandbox can't serve files for dev-mode web-UI vibes because the fsId routing doesn't resolve.

This affects ALL files for web-UI vibes, not just access.js. It just happens that access.js comes first alphabetically, so pull fails on it and never gets to try App.jsx.

### Fix options

1. **Fix pull to fetch from storage directly** — use `assetURI` from the FileSystemItem instead of the sandbox URL. The file content is already in R2/storage. No sandbox round-trip needed. This is cleaner and fixes the issue for all file types.

2. **Fix the sandbox fsId routing for dev-mode vibes** — make the sandbox resolve the latest fsId for dev-mode apps. This fixes serving but doesn't address the unnecessary sandbox round-trip in pull.

Option 1 is the right fix — it's simpler, more reliable, and eliminates the weird fetch-from-sandbox pattern the user flagged.

### Test 3: Publish validates the hypothesis

Clicked "Publish" in the Share dialog for the web-UI vibe. After publishing:

```
curl "https://shared-notes--jchris.prod-v2.vibesdiy.net/access.js?source=true"
# → HTTP 200, full source content

npx vibes-diy@latest pull --handle jchris shared-notes
# → Wrote 2 file(s): access.js (453 B), App.jsx (6524 B)
```

**Confirmed:** the bug is entirely about dev-mode vibes not being servable from the sandbox. Publishing promotes to production mode with a real fsId, and everything works. access.js IS in fileSystem the whole time — the sandbox just can't resolve it until the vibe is published.

### Revised root cause

The issue title says "access.js should be in fileSystem" — but access.js IS in fileSystem. The real bug is: **pull fetches file content from the sandbox via HTTP, and the sandbox can't serve dev-mode vibes.** This affects ALL files, not just access.js. Publishing (promoting to production mode) fixes it.

The fix should either:
1. Make pull fetch from storage directly (using `assetURI` from the FileSystemItem), or
2. Make pull work for dev-mode vibes by fixing sandbox routing

Option 1 is cleaner — stop depending on the sandbox for pull entirely.
