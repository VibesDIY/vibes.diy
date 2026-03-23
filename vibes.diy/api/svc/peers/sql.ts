import { Option, URI, uint8array2stream, exception2Result, concatUint8, Result } from "@adviser/cement";
import { VibesSqlite } from "../create-handler.js";
import type { VibesApiTables } from "../types.js";
import { eq } from "drizzle-orm/sql/expressions";
import { Cider, PeerStreamWithCommit, PeerWithCommit } from "../intern/ensure-storage.js";
import { FetchResult } from "@vibes.diy/api-types";

const SQLITE_PEER_PROTOCOL = "sqlite:";
const SQL_PEER_PROTOCOLS = ["sql:", SQLITE_PEER_PROTOCOL];

class SQLitePeerStream implements PeerStreamWithCommit {
  readonly owner: SQLitePeer;
  readonly chunks: Uint8Array[] = [];
  constructor(owner: SQLitePeer) {
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
      url: `${SQLITE_PEER_PROTOCOL}//Assets/${assetID}`,
    });
  }
}

export class SQLitePeer implements PeerWithCommit {
  readonly db: VibesSqlite;
  readonly assets: VibesApiTables["assets"];
  readonly cider: Cider;
  readonly cutoffSize: number;
  constructor(db: VibesSqlite, assets: VibesApiTables["assets"], cider: Cider, cutoffSize: number) {
    this.db = db;
    this.assets = assets;
    this.cider = cider;
    this.cutoffSize = cutoffSize;
  }
  begin(): Promise<Result<PeerStreamWithCommit>> {
    // console.log("SQLitePeer begin called");
    return Promise.resolve(Result.Ok(new SQLitePeerStream(this)));
  }
}

export class SQLitePeerFetch {
  readonly db: VibesSqlite;
  readonly assets: VibesApiTables["assets"];
  constructor(db: VibesSqlite, assets: VibesApiTables["assets"]) {
    this.db = db;
    this.assets = assets;
  }
  async fetch(url: URI): Promise<Option<FetchResult>> {
    if (!SQL_PEER_PROTOCOLS.includes(url.protocol)) {
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
