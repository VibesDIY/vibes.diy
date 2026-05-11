import { command, flag, option, positional, string, number } from "cmd-ts";
import { type } from "arktype";
import { Result, Option, exception2Result } from "@adviser/cement";
import type { ValidateTriggerCtx, HandleTriggerCtx, EventoResultType, EventoHandler } from "@adviser/cement";
import { FireflyApiAdapter } from "@vibes.diy/api-impl";
import { isResQueryDocs } from "@vibes.diy/api-types";
import type { CliCtx } from "../../cli-ctx.js";
import { cmdTsDefaultArgs } from "../../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../../cmd-evento.js";
import { dbCommonArgs, resolveUserSlug } from "./shared.js";

export const ReqDbQuery = type({
  type: "'vibes-diy.cli.db.query'",
  apiUrl: "string",
  appSlug: "string",
  userSlug: "string",
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
    const rUser = await resolveUserSlug(api, ctx.validated.userSlug);
    if (rUser.isErr()) return Result.Err(rUser.Err());
    const adapter = new FireflyApiAdapter(api, ctx.validated.appSlug, { userSlug: rUser.Ok() });

    const r = await adapter.queryDocs(ctx.validated.dbName);
    if (r.isErr()) return Result.Err(r.Err());
    const res = r.Ok();
    if (!isResQueryDocs(res)) {
      return Result.Err(`Unexpected response: ${JSON.stringify(res)}`);
    }

    const field = ctx.validated.field;
    // Filter docs that have the field set (field-name map fn)
    let docs = res.docs.filter((doc) => doc[field] !== undefined);

    // Apply --key filter
    if (ctx.validated.key !== "") {
      const rKey = await exception2Result(() => JSON.parse(ctx.validated.key) as unknown);
      if (rKey.isErr()) return Result.Err(`Invalid --key JSON: ${rKey.Err()}`);
      const keyVal = rKey.Ok();
      docs = docs.filter((doc) => {
        const dv = doc[field];
        return JSON.stringify(dv) === JSON.stringify(keyVal);
      });
    }

    // Apply --prefix filter (prefix match on string representation)
    if (ctx.validated.prefix !== "") {
      const rPrefix = await exception2Result(() => JSON.parse(ctx.validated.prefix) as unknown);
      if (rPrefix.isErr()) return Result.Err(`Invalid --prefix JSON: ${rPrefix.Err()}`);
      const prefixVal = rPrefix.Ok();
      const prefixStr = JSON.stringify(prefixVal);
      docs = docs.filter((doc) => {
        const dvStr = JSON.stringify(doc[field]);
        return dvStr !== undefined && dvStr.startsWith(prefixStr.slice(0, -1));
      });
    }

    // Apply --range filter [start, end] inclusive
    if (ctx.validated.range !== "") {
      const rRange = await exception2Result(() => JSON.parse(ctx.validated.range) as [unknown, unknown]);
      if (rRange.isErr()) return Result.Err(`Invalid --range JSON: ${rRange.Err()}`);
      const [rangeStart, rangeEnd] = rRange.Ok();
      const startStr = JSON.stringify(rangeStart);
      const endStr = JSON.stringify(rangeEnd);
      docs = docs.filter((doc) => {
        const dvStr = JSON.stringify(doc[field]);
        return dvStr !== undefined && dvStr >= startStr && dvStr <= endStr;
      });
    }

    // Sort by field value
    docs.sort((a, b) => {
      const av = JSON.stringify(a[field]);
      const bv = JSON.stringify(b[field]);
      return av < bv ? -1 : av > bv ? 1 : 0;
    });
    if (ctx.validated.descending) {
      docs.reverse();
    }

    // Apply --limit
    if (ctx.validated.limit > 0) {
      docs = docs.slice(0, ctx.validated.limit);
    }

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
      userSlug: args.userSlug,
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
