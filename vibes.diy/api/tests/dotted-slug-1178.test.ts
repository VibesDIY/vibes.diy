// Regression test for VibesDIY/vibes.diy#1178
// Dots in userSlug / appSlug create extra subdomain levels (e.g.
// `app--john.doe.vibesdev.net` is 3 levels deep) which breaks wildcard
// TLS cert matching for `*.vibesdev.net`. A user pushing with a dotted
// handle (the `npx vibes-diy push --handle john.doe` scenario) must end up
// with a hyphenated, dot-free binding so the entry-point URL resolves.
import { beforeAll, describe, expect, it } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { ensureAppSlug, ensureUserSlug, VibesApiSQLCtx } from "@vibes.diy/api-svc";
import { calcEntryPointUrl, extractHostToBindings } from "@vibes.diy/api-pkg";
import type { ClerkClaim } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// Claims are only consulted when ownerHandle is omitted; these tests always
// supply an explicit (dotted) ownerHandle, so the claim body is unused.
function makeClaims(): ClerkClaim {
  return {
    params: {
      email: "",
      email_verified: true,
      first: "",
      image_url: "",
      last: "",
      name: null,
      public_meta: undefined,
    },
    role: "user",
    sub: "test-sub",
    userId: "test-user-id",
  };
}

describe("dotted slug sanitization (#1178)", () => {
  const sthis = ensureSuperThis();
  let vibesCtx: VibesApiSQLCtx;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    vibesCtx = appCtx.vibesCtx;
  });

  it("sanitizes a dotted ownerHandle to hyphens (no dots stored)", async () => {
    const uniq = sthis.nextId(6).str.toLowerCase();
    const userId = `dot-user-${uniq}`;
    const dottedHandle = `john.doe.${uniq}`;

    const rUser = await ensureUserSlug(vibesCtx, makeClaims(), {
      userId,
      ownerHandle: dottedHandle,
    });

    expect(rUser.isOk()).toBe(true);
    const ownerHandle = rUser.Ok().ownerHandle;
    expect(ownerHandle).not.toContain(".");
    expect(ownerHandle).toBe(`john-doe-${uniq}`);
  });

  it("sanitizes a dotted appSlug to hyphens, and the resulting host roundtrips at one subdomain level", async () => {
    const uniq = sthis.nextId(6).str.toLowerCase();
    const userId = `dot-app-user-${uniq}`;
    const dottedHandle = `j.smith.${uniq}`;
    const dottedAppSlug = `my.cool.app.${uniq}`;

    const rUser = await ensureUserSlug(vibesCtx, makeClaims(), {
      userId,
      ownerHandle: dottedHandle,
    });
    expect(rUser.isOk()).toBe(true);
    const ownerHandle = rUser.Ok().ownerHandle;

    const rApp = await ensureAppSlug(vibesCtx, {
      userId,
      ownerHandle,
      appSlug: dottedAppSlug,
    });
    expect(rApp.isOk()).toBe(true);
    const appSlug = rApp.Ok().appSlug;

    expect(ownerHandle).not.toContain(".");
    expect(appSlug).not.toContain(".");
    expect(appSlug).toBe(`my-cool-app-${uniq}`);

    // The entry-point host must have exactly one subdomain label before the
    // base domain so a `*.vibesdev.net` cert covers it.
    const url = calcEntryPointUrl({
      hostnameBase: "vibesdev.net",
      protocol: "https",
      bindings: { appSlug, ownerHandle },
    });
    const host = new URL(url).hostname;
    expect(host).toBe(`${appSlug}--${ownerHandle}.vibesdev.net`);
    // base domain has 2 labels (vibesdev, net) + exactly one subdomain label
    expect(host.split(".")).toHaveLength(3);

    // And the host extraction regex must resolve it back to the same bindings.
    const extracted = extractHostToBindings({ matchURL: url });
    expect(extracted.IsSome()).toBe(true);
    expect(extracted.Unwrap().appSlug).toBe(appSlug);
    expect(extracted.Unwrap().ownerHandle).toBe(ownerHandle);
  });
});
