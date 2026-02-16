import { BuildURI, exception2Result, Option, Result, URI } from "@adviser/cement";
import { inArray } from "drizzle-orm";
import type { VibesSqlite } from "../create-handler.js";
import { sqlAssets } from "../sql/vibes-diy-api-schema.js";

export interface AssetPutItem {
  cid: string;
  data: Uint8Array;
}

export interface AssetPutResult {
  url: string;
}

export type AssetGetContent = Uint8Array | ReadableStream<Uint8Array>;
export type AssetGetResult = Result<Option<AssetGetContent>>;

export type AssetPutItemResult = { ok: true; value: AssetPutResult } | { ok: false; error: Error };

export interface SuccessfulAssetPutRow<TInput> {
  input: TInput;
  result: Extract<AssetPutItemResult, { ok: true }>;
}

export function collectSuccessfulAssetPutRows<TInput>(
  inputs: readonly TInput[],
  putResults: readonly AssetPutItemResult[],
  getCid: (input: TInput) => string
): Result<SuccessfulAssetPutRow<TInput>[], Error> {
  if (putResults.length !== inputs.length) {
    return Result.Err(new Error(`Asset provider returned ${putResults.length} results for ${inputs.length} items`));
  }

  const failures: string[] = [];
  const rows: SuccessfulAssetPutRow<TInput>[] = [];
  for (let index = 0; index < inputs.length; index++) {
    const input = inputs[index];
    const result = putResults[index];
    if (input === undefined || result === undefined) {
      return Result.Err(new Error(`internal error: missing put input/result at index=${index}`));
    }
    if (result.ok === false) {
      failures.push(`${getCid(input)}(${result.error.message})`);
      continue;
    }
    rows.push({ input, result });
  }

  if (failures.length > 0) {
    return Result.Err(new Error(`Asset put failed for ${failures.length} item${failures.length > 1 ? "s" : ""}: ${failures.join(", ")}`));
  }

  return Result.Ok(rows);
}

export type AssetProviderFatalCode =
  | "MISCONFIGURED_BACKENDS"
  | "BACKEND_PUT_RESULT_COUNT_MISMATCH"
  | "BACKEND_GET_RESULT_COUNT_MISMATCH";

export interface AssetProviderFatalError extends Error {
  readonly type: "asset-provider-fatal";
  readonly code: AssetProviderFatalCode;
}

class AssetProviderFatal extends Error implements AssetProviderFatalError {
  readonly type = "asset-provider-fatal";
  readonly code: AssetProviderFatalCode;

  constructor(message: string, code: AssetProviderFatalCode) {
    super(message);
    this.name = "AssetProviderFatal";
    this.code = code;
  }
}

function makeAssetProviderFatalError(message: string, code: AssetProviderFatalCode): AssetProviderFatalError {
  return new AssetProviderFatal(message, code);
}

export interface AssetBackend {
  readonly protocol: string;
  puts(items: AssetPutItem[]): Promise<AssetPutItemResult[]>;
  gets(urls: string[]): Promise<AssetGetResult[]>;
  canGet(url: string): boolean;
}

export interface AssetSelector {
  select(backends: AssetBackend[], item: AssetPutItem): AssetBackend;
}

export interface AssetProvider {
  puts(items: AssetPutItem[]): Promise<Result<AssetPutItemResult[], AssetProviderFatalError>>;
  gets(urls: string[]): Promise<Result<AssetGetResult[], AssetProviderFatalError>>;
}

export interface R2BucketIf {
  put(key: string, value: Uint8Array): Promise<unknown>;
  get(
    key: string
  ): Promise<{ body: ReadableStream<Uint8Array> | null; arrayBuffer(): Promise<ArrayBuffer> } | null>;
}

export function createAssetProvider(backends: AssetBackend[], selector: AssetSelector): AssetProvider {
  return {
    async puts(items) {
      if (items.length === 0) return Result.Ok([]);
      if (backends.length === 0) {
        return Result.Err(makeAssetProviderFatalError("AssetProvider requires at least one backend", "MISCONFIGURED_BACKENDS"));
      }

      // Group items by backend while preserving original positional indexes.
      const byBackend = new Map<AssetBackend, { index: number; item: AssetPutItem }[]>();
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        const backend = selector.select(backends, item);
        const current = byBackend.get(backend);
        if (current !== undefined) {
          current.push({ index, item });
          continue;
        }
        byBackend.set(backend, [{ index, item }]);
      }

      const backendResults = await Promise.all(
        Array.from(byBackend.entries()).map(async ([backend, batch]) => {
          const results = await backend.puts(batch.map((entry) => entry.item));
          if (results.length !== batch.length) {
            return {
              ok: false as const,
              error: makeAssetProviderFatalError(
                `Backend protocol=${backend.protocol} returned ${results.length} put results for ${batch.length} input items`,
                "BACKEND_PUT_RESULT_COUNT_MISMATCH"
              ),
            };
          }
          return { ok: true as const, batch, results };
        })
      );
      const out: AssetPutItemResult[] = new Array(items.length);
      for (const backendResult of backendResults) {
        if (backendResult.ok === false) {
          return Result.Err(backendResult.error);
        }
        const { batch, results } = backendResult;
        for (let index = 0; index < batch.length; index++) {
          out[batch[index].index] = results[index];
        }
      }
      return Result.Ok(out);
    },

    async gets(urls) {
      if (urls.length === 0) return Result.Ok([]);
      if (backends.length === 0) {
        return Result.Err(makeAssetProviderFatalError("AssetProvider requires at least one backend", "MISCONFIGURED_BACKENDS"));
      }

      // Group URLs by backend while preserving original positional indexes.
      const byBackend = new Map<AssetBackend, { index: number; url: string }[]>();
      const out: AssetGetResult[] = urls.map(() => Result.Ok(Option.None()));
      for (let index = 0; index < urls.length; index++) {
        const url = urls[index];
        const backend = backends.find((b) => b.canGet(url));
        if (backend === undefined) {
          out[index] = Result.Err(new Error(`No backend configured to handle asset URL: ${url}`));
          continue;
        }
        const current = byBackend.get(backend);
        if (current !== undefined) {
          current.push({ index, url });
          continue;
        }
        byBackend.set(backend, [{ index, url }]);
      }

      const backendResults = await Promise.all(
        Array.from(byBackend.entries()).map(async ([backend, batch]) => {
          const results = await backend.gets(batch.map((entry) => entry.url));
          if (results.length !== batch.length) {
            return {
              ok: false as const,
              error: makeAssetProviderFatalError(
                `Backend protocol=${backend.protocol} returned ${results.length} get results for ${batch.length} input URLs`,
                "BACKEND_GET_RESULT_COUNT_MISMATCH"
              ),
            };
          }
          return { ok: true as const, batch, results };
        })
      );
      for (const backendResult of backendResults) {
        if (backendResult.ok === false) {
          return Result.Err(backendResult.error);
        }
        const { batch, results } = backendResult;
        for (let index = 0; index < batch.length; index++) {
          out[batch[index].index] = results[index];
        }
      }
      return Result.Ok(out);
    },
  };
}

export function buildAssetUrl(protocol: string, cid: string): string {
  return BuildURI.from(`${protocol}://`).setParam("cid", cid).toString();
}

export interface ParsedAssetUrl {
  protocol: string;
  cid: string | undefined;
}

export function parseAssetUrl(url: string): Option<ParsedAssetUrl> {
  const result = exception2Result(() => {
    const parsed = URI.from(url);
    const protocol = parsed.protocol.replace(/:$/, "");

    // Reject file: - indicates malformed URL (cement returns file: for URLs without ://)
    if (protocol === "file") return null;

    const cid = parsed.getParam("cid");
    return { protocol, cid };
  });

  if (result.isErr()) {
    return Option.None();
  }

  const value = result.Ok();
  if (value === null) {
    return Option.None();
  }

  return Option.Some(value);
}

export function createSqliteBackend(db: VibesSqlite): AssetBackend {
  return {
    protocol: "sql",
    async puts(items) {
      if (items.length === 0) return [];

      const created = new Date().toISOString();
      const r = await exception2Result(() =>
        db
          .insert(sqlAssets)
          .values(items.map((item) => ({ assetId: item.cid, content: item.data, created })))
          .onConflictDoNothing()
          .run()
      );

      if (r.isErr()) {
        // Batch failed - return error for all items
        return items.map(() => ({ ok: false, error: r.Err() }));
      }

      // All succeeded
      return items.map((item) => ({
        ok: true,
        value: { url: buildAssetUrl("sql", item.cid) },
      }));
    },

    canGet(url) {
      const parsed = parseAssetUrl(url);
      return parsed.IsSome() && parsed.unwrap().protocol === "sql";
    },

    async gets(urls) {
      if (urls.length === 0) return [];

      // Parse all URLs to extract CIDs
      const parsed = urls.map((url) => parseAssetUrl(url));
      const cids = parsed
        .map((p, idx) => (p.IsSome() ? { cid: p.unwrap().cid, index: idx } : null))
        .filter((item): item is { cid: string | undefined; index: number } => item !== null)
        .filter((item): item is { cid: string; index: number } => item.cid !== undefined);

      if (cids.length === 0) {
        return urls.map(() => Result.Ok(Option.None()));
      }

      // Single batch SELECT with WHERE IN
      const r = await exception2Result(() =>
        db
          .select()
          .from(sqlAssets)
          .where(inArray(sqlAssets.assetId, cids.map((c) => c.cid)))
          .all()
      );

      if (r.isErr()) {
        return urls.map(() => Result.Err(r.Err()));
      }

      // Map back to original order
      const assetMap = new Map(r.Ok().map((a) => [a.assetId, a]));
      return parsed.map((p) => {
        if (p.IsNone()) return Result.Ok(Option.None());
        const parsedUrl = p.unwrap();
        if (parsedUrl.cid === undefined) return Result.Ok(Option.None());
        const asset = assetMap.get(parsedUrl.cid);
        if (asset === undefined) return Result.Ok(Option.None());
        if (!(asset.content instanceof ArrayBuffer)) {
          return Result.Err(new Error(`Asset ${parsedUrl.cid} has invalid content type`));
        }
        return Result.Ok(Option.Some(new Uint8Array(asset.content)));
      });
    },
  };
}

export function createR2Backend(bucket: R2BucketIf): AssetBackend {
  return {
    protocol: "r2",
    async puts(items) {
      if (items.length === 0) return [];

      // R2 doesn't have batch API - use Promise.all for parallelism
      return Promise.all(
        items.map(async (item) => {
          const r = await exception2Result(() => bucket.put(item.cid, item.data));
          if (r.isErr()) {
            return { ok: false, error: r.Err() };
          }
          return { ok: true, value: { url: buildAssetUrl("r2", item.cid) } };
        })
      );
    },

    canGet(url) {
      const parsed = parseAssetUrl(url);
      return parsed.IsSome() && parsed.unwrap().protocol === "r2";
    },

    async gets(urls) {
      if (urls.length === 0) return [];

      const parsed = urls.map((url) => parseAssetUrl(url));

      // Parallel fetches
      return Promise.all(
        parsed.map(async (p) => {
          if (p.IsNone()) return Result.Ok(Option.None());
          const parsedUrl = p.unwrap();
          if (parsedUrl.cid === undefined) return Result.Ok(Option.None());
          const cid = parsedUrl.cid;

          const r = await exception2Result(() => bucket.get(cid));
          if (r.isErr()) {
            return Result.Err(r.Err());
          }

          const obj = r.Ok();
          if (obj === null || obj.body === null) return Result.Ok(Option.None());
          return Result.Ok(Option.Some(obj.body));
        })
      );
    },
  };
}

export function createFirstSelector(): AssetSelector {
  return {
    select(backends) {
      return backends[0];
    },
  };
}

export function createSizeSelector(threshold: number, allBackends: AssetBackend[]): AssetSelector {
  const largeBackend = allBackends.find((b) => b.protocol === "r2") ?? allBackends[0];
  const smallBackend = allBackends.find((b) => b.protocol === "sql") ?? allBackends[0];
  return {
    select(_backends, item) {
      return item.data.byteLength > threshold ? largeBackend : smallBackend;
    },
  };
}

export function parseAsSetup(
  asSetup: string,
  bindings: { db: VibesSqlite; r2Bucket?: R2BucketIf }
): Result<{ backends: AssetBackend[]; selector: AssetSelector }, Error> {
  const backends: AssetBackend[] = [];
  let sizeThreshold: number | undefined;
  for (const entry of asSetup.split(",").map((s) => s.trim()).filter(Boolean)) {
    const uriResult = exception2Result(() => URI.from(entry));
    if (uriResult.isErr()) {
      return Result.Err(new Error(`Invalid AS_SETUP entry "${entry}": ${uriResult.Err().message}`));
    }
    const uri = uriResult.Ok();
    switch (uri.protocol) {
      case "sqlite:":
        backends.push(createSqliteBackend(bindings.db));
        break;
      case "r2:":
        if (bindings.r2Bucket === undefined) {
          return Result.Err(new Error("AS_SETUP references r2: but no R2 bucket binding provided"));
        }
        backends.push(createR2Backend(bindings.r2Bucket));
        {
          const t = uri.getParam("threshold");
          if (t != null) {
            const n = Number(t);
            if (Number.isFinite(n) === false || Number.isInteger(n) === false || n < 0) {
              return Result.Err(new Error(`Invalid r2 threshold (expected non-negative integer bytes): ${t}`));
            }
            sizeThreshold = n;
          }
        }
        break;
      default:
        return Result.Err(new Error(`Unknown AS_SETUP backend protocol: ${uri.protocol}. Supported: sqlite:, r2:`));
    }
  }
  if (backends.length === 0) {
    return Result.Err(new Error("AS_SETUP produced no backends"));
  }
  const selector = sizeThreshold != null ? createSizeSelector(sizeThreshold, backends) : createFirstSelector();
  return Result.Ok({ backends, selector });
}

export function createAssetProviderFromEnv(
  db: VibesSqlite,
  env: Record<string, string>,
  r2Bucket?: R2BucketIf
): Result<AssetProvider, Error> {
  const asSetup = env.AS_SETUP;
  if (asSetup) {
    const result = parseAsSetup(asSetup, { db, r2Bucket });
    if (result.isErr()) {
      return Result.Err(result.Err());
    }
    const { backends, selector } = result.Ok();
    return Result.Ok(createAssetProvider(backends, selector));
  }
  return Result.Ok(createAssetProvider([createSqliteBackend(db)], createFirstSelector()));
}
