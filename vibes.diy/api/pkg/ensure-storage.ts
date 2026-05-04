import { Result, Option, URI, teeWriter, processStream, Lazy, PeerStream, Peer, coerceStreamUint8 } from "@adviser/cement";
import type { EnsureCallOptions, StorageProgressFn, StorageResult, VibesAssetStorage, FetchResult } from "@vibes.diy/api-types";
import { sha256 } from "@noble/hashes/sha2.js";
import { base58btc } from "multiformats/bases/base58";

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

export interface PeerFetch {
  fetch(url: URI): Promise<Option<FetchResult>>;
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

export interface PeerFactoryOptions {
  readonly onProgress?: StorageProgressFn;
}

export interface StoragePeer {
  fetch: PeerFetch;
  factory: (cider: Cider, opts?: PeerFactoryOptions) => PeerWithCommit;
}

export interface EnsureStorageOptions {
  // Per-operation ceiling (ms) on any single peer op (begin/write/close/cancel).
  // A hung peer gets dropped instead of wedging the whole pipeline.
  // Resets per chunk: a healthy multi-MB upload gets a fresh window for each
  // write(), so total wall time is bounded by network throughput, not this.
  // 5s is ~10x R2's healthy median latency; well under Cloudflare's 30s CPU
  // ceiling so any genuine hang surfaces a clean error before the platform
  // terminates the worker.
  readonly peerTimeout?: number;
}

const DEFAULT_PEER_TIMEOUT_MS = 5000;

export function ensureStorage(...peers: StoragePeer[]): VibesAssetStorage;
export function ensureStorage(opts: EnsureStorageOptions, ...peers: StoragePeer[]): VibesAssetStorage;
export function ensureStorage(...args: [EnsureStorageOptions | StoragePeer, ...StoragePeer[]] | StoragePeer[]): VibesAssetStorage {
  const [first, ...rest] = args;
  const opts: EnsureStorageOptions = first && !("fetch" in first) ? (first as EnsureStorageOptions) : {};
  const peers: StoragePeer[] = first && !("fetch" in first) ? (rest as StoragePeer[]) : (args as StoragePeer[]);
  const peerTimeout = opts.peerTimeout ?? DEFAULT_PEER_TIMEOUT_MS;
  return {
    fetch: async (iurl: string): Promise<FetchResult> => {
      // const peers = [new SQLPeerFetch(flavour, db, assets), new S3PeerFetch(s3)];
      const url = URI.from(iurl);
      for (const peer of peers) {
        const res = await peer.fetch.fetch(url);
        if (res.IsSome()) {
          return res.unwrap();
        }
      }
      return {
        type: "fetch.notfound",
        url: url.toString(),
      };
    },
    ensure: (async (
      ...args: ReadableStream<Uint8Array | string>[] | [EnsureCallOptions, ...ReadableStream<Uint8Array | string>[]]
    ): Promise<Result<StorageResult>[]> => {
      const [firstArg, ...restArgs] = args;
      const isStream = (v: unknown): v is ReadableStream<Uint8Array | string> =>
        !!v && typeof (v as { getReader?: unknown }).getReader === "function";
      const firstIsOpts = firstArg !== undefined && !isStream(firstArg);
      const callOpts: EnsureCallOptions = firstIsOpts ? (firstArg as EnsureCallOptions) : {};
      const items: ReadableStream<Uint8Array | string>[] = firstIsOpts
        ? (restArgs as ReadableStream<Uint8Array | string>[])
        : (args as ReadableStream<Uint8Array | string>[]);
      const factoryOpts: PeerFactoryOptions = { onProgress: callOpts.onProgress };
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
            return teeWriter(
              peers.map((i) => i.factory(cider, factoryOpts)),
              lag2,
              { peerTimeout }
            ).then(async (rTee) => {
              if (rTee.isErr()) {
                return Result.Err(rTee);
              }
              return cider.getCID().then(({ cid, size }) => {
                const tok = rTee.Ok().peer as PeerStreamWithCommit;
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
    }) as VibesAssetStorage["ensure"],
  };
}
