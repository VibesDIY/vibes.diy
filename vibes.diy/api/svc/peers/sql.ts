import { Option, URI, uint8array2stream, exception2Result, concatUint8 } from "@adviser/cement";
import { VibesSqlite } from "../create-handler.js";
import { sqlAssets } from "../sql/vibes-diy-api-schema.js";
import { eq } from "drizzle-orm";
import { FetchResult } from "../types.js";
import { Cider, PeerStreamWithCommit, PeerWithCommit } from "../intern/ensure-storage.js";

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
    return Promise.resolve();
  }
  async cancel(): Promise<void> {
    // do nothing
  }
  async close(): Promise<void> {
    // do nothing
  }
  async commit(): Promise<{ url: string }> {
    const now = new Date();
    const created = now.toISOString();
    const { cid: assetID } = await this.owner.cider.getCID();
    const res = await exception2Result(() =>
      this.owner.db
        .insert(sqlAssets)
        .values({
          assetId: assetID,
          content: concatUint8(...this.chunks),
          created,
        })
        .onConflictDoNothing()
        .run()
    );
    if (res.isErr()) {
      throw res.Err();
    }
    return {
      url: `${SQLITE_PEER_PROTOCOL}//Assets/${assetID}`,
    };
  }
}

export class SQLitePeer implements PeerWithCommit {
  readonly db: VibesSqlite;
  readonly cider: Cider;
  constructor(db: VibesSqlite, cider: Cider) {
    this.db = db;
    this.cider = cider;
  }
  begin(): Promise<PeerStreamWithCommit> {
    return Promise.resolve(new SQLitePeerStream(this));
  }
}

export class SQLitePeerFetch {
  readonly db: VibesSqlite;
  constructor(db: VibesSqlite) {
    this.db = db;
  }
  async fetch(url: URI): Promise<Option<FetchResult>> {
    if (!SQL_PEER_PROTOCOLS.includes(url.protocol)) {
      return Promise.resolve(Option.None());
    }
    // table name in sql
    const assetId = url.pathname.slice("Assets/".length);
    const rAsset = await exception2Result(() => this.db.select().from(sqlAssets).where(eq(sqlAssets.assetId, assetId)).get());
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
