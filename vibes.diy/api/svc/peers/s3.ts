import { Option, URI, Result, exception2Result } from "@adviser/cement";
import { Cider, PeerFetch, PeerStreamWithCommit, PeerWithCommit, StoragePeer } from "@vibes.diy/api-pkg";
import { FetchResult, S3Api } from "@vibes.diy/api-types";

const S3_PEER_PROTOCOL = "s3:";
const S3_PEER_HOST = "r2";

class S3PeerStream implements PeerStreamWithCommit {
  readonly owner: S3Peer;
  readonly tmpUrl: string;
  readonly writer: WritableStreamDefaultWriter<Uint8Array>;
  constructor(owner: S3Peer, tmpUrl: string, writer: WritableStreamDefaultWriter<Uint8Array>) {
    this.owner = owner;
    this.writer = writer;
    this.tmpUrl = tmpUrl;
  }

  write(chunk: Uint8Array): Promise<void> {
    return this.writer.write(chunk);
  }
  async cancel(): Promise<void> {
    return this.writer.abort();
  }
  async close(): Promise<void> {
    await this.writer.close();
    // Ensure the underlying R2 put resolves before commit/rename runs.
    await this.owner.s3.awaitPut?.(this.tmpUrl);
  }
  async commit(): Promise<Result<{ url: string }>> {
    const { cid: assetID } = await this.owner.cider.getCID();
    const url = `${S3_PEER_PROTOCOL}//${S3_PEER_HOST}/${assetID}`;
    const res = await this.owner.s3.rename(this.tmpUrl, url);
    if (res.isErr()) {
      return Result.Err(res);
    }
    return Result.Ok({ url });
  }
}

export class S3Peer implements PeerWithCommit {
  readonly s3: S3Api;
  readonly cider: Cider;
  constructor(s3: S3Api, cider: Cider) {
    this.s3 = s3;
    this.cider = cider;
  }
  async begin(): Promise<Result<PeerStreamWithCommit>> {
    const tmpUrl = `${S3_PEER_PROTOCOL}//${S3_PEER_HOST}/temp/${this.s3.genId()}.tmp`;
    const rWriter = await exception2Result(() => this.s3.put(tmpUrl).then((stream) => stream.getWriter()));
    if (rWriter.isErr()) {
      return Result.Err(rWriter.Err());
    }
    return Result.Ok(new S3PeerStream(this, tmpUrl, rWriter.Ok()));
  }
}

export class S3PeerFetch implements PeerFetch {
  readonly s3: S3Api;
  constructor(s3: S3Api) {
    this.s3 = s3;
  }
  async fetch(url: URI): Promise<Option<FetchResult>> {
    if (url.protocol !== S3_PEER_PROTOCOL) {
      return Promise.resolve(Option.None());
    }
    return Option.Some(await this.s3.get(url.toString()));
  }
}

export interface CreateS3PeerParams {
  s3: S3Api;
}

export function createS3Peer(params: CreateS3PeerParams): StoragePeer {
  return {
    fetch: new S3PeerFetch(params.s3),
    factory: (cider: Cider) => new S3Peer(params.s3, cider),
  };
}
