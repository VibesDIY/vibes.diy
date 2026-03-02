import { Result, URI, teeWriter, processStream, Lazy, PeerStream, Peer } from "@adviser/cement";
import { FetchResult, StorageResult, Storage } from "../types.js";
import { VibesSqlite } from "../create-handler.js";
import { SQLitePeer, SQLitePeerFetch } from "../peers/sql.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { CID } from "multiformats";
import { create as createDigest } from "multiformats/hashes/digest";

export interface CalcCidResult {
  cid: string;
  size: number;
}

export type PeerStreamWithCommit = PeerStream & {
  commit: (iname?: string) => Promise<{ url: string }>;
};

export interface PeerWithCommit extends Peer {
  begin: () => Promise<PeerStreamWithCommit>;
}

const SHA2_256 = 0x12;

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
      const cid = CID.create(1, 0x55, createDigest(SHA2_256, this.h.digest()));
      return {
        cid: cid.toString(),
        size: this.size,
      };
    });
  });
}

function coerceStreamUint8(stream: ReadableStream<Uint8Array | string>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      processStream(stream, (chunk) => {
        if (typeof chunk === "string") {
          controller.enqueue(encoder.encode(chunk));
        } else {
          controller.enqueue(chunk);
        }
      })
        .then(() => {
          controller.close();
        })
        .catch((err) => {
          controller.error(err);
        });
    },
  });
}

export function ensureStorage(db: VibesSqlite): Storage {
  return {
    fetch: async (iurl: string): Promise<FetchResult> => {
      const peers = [new SQLitePeerFetch(db)];
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
            const peers = [new SQLitePeer(db, cider)];
            const rTee = teeWriter(peers, lag2);
            return Promise.allSettled([rTee]).then(async ([rTee]) => {
              if (rTee.status === "rejected") {
                return Result.Err(new Error(`Failed to write to peer: ${rTee.reason}`));
              }
              return cider.getCID().then(({ cid, size }) => {
                const tok = rTee.value.Ok().peer as PeerStreamWithCommit;
                return tok.commit(cid).then((r) => {
                  return Result.Ok({
                    cid,
                    url: r.url,
                    size,
                  });
                });
              });
            });
          }
        )
      );
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
