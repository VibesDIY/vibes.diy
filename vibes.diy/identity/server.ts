// Server/Worker-safe surface of @vibes.diy/identity.
//
// The certificate authority + token verification API. These come from
// `core-protocols-dashboard` and are safe to bundle in a Cloudflare Worker
// (no fs / keybag / `find-up`). Kept separate from "./node" so worker code
// (e.g. create-handler.ts) never drags the Node-only keybag/device-id chain
// — which imports `find-up`/`unicorn-magic` and breaks the workerd build.

export { deviceIdCAFromEnv, getCloudPubkeyFromEnv, tokenApi } from "@fireproof/core-protocols-dashboard";
