import { Option, URI, uint8array2stream, exception2Result, concatUint8, Result } from "@adviser/cement";
import { eq } from "drizzle-orm/sql/expressions";
import { FetchResult } from "@vibes.diy/api-types";
import { DBFlavour, VibesApiTables, VibesSqlite } from "./tables.js";
import { Cider, PeerFetch, PeerStreamWithCommit, PeerWithCommit, StoragePeer } from "@vibes.diy/api-pkg";

// const SQLITE_PEER_PROTOCOL = "sqlite:";
// const SQL_PEER_PROTOCOLS = ["sql:", SQLITE_PEER_PROTOCOL];

class SQLPeerStream implements PeerStreamWithCommit {
  readonly owner: SQLPeer;
  readonly chunks: Uint8Array[] = [];
  constructor(owner: SQLPeer) {
    this.owner = owner;
  }

  write(chunk: Uint8Array): Promise<void> {
    this.chunks.push(chunk);
    if (this.chunks.reduce((acc, curr) => acc + curr.length, 0) > this.owner.cutoffSize) {
      return Promise.reject(new Error("SQLitePeerStream: max size exceeded (4KB)"));
    }
    return Promise.resolve();
  }
  async cancel(): Promise<void> {
    // do nothing
  }
  async close(): Promise<void> {
    // do nothing
  }
  async commit(): Promise<Result<{ url: string }>> {
    const now = new Date();
    const created = now.toISOString();
    const { cid: assetID } = await this.owner.cider.getCID();
    const res = await exception2Result(() =>
      this.owner.db
        .insert(this.owner.assets)
        .values({
          assetId: assetID,
          content: concatUint8(...this.chunks),
          created,
        })
        .onConflictDoNothing()
    );
    if (res.isErr()) {
      return Result.Err(res);
    }
    return Result.Ok({
      url: `${this.owner.flavour}://Assets/${assetID}`,
    });
  }
}

export class SQLPeer implements PeerWithCommit {
  readonly db: VibesSqlite;
  readonly assets: VibesApiTables["assets"];
  readonly cider: Cider;
  readonly cutoffSize: number;
  readonly flavour: DBFlavour;
  constructor(flavour: DBFlavour, db: VibesSqlite, assets: VibesApiTables["assets"], cider: Cider, cutoffSize: number) {
    this.flavour = flavour;
    this.db = db;
    this.assets = assets;
    this.cider = cider;
    this.cutoffSize = cutoffSize;
  }
  begin(): Promise<Result<PeerStreamWithCommit>> {
    // console.log("SQLitePeer begin called");
    return Promise.resolve(Result.Ok(new SQLPeerStream(this)));
  }
}

export class SQLPeerFetch implements PeerFetch {
  readonly db: VibesSqlite;
  readonly assets: VibesApiTables["assets"];
  readonly flavour: DBFlavour;
  constructor(flavour: DBFlavour, db: VibesSqlite, assets: VibesApiTables["assets"]) {
    this.flavour = flavour;
    this.db = db;
    this.assets = assets;
  }
  async fetch(url: URI): Promise<Option<FetchResult>> {
    let compatProtocol = url.protocol;
    if (compatProtocol === "sql:") {
      compatProtocol = this.flavour + ":";
    }
    if (compatProtocol !== `${this.flavour}:`) {
      return Promise.resolve(Option.None());
    }
    // table name in sql
    const assetId = url.pathname.slice("Assets/".length);
    const rAsset = await exception2Result(() =>
      this.db
        .select()
        .from(this.assets)
        .where(eq(this.assets.assetId, assetId))
        .limit(1)
        .then((r) => r[0])
    );
    if (rAsset.isErr()) {
      return Option.Some({
        type: "fetch.err",
        url: url.toString(),
        error: rAsset.Err(),
      });
    }
    const asset = rAsset.Ok();
    if (!asset) {
      return Option.Some({
        type: "fetch.notfound",
        url: url.toString(),
      });
    }
    return Option.Some({
      type: "fetch.ok",
      url: url.toString(),
      data: uint8array2stream(asset.content as Uint8Array),
    });
  }
}

export interface CreateSQLPeerParams {
  flavour: DBFlavour;
  db: VibesSqlite;
  assets: VibesApiTables["assets"];
}

export function createSQLPeer(params: CreateSQLPeerParams): StoragePeer {
  switch (params.flavour) {
    case "sqlite":
    case "pg":
      return {
        fetch: new SQLPeerFetch(params.flavour, params.db, params.assets),
        factory: (cider: Cider) => new SQLPeer(params.flavour, params.db, params.assets, cider, 10 * 1024 * 1024),
      };
    default:
      throw new Error(`Unsupported DB flavour: ${params.flavour}`);
  }
}
