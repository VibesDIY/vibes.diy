import { option, string } from "cmd-ts";
import { basename } from "node:path";
import type { CliCtx } from "../../cli-ctx.js";
import type { VibesDiyApi } from "@vibes.diy/api-impl";
import { Result, BuildURI } from "@adviser/cement";
import { isUserSettingDefaultHandle } from "@vibes.diy/api-types";
import { resolveVibeArgs } from "../../parse-vibe.js";

export function dbCommonArgs(ctx: CliCtx) {
  return {
    vibe: option({
      long: "vibe",
      description: "Vibe identifier as handle/app-slug",
      type: string,
      defaultValue: () => "",
      defaultValueIsSerializable: true,
    }),
    appSlug: option({
      long: "app-slug",
      description: "App slug; defaults to env VIBES_APP_SLUG or basename(cwd)",
      type: string,
      defaultValue: () => ctx.sthis.env.get("VIBES_APP_SLUG") ?? basename(process.cwd()),
      defaultValueIsSerializable: true,
    }),
    ownerHandle: option({
      long: "handle",
      description: "Handle; defaults to defaultHandle from user settings",
      type: string,
      defaultValue: () => "",
      defaultValueIsSerializable: true,
    }),
    ownerHandleDeprecated: option({
      long: "user-slug",
      type: string,
      defaultValue: () => "",
      defaultValueIsSerializable: true,
    }),
    dbName: option({
      long: "db",
      description: "Database name",
      type: string,
      defaultValue: () => "default",
      defaultValueIsSerializable: true,
    }),
  };
}

export function resolveDbVibeArgs(args: { vibe: string; appSlug: string; ownerHandle: string; ownerHandleDeprecated: string }): {
  appSlug: string;
  ownerHandle: string;
} {
  if (args.ownerHandleDeprecated) {
    process.stderr.write("[deprecated] --user-slug is deprecated, use --handle or --vibe instead\n");
  }
  const resolved = resolveVibeArgs({
    vibe: args.vibe,
    handle: args.ownerHandle || args.ownerHandleDeprecated,
    appSlug: args.appSlug,
    positionalAppSlug: "",
  });
  return { appSlug: resolved.appSlug, ownerHandle: resolved.handle };
}

// Resolve ownerHandle: explicit override -> defaultHandle from user settings.
export async function resolveUserSlug(api: VibesDiyApi, explicit: string): Promise<Result<string>> {
  if (explicit !== "") return Result.Ok(explicit);
  const r = await api.ensureUserSettings({ settings: [] });
  if (r.isErr()) return Result.Err(r.Err());
  const def = r.Ok().settings.find(isUserSettingDefaultHandle);
  if (def === undefined) {
    return Result.Err("No defaultHandle — pass --handle, --vibe, or run 'vibes-diy login' first");
  }
  return Result.Ok(def.ownerHandle);
}

// Open a VibesDiyApi routed to the per-vibe AppSessions DO
// (`/api/app?vibe=<owner>--<app>`, skipShard) so db reads, writes, and
// subscriptions land on the same Durable Object the browser uses and
// participate in live doc-changed fan-out. Codegen (`generate`/`edit`)
// intentionally stays on the ChatSessions/random-shard route; only data ops
// belong here. Routing the data commands through `/api` (ChatSessions) was the
// #2343 bug — writes never fanned out and subscribers never received events.
//
// The owner handle is needed to build the `?vibe=` key, so it's resolved over a
// short-lived bootstrap connection on the original apiUrl first.
export async function openVibeDbApi(
  ectx: CliCtx,
  apiUrl: string,
  ownerHandleArg: string,
  appSlug: string
): Promise<Result<{ api: VibesDiyApi; ownerHandle: string }>> {
  if (ectx.vibesDiyApiFactory === undefined) {
    return Result.Err("Not logged in. Run 'vibes-diy login' first.");
  }
  let ownerHandle = ownerHandleArg;
  if (ownerHandle === "") {
    // Only a default-handle lookup needs a connection; do it on a short-lived
    // bootstrap on the original apiUrl, then close it.
    const bootstrapApi = ectx.vibesDiyApiFactory(apiUrl);
    try {
      const rUser = await resolveUserSlug(bootstrapApi, "");
      if (rUser.isErr()) return Result.Err(rUser.Err());
      ownerHandle = rUser.Ok();
    } finally {
      await bootstrapApi.close();
    }
  }
  // Keep the existing query params — notably `.stable-entry.=cli` — so the
  // selected backend is preserved. The CLI has no cookie fallback, so dropping
  // the stable-entry param would silently route the AppSessions WS to the
  // default/prod backend instead of the one the user/bootstrap targeted.
  const routedUrl = BuildURI.from(apiUrl).pathname("/api/app").setParam("vibe", `${ownerHandle}--${appSlug}`).toString();
  const api = ectx.vibesDiyApiFactory(routedUrl, { skipShard: true });
  return Result.Ok({ api, ownerHandle });
}
