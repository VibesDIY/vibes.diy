#!/usr/bin/env tsx
// One-off script: find all vibes whose App.jsx contains a given token.
// Usage: tsx search-vibes.ts [token] [--concurrency N]
// Default token: ImgVibes
// NOT intended for shipping — unbounded iteration is a DOS risk.

import { ensureSuperThis } from "@fireproof/core-runtime";
import { getKeyBag } from "@fireproof/core-keybag";
import { DeviceIdKey, DeviceIdSignMsg } from "@fireproof/core-device-id";
import { FPDeviceIDSession, SuperThis } from "@fireproof/core";
import { DashAuthType } from "@fireproof/core-types-protocols-dashboard";
import { Lazy, Result } from "@adviser/cement";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { dotenv } from "zx";

const API_URL = "https://vibes.diy/api?.stable-entry.=cli";
const HOSTNAME_BASE = "prod-v2.vibesdiy.net";

async function makeApiFactory(sthis: SuperThis) {
  const kb = await getKeyBag(sthis);
  const devid = await kb.getDeviceId();
  const rDevkey = await DeviceIdKey.createFromJWK(devid.deviceId.Unwrap());
  if (rDevkey.isErr()) throw rDevkey.Err();
  if (devid.cert.IsNone()) throw new Error("Device ID certificate missing — run vibes-diy login first");
  const payload = devid.cert.Unwrap()!.certificatePayload;
  const deviceIdSigner = new DeviceIdSignMsg(sthis.txt.base64, rDevkey.Ok(), payload);
  let seq = 0;
  const getToken = Lazy(
    async (): Promise<Result<DashAuthType>> => {
      const now = Math.floor(Date.now() / 1000);
      const token = await deviceIdSigner.sign(
        {
          iss: "use-vibes/cli",
          sub: "device-id",
          deviceId: await rDevkey.Ok().fingerPrint(),
          seq: ++seq,
          exp: now + 120,
          nbf: now - 2,
          iat: now,
          jti: sthis.nextId().str,
        } satisfies FPDeviceIDSession,
        "ES256"
      );
      return Result.Ok({ type: "device-id", token });
    },
    { resetAfter: 60, skipUnref: true }
  );
  return (apiUrl: string) => new VibesDiyApi({ apiUrl, getToken });
}

async function withConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const tokenIdx = args.findIndex((a) => a === "--token");
  const token = tokenIdx >= 0 ? args[tokenIdx + 1] : (args.find((a) => !a.startsWith("--")) ?? "ImgVibes");
  const concurrencyIdx = args.findIndex((a) => a === "--concurrency");
  const concurrency = concurrencyIdx >= 0 ? parseInt(args[concurrencyIdx + 1], 10) : 20;

  console.error(`Searching for token: "${token}" (concurrency=${concurrency})`);

  const sthis = ensureSuperThis();
  const env = dotenv.loadSafe(".dev.vars", ".env");
  sthis.env.sets({ ...env } as Record<string, string>);

  const factory = await makeApiFactory(sthis);
  const api = factory(API_URL);

  // Collect all vibes via pagination
  const allVibes: { userSlug: string; appSlug: string }[] = [];
  let cursor: string | undefined;
  process.stderr.write("Listing vibes");
  do {
    const rPage = await api.listRecentVibes({ limit: 100, ...(cursor ? { cursor } : {}) });
    if (rPage.isErr()) {
      console.error("\nFailed to list vibes:", rPage.Err());
      process.exit(1);
    }
    const page = rPage.Ok();
    allVibes.push(...page.items.map((i) => ({ userSlug: i.userSlug, appSlug: i.appSlug })));
    cursor = page.nextCursor;
    process.stderr.write(` ${allVibes.length}`);
  } while (cursor);
  process.stderr.write("\n");
  console.error(`Total vibes: ${allVibes.length}`);

  let checked = 0;
  const matches: string[] = [];

  await withConcurrency(allVibes, concurrency, async ({ userSlug, appSlug }) => {
    const url = `https://${appSlug}--${userSlug}.${HOSTNAME_BASE}/App.jsx`;
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const text = await resp.text();
        if (text.includes(token)) {
          const label = `${userSlug}/${appSlug}`;
          matches.push(label);
          console.log(label);
        }
      }
    } catch {
      // network error — skip silently
    }
    checked++;
    if (checked % 100 === 0) {
      process.stderr.write(`  checked ${checked}/${allVibes.length}, found ${matches.length} so far\n`);
    }
  });

  console.error(`\nDone. Found ${matches.length} vibes containing "${token}" out of ${allVibes.length} checked.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
