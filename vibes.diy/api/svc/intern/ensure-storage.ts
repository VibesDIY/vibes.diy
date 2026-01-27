import { CoerceBinaryInput, Result, to_uint8, URI } from "@adviser/cement";
import { AssetStorage, StorageResult } from "../api.js";
import { eq } from "drizzle-orm";
import { VibesSqlite } from "../create-handler.js";
import { sqlAssets } from "../sql/vibes-diy-api-schema.js";
import { base58btc } from "multiformats/bases/base58";
import { sha256 } from "multiformats/hashes/sha2";
import { SuperThis } from "@fireproof/core-types-base";

export interface CalcCidResult {
  cid: string;
  data: Uint8Array;
  dataStr(): string;
}
export async function calcCid({ sthis }: { sthis: SuperThis }, content: CoerceBinaryInput): Promise<CalcCidResult> {
  const uint8Content = to_uint8(content);
  const hash = await sha256.digest(uint8Content);
  return {
    cid: base58btc.encode(hash.digest),
    data: uint8Content,
    dataStr: () => {
      if (typeof content === "string") {
        return content;
      } else {
        return sthis.txt.decode(uint8Content);
      }
    },
  };
}

// --- AssetProvider Architecture ---

export interface AssetProvider {
  type: string;
  canHandle(url: string): boolean; // provider decides if it owns this URL
  put(cid: string, data: ReadableStream<Uint8Array>): Promise<Result<string>>; // returns URL
  get(url: string): Promise<Result<ReadableStream<Uint8Array>>>; // provider parses its own URL
}

export class SqlAssetProvider implements AssetProvider {
  type = "sql";
  constructor(private db: VibesSqlite) {}

  canHandle(url: string): boolean {
    return url.startsWith("sql:");
  }

  async put(cid: string, data: ReadableStream<Uint8Array>): Promise<Result<string>> {
    const bytes = new Uint8Array(await new Response(data).arrayBuffer());
    await this.db
      .insert(sqlAssets)
      .values({ assetId: cid, content: bytes, created: new Date().toISOString() })
      .onConflictDoNothing()
      .run();
    return Result.Ok(`sql:?cid=${cid}`);
  }

  async get(url: string): Promise<Result<ReadableStream<Uint8Array>>> {
    const cid = URI.from(url).getParam("cid");
    if (!cid) return Result.Err(new Error(`Invalid URL: ${url}`));
    const a = await this.db.select().from(sqlAssets).where(eq(sqlAssets.assetId, cid)).get();
    if (!a) return Result.Err(new Error("Not found"));
    const body = new Response(a.content as BodyInit).body;
    return body ? Result.Ok(body) : Result.Err(new Error("Failed to create stream"));
  }
}

export interface R2If {
  put(cid: string, data: ReadableStream<Uint8Array>): Promise<Result<void>>;
  get(cid: string): Promise<Result<ReadableStream<Uint8Array>>>;
}

export class R2AssetProvider implements AssetProvider {
  type = "r2";
  constructor(private r2: R2If) {}

  canHandle(url: string): boolean {
    return url.startsWith("r2:");
  }

  async put(cid: string, data: ReadableStream<Uint8Array>): Promise<Result<string>> {
    const res = await this.r2.put(cid, data);
    return res.isErr() ? Result.Err(res.Err()) : Result.Ok(`r2:?cid=${cid}`);
  }

  async get(url: string): Promise<Result<ReadableStream<Uint8Array>>> {
    const cid = URI.from(url).getParam("cid");
    if (!cid) return Result.Err(new Error(`Invalid URL: ${url}`));
    return this.r2.get(cid);
  }
}

export const sizeBasedStrategy =
  (threshold = 4096) =>
  (providers: AssetProvider[], _cid: string, data: Uint8Array): AssetProvider =>
    data.byteLength > threshold ? (providers.find((p) => p.type === "r2") ?? providers[0]) : providers[0];

export function createAssetStorage(
  providers: AssetProvider[],
  selectProvider: (providers: AssetProvider[], cid: string, data: Uint8Array) => AssetProvider
): AssetStorage {
  return {
    async ensureAssets(...items): Promise<Result<StorageResult[]>> {
      const results: StorageResult[] = [];
      for (const item of items) {
        const provider = selectProvider(providers, item.cid, item.data);
        const body = new Response(item.data as BodyInit).body;
        if (!body) return Result.Err(new Error("Failed to create stream"));
        const rUrl = await provider.put(item.cid, body);
        if (rUrl.isErr()) return Result.Err(rUrl.Err());
        results.push({
          cid: item.cid,
          getURL: rUrl.unwrap(),
          mode: "existing",
          created: new Date(),
          size: item.data.byteLength,
        });
      }
      return Result.Ok(results);
    },

    async fetchAssets(...urls): Promise<Result<{ url: string; asset: Uint8Array }>[]> {
      return Promise.all(
        urls.map(async (url) => {
          const provider = providers.find((p) => p.canHandle(url));
          if (!provider) return Result.Err(new Error(`No provider for ${url}`));
          const rStream = await provider.get(url);
          if (rStream.isErr()) return Result.Err(rStream.Err());
          return Result.Ok({ url, asset: new Uint8Array(await new Response(rStream.unwrap()).arrayBuffer()) });
        })
      );
    },
  };
}
