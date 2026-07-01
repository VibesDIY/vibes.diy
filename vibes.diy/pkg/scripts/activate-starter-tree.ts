// Activate the /start on-ramp starter tree (#2941) — the post-deploy seed.
//
// Derives everything from the checked-in curated graph
// (`app/routes/starter-graph.ts`, the single source of truth) and performs the
// two owner-gated writes the design's "Operating the seed" section calls for:
//
//   1. `seedStarterChips` per `starterSeedPlan()` entry — writes each source
//      starter's talk-only narration turn so `getVibeChips` surfaces its curated
//      `▸` chips (display-only, non-producible by construction).
//   2. `ensureAppSettings` cross-slug `cachedSuggestionBless` per curated edge —
//      blesses `chipLabel → targetVibe` under the slug-scoped
//      `cachedSuggestionVibeLinkKey`, so `getCachedSuggestion` resolves the jump
//      server-side and the link survives source-vibe updates with no re-bless.
//
// Both writes are idempotent (seed replaces under a deterministic promptId;
// bless upserts by key), so re-running after a graph change is the intended
// workflow. The caller must be authenticated as the owner of each source
// handle (v1: `system`) — via a prior `vibes-diy login`, or headlessly via the
// VIBES_DEVICE_ID env var (same format the CLI accepts).
//
// Usage:
//   pnpm --dir vibes.diy/pkg run starters:activate -- --dry-run
//   pnpm --dir vibes.diy/pkg run starters:activate
//   pnpm --dir vibes.diy/pkg run starters:activate -- --api-url https://vibes.diy/api

import { Buffer } from "node:buffer";
import type { DeviceIdKeyBagItem, JWKPrivate, SuperThis } from "@vibes.diy/identity";
import { ensureSuperThis, JWKPrivateSchema } from "@vibes.diy/identity";
import { createDeviceIdGetToken, getKeyBag } from "@vibes.diy/identity/node";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { cachedSuggestionVibeLinkKey } from "@vibes.diy/api-types";
import { CURATED_EDGES, starterSeedPlan } from "../app/routes/starter-graph.js";

// The `cli` stable-entry group — an exact prod clone on the same single data
// plane (agents/environments.md), and the same default the vibes-diy CLI uses.
const DEFAULT_API_URL = "https://vibes.diy/api?.stable-entry.=cli";

const VIBES_DEVICE_ID_ENV = "VIBES_DEVICE_ID";

// Headless-auth seed, compatible with the CLI's VIBES_DEVICE_ID contract
// (vibes-diy/cli/device-id-env.ts — the CLI package exposes no import surface,
// so the small parse is mirrored here): the env var carries the device-id
// keybag item (raw or base64 JSON, full keybag file or bare item), and an
// interactive login already present in the keybag always wins.
async function seedDeviceIdFromEnv(sthis: SuperThis): Promise<void> {
  const raw = sthis.env.get(VIBES_DEVICE_ID_ENV);
  if (!raw) return;
  const kb = await getKeyBag(sthis);
  const existing = await kb.getDeviceId();
  if (existing.cert.IsSome()) return; // interactive login wins
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    parsed = JSON.parse(Buffer.from(raw.trim(), "base64").toString("utf8"));
  }
  const top = parsed as Record<string, unknown>;
  const item = (typeof top.item === "object" && top.item ? top.item : top) as Record<string, unknown>;
  const deviceId = JWKPrivateSchema.parse(item.deviceId) as JWKPrivate;
  const cert = item.cert as DeviceIdKeyBagItem["cert"];
  if (!cert || typeof (cert as { certificateJWT?: unknown }).certificateJWT !== "string") {
    throw new Error(`${VIBES_DEVICE_ID_ENV} is missing the signed certificate`);
  }
  await kb.setDeviceId(deviceId, cert);
}

function parseArgs(argv: readonly string[]): { apiUrl: string; dryRun: boolean } {
  let apiUrl = DEFAULT_API_URL;
  let dryRun = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--") {
      // pnpm forwards the run-script separator verbatim
    } else if (argv[i] === "--api-url" && argv[i + 1]) {
      apiUrl = argv[i + 1];
      i += 1;
    } else if (argv[i] === "--dry-run") {
      dryRun = true;
    } else {
      throw new Error(`unknown argument: ${argv[i]} (supported: --api-url <url>, --dry-run)`);
    }
  }
  return { apiUrl, dryRun };
}

async function main(): Promise<number> {
  const { apiUrl, dryRun } = parseArgs(process.argv.slice(2));
  const seeds = starterSeedPlan();

  console.log(`Curated starter tree (from starter-graph.ts) → ${apiUrl}\n`);
  for (const seed of seeds) {
    console.log(`seedStarterChips ${seed.ownerHandle}/${seed.appSlug}`);
    for (const chip of seed.chips) console.log(`  ▸ ${chip}`);
  }
  for (const edge of CURATED_EDGES) {
    const key = cachedSuggestionVibeLinkKey({
      ownerHandle: edge.source.ownerHandle,
      appSlug: edge.source.appSlug,
      transform: edge.chipLabel,
    });
    console.log(
      `bless ${edge.source.ownerHandle}/${edge.source.appSlug} "${edge.chipLabel}" → ` +
        `${edge.target.ownerHandle}/${edge.target.appSlug}  [${key}]`
    );
  }
  if (dryRun) {
    console.log("\n--dry-run: no writes performed.");
    return 0;
  }

  const sthis = ensureSuperThis();
  await seedDeviceIdFromEnv(sthis);
  const getToken = await createDeviceIdGetToken(sthis, {
    iss: "use-vibes/cli",
    missingCertMessage: `No device identity — run 'vibes-diy login' or set ${VIBES_DEVICE_ID_ENV}`,
  });
  const api = new VibesDiyApi({ apiUrl, getToken });

  let failures = 0;
  try {
    for (const seed of seeds) {
      const r = await api.seedStarterChips({
        ownerHandle: seed.ownerHandle,
        appSlug: seed.appSlug,
        chips: [...seed.chips],
      });
      if (r.isErr()) {
        failures += 1;
        console.error(`FAIL seed ${seed.ownerHandle}/${seed.appSlug}: ${r.Err().message}`);
      } else {
        console.log(`ok   seed ${seed.ownerHandle}/${seed.appSlug}: ${r.Ok().seededChips.length} chip(s)`);
      }
    }
    for (const edge of CURATED_EDGES) {
      const key = cachedSuggestionVibeLinkKey({
        ownerHandle: edge.source.ownerHandle,
        appSlug: edge.source.appSlug,
        transform: edge.chipLabel,
      });
      const r = await api.ensureAppSettings({
        ownerHandle: edge.source.ownerHandle,
        appSlug: edge.source.appSlug,
        cachedSuggestionBless: {
          key,
          targetOwnerHandle: edge.target.ownerHandle,
          targetAppSlug: edge.target.appSlug,
          op: "bless",
        },
      });
      const err = r.isErr() ? r.Err().message : r.Ok().error;
      if (err) {
        failures += 1;
        console.error(`FAIL bless "${edge.chipLabel}" on ${edge.source.ownerHandle}/${edge.source.appSlug}: ${err}`);
      } else {
        console.log(`ok   bless "${edge.chipLabel}" → ${edge.target.ownerHandle}/${edge.target.appSlug}`);
      }
    }
  } finally {
    await api.close().catch(() => undefined);
  }

  if (failures > 0) {
    console.error(`\n${failures} write(s) failed.`);
    return 1;
  }
  console.log("\nStarter tree activated.");
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error("Error:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
