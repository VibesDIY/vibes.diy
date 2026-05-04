import { Result, exception2Result } from "@adviser/cement";
import { and, eq } from "drizzle-orm/sql/expressions";
import { ActiveEntry, EvtIconGen, isActiveIcon, isActiveIconDescription, parseArrayWarning } from "@vibes.diy/api-types";
import { ensureLogger } from "@fireproof/core-runtime";
import { QueueCtx } from "./queue-ctx.js";
import { generateIcon } from "./intern/generate-icon.js";
import { storeIcon } from "./intern/store-icon.js";

const ICON_MODEL = "prodia/flux-2.klein.9b";
const ICON_FALLBACK_MODEL = "openai/gpt-5-image-mini";

interface IconLookup {
  readonly description: string | undefined;
  readonly headDescriptionAt: string | undefined;
}

async function lookupIconState(qctx: QueueCtx, userSlug: string, appSlug: string): Promise<Result<IconLookup | undefined>> {
  const { db, tables } = qctx.sql;
  const rRow = await exception2Result(() =>
    db
      .select({ settings: tables.appSettings.settings })
      .from(tables.appSettings)
      .where(and(eq(tables.appSettings.userSlug, userSlug), eq(tables.appSettings.appSlug, appSlug)))
      .limit(1)
      .then((r) => r[0])
  );
  if (rRow.isErr()) return Result.Err(rRow);
  const row = rRow.Ok();
  if (!row) return Result.Ok(undefined);
  const { filtered: entries, warning } = parseArrayWarning(row.settings ?? [], ActiveEntry);
  if (warning.length > 0) {
    ensureLogger(qctx.sthis, "lookupIconState").Warn().Any({ parseErrors: warning }).Msg("skip");
  }
  const descEntry = entries.find(isActiveIconDescription);
  const iconEntry = entries.find(isActiveIcon);
  const head = iconEntry?.versions.find((v) => v.cid === iconEntry.currentCid);
  return Result.Ok({
    description: descEntry?.description,
    headDescriptionAt: head?.descriptionAt,
  });
}

export async function processIconGenEvent(qctx: QueueCtx, evt: EvtIconGen): Promise<Result<void>> {
  const rLookup = await lookupIconState(qctx, evt.userSlug, evt.appSlug);
  if (rLookup.isErr()) return Result.Err(rLookup);
  const lookup = rLookup.Ok();
  if (!lookup) return Result.Ok(undefined);
  if (!lookup.description) return Result.Ok(undefined);
  if (evt.force !== true && lookup.headDescriptionAt === lookup.description) {
    return Result.Ok(undefined);
  }
  const env = qctx.params.vibes.env;
  const rGen = await generateIcon({
    description: lookup.description,
    model: ICON_MODEL,
    fallbackModel: ICON_FALLBACK_MODEL,
    llmUrl: env.LLM_BACKEND_URL,
    llmApiKey: env.LLM_BACKEND_API_KEY,
    prodiaToken: env.PRODIA_TOKEN,
  });
  if (rGen.isErr()) return Result.Err(rGen);
  const { bytes, mime, model } = rGen.Ok();
  console.log(`Icon generated for ${evt.userSlug}/${evt.appSlug} via ${model}: ${bytes.byteLength} bytes (${mime})`);
  const rStore = await storeIcon(qctx, {
    userSlug: evt.userSlug,
    appSlug: evt.appSlug,
    bytes,
    mime,
    description: lookup.description,
  });
  if (rStore.isErr()) return Result.Err(rStore);
  return Result.Ok(undefined);
}
