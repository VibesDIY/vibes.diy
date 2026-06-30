// Server/Worker-safe surface of @vibes.diy/identity.
//
// The certificate authority + token verification API — now in-repo (Task 5),
// wired to the owned DeviceIdCA/DeviceIdVerifyMsg + owned ClerkClaimSchema. Safe
// to bundle in a Cloudflare Worker (no fs / keybag / `find-up`). Kept separate
// from "./node" so worker code (e.g. create-handler.ts) never drags the Node-only
// keybag chain — which imports `find-up`/`unicorn-magic` and breaks the workerd build.

export { deviceIdCAFromEnv, getCloudPubkeyFromEnv, tokenApi, DeviceIdApiToken } from "./dash-api/token.js";
