import { Result, URI, teeWriter, processStream, Lazy, PeerStream, Peer, coerceStreamUint8 } from "@adviser/cement";
import { StorageResult, Storage } from "../types.js";
import { VibesSqlite } from "../create-handler.js";
import { SQLitePeer, SQLitePeerFetch } from "../peers/sql.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { base58btc } from "multiformats/bases/base58";
import { S3PeerFetch } from "../peers/s3.js";
import { FetchResult, S3Api } from "@vibes.diy/api-types";

export interface CalcCidResult {
  cid: string;
  size: number;
}

export type PeerStreamWithCommit = PeerStream & {
  commit: (iname?: string) => Promise<Result<{ url: string }>>;
};

export interface PeerWithCommit extends Peer {
  begin: () => Promise<Result<PeerStreamWithCommit>>;
}

// const SHA2_256 = 0x12;

export class Cider {
  readonly h: ReturnType<typeof sha256.create>;
  size = 0;
  readonly processStreamPromise: Promise<void>;
  constructor(inStream: ReadableStream<Uint8Array>) {
    this.h = sha256.create();
    this.processStreamPromise = processStream(inStream, (chunk) => {
      this.h.update(chunk);
      this.size += chunk.length;
    });
  }

  readonly getCID = Lazy((): Promise<CalcCidResult> => {
    return this.processStreamPromise.then(() => {
      const cid = base58btc.encode(this.h.digest());
      // const cid = CID.create(1, 0x55, createDigest(SHA2_256, this.h.digest()));
      return {
        cid,
        size: this.size,
      };
    });
  });
}

export function ensureStorage(db: VibesSqlite, s3: S3Api): Storage {
  return {
    fetch: async (iurl: string): Promise<FetchResult> => {
      const peers = [new SQLitePeerFetch(db), new S3PeerFetch(s3)];
      const url = URI.from(iurl);
      for (const peer of peers) {
        const res = await peer.fetch(url);
        if (res.IsSome()) {
          return res.unwrap();
        }
      }
      return {
        type: "fetch.notfound",
        url: url.toString(),
      };
    },
    ensure: async (...items: ReadableStream<Uint8Array | string>[]): Promise<Result<StorageResult>[]> => {
      // console.log("Ensuring storage for items, count:", items.length);
      const tees = await Promise.allSettled(
        items.map(
          (
            item
          ): Promise<
            Result<{
              cid: string;
              url: string;
              size: number;
            }>
          > => {
            const [lag1, lag2] = coerceStreamUint8(item).tee();
            const cider = new Cider(lag1);
            console.log("Created Cider for item, waiting for teeWriter...");
            const peers = [new SQLitePeer(db, cider, 2^24)/* , new S3Peer(s3, cider) */];
            const rTee = teeWriter(peers, lag2);
            return Promise.allSettled([rTee]).then(async ([rTee]) => {
              if (rTee.status === "rejected") {
                return Result.Err(new Error(`Failed to write to peer: ${rTee.reason}`));
              }
              return cider.getCID().then(({ cid, size }) => {
                const tok = rTee.value.Ok().peer as PeerStreamWithCommit;
                return tok.commit(cid).then((r) => {
                  if (r.isErr()) {
                    return Result.Err(r);
                  }
                  return Result.Ok({
                    cid,
                    url: r.Ok().url,
                    size,
                  });
                });
              });
            });
          }
        )
      );
      // console.log("Ensuring storage for tee:", tees.length);
      return tees.map((res) => {
        if (res.status !== "fulfilled") {
          return Result.Err(new Error(`Failed to process item: ${res.reason}`));
        }
        if (res.value.isErr()) {
          return Result.Err(new Error(`Failed to write to peer: ${res.value.Err()}`));
        }
        const { cid, url, size } = res.value.Ok();
        return Result.Ok({
          cid,
          getURL: url,
          mode: "created",
          created: new Date(),
          size,
        });
      });
    },
  };
}
