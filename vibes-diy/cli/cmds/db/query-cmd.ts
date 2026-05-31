import { command, flag, option, positional, string, number } from "cmd-ts";
import { type } from "arktype";
import { Result, Option, exception2Result } from "@adviser/cement";
import type { ValidateTriggerCtx, HandleTriggerCtx, EventoResultType, EventoHandler } from "@adviser/cement";
import { FireflyApiAdapter } from "@vibes.diy/api-impl";
import { isResQueryDocs } from "@vibes.diy/api-types";
// @ts-expect-error "charwise" has no types
import charwise from "charwise";
import type { CliCtx } from "../../cli-ctx.js";
import { cmdTsDefaultArgs } from "../../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../../cmd-evento.js";
import { dbCommonArgs, resolveUserSlug } from "./shared.js";

export const ReqDbQuery = type({
  type: "'vibes-diy.cli.db.query'",
  apiUrl: "string",
  appSlug: "string",
  ownerHandle: "string",
  dbName: "string",
  field: "string",
  key: "string",
  prefix: "string",
  range: "string",
  limit: "number",
  descending: "boolean",
});
export type ReqDbQuery = typeof ReqDbQuery.infer;
export function isReqDbQuery(obj: unknown): obj is ReqDbQuery {
  return !(ReqDbQuery(obj) instanceof type.errors);
}

export const ResDbQuery = type({
  type: "'vibes-diy.cli.db.query-res'",
  docs: type({ "[string]": "unknown" }).array(),
});
export type ResDbQuery = typeof ResDbQuery.infer;
export function isResDbQuery(obj: unknown): obj is ResDbQuery {
  return !(ResDbQuery(obj) instanceof type.errors);
}

export const dbQueryEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqDbQuery, ResDbQuery> = {
  hash: "vibes-diy.cli.db.query",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqDbQuery, ResDbQuery>) => {
    if (isReqDbQuery(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqDbQuery, ResDbQuery>): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    if (ectx.vibesDiyApiFactory === undefined) {
      return Result.Err("Not logged in. Run 'vibes-diy login' first.");
    }
    const api = ectx.vibesDiyApiFactory(ctx.validated.apiUrl);
    const rUser = await resolveUserSlug(api, ctx.validated.ownerHandle);
    if (rUser.isErr()) return Result.Err(rUser.Err());
    const adapter = new FireflyApiAdapter(api, ctx.validated.appSlug, { userHandle: rUser.Ok() });

    const r = await adapter.queryDocs(ctx.validated.dbName);
    if (r.isErr()) return Result.Err(r.Err());
    const res = r.Ok();
    if (!isResQueryDocs(res)) {
      return Result.Err(`Unexpected response: ${JSON.stringify(res)}`);
    }

    const field = ctx.validated.field;
    // Encode each doc's field value as a charwise string for correct
    // type-aware ordering (numeric keys sort numerically, arrays sort
    // lexicographically by element, etc). Mirrors FireflyDatabase.query.
    let rows = res.docs
      .filter((doc) => doc[field] !== undefined)
      .map((doc) => ({
        doc,
        encodedKey: charwise.encode(doc[field]) as string,
      }));

    // Apply --key filter (exact match on encoded key)
    if (ctx.validated.key !== "") {
      const rKey = await exception2Result(() => JSON.parse(ctx.validated.key) as unknown);
      if (rKey.isErr()) return Result.Err(`Invalid --key JSON: ${rKey.Err()}`);
      const encodedKey = charwise.encode(rKey.Ok()) as string;
      rows = rows.filter((r) => r.encodedKey === encodedKey);
    }

    // Apply --prefix filter. For array prefixes, charwise appends a trailing
    // "!" separator; strip it so [2024, 11] matches [2024, 11, 15]. Scalar
    // prefixes keep their full encoding intact.
    if (ctx.validated.prefix !== "") {
      const rPrefix = await exception2Result(() => JSON.parse(ctx.validated.prefix) as unknown);
      if (rPrefix.isErr()) return Result.Err(`Invalid --prefix JSON: ${rPrefix.Err()}`);
      const prefixVal = rPrefix.Ok();
      let encodedPrefix = charwise.encode(prefixVal) as string;
      if (Array.isArray(prefixVal) && encodedPrefix.endsWith("!")) {
        encodedPrefix = encodedPrefix.slice(0, -1);
      }
      rows = rows.filter((r) => r.encodedKey.startsWith(encodedPrefix));
    }

    // Apply --range [start, end] inclusive — charwise-encoded comparison
    if (ctx.validated.range !== "") {
      const rRange = await exception2Result(() => JSON.parse(ctx.validated.range) as [unknown, unknown]);
      if (rRange.isErr()) return Result.Err(`Invalid --range JSON: ${rRange.Err()}`);
      const [rangeStart, rangeEnd] = rRange.Ok();
      const encodedStart = charwise.encode(rangeStart) as string;
      const encodedEnd = charwise.encode(rangeEnd) as string;
      rows = rows.filter((r) => r.encodedKey >= encodedStart && r.encodedKey <= encodedEnd);
    }

    // Sort by charwise-encoded key (string compare on encoded form gives
    // type-correct order: numeric, lexicographic, structured).
    rows.sort((a, b) => (a.encodedKey < b.encodedKey ? -1 : a.encodedKey > b.encodedKey ? 1 : 0));
    if (ctx.validated.descending) {
      rows.reverse();
    }

    // Apply --limit
    if (ctx.validated.limit > 0) {
      rows = rows.slice(0, ctx.validated.limit);
    }

    const docs = rows.map((r) => r.doc);

    return sendMsg(ctx, {
      type: "vibes-diy.cli.db.query-res",
      docs,
    } satisfies ResDbQuery);
  },
};

export function dbQueryCmd(ctx: CliCtx) {
  return command({
    name: "query",
    description: "Query documents by field value with optional key/prefix/range/limit filters",
    args: {
      ...cmdTsDefaultArgs(ctx),
      ...dbCommonArgs(ctx),
      field: positional({
        type: string,
        displayName: "field",
        description: "Field name to index on",
      }),
      key: option({
        long: "key",
        description: "Exact key match (JSON value)",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      prefix: option({
        long: "prefix",
        description: "Prefix match (JSON value)",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      range: option({
        long: "range",
        description: "Range filter as JSON two-element array [start, end]",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      limit: option({
        long: "limit",
        description: "Maximum number of results (0 = no limit)",
        type: number,
        defaultValue: () => 0,
        defaultValueIsSerializable: true,
      }),
      descending: flag({
        long: "descending",
        description: "Return results in descending order",
      }),
    },
    handler: ctx.cliStream.enqueue((args) => ({
      type: "vibes-diy.cli.db.query",
      apiUrl: args.apiUrl,
      appSlug: args.appSlug,
      ownerHandle: args.ownerHandle,
      dbName: args.dbName,
      field: args.field,
      key: args.key,
      prefix: args.prefix,
      range: args.range,
      limit: args.limit,
      descending: args.descending,
    })),
  });
}
