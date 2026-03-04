import { Option, URI, Result } from "@adviser/cement";
import { Cider, PeerStreamWithCommit, PeerWithCommit } from "../intern/ensure-storage.js";
import { FetchResult, S3Api } from "@vibes.diy/api-types";

const S3_PEER_PROTOCOL = "s3:";

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
    console.log("S3PeerStream write called, chunk size:", chunk.length);
    return this.writer.write(chunk);
  }
  async cancel(): Promise<void> {
    console.log("S3PeerStream cancel called");
    return this.writer.abort();
  }
  async close(): Promise<void> {
    console.log("S3PeerStream close called");
    return this.writer.close();
  }
  async commit(): Promise<Result<{ url: string }>> {
    const { cid: assetID } = await this.owner.cider.getCID();
    const url = `${S3_PEER_PROTOCOL}://-/${assetID}`;
    const res = await this.owner.s3.rename(this.tmpUrl, url); // rename temp file to final location
    console.log("S3PeerStream commit called, rename result:", assetID, res);
    if (res.isErr()) {
      return Result.Err(res);
    }
    console.log("S3PeerStream commit result:", url);
    return Result.Ok({
      url,
    });
  }
}

export class S3Peer implements PeerWithCommit {
  readonly s3: S3Api;
  readonly cider: Cider;
  constructor(s3: S3Api, cider: Cider) {
    console.log("S3Peer constructor called");
    this.s3 = s3;
    this.cider = cider;
  }
  async begin(): Promise<Result<PeerStreamWithCommit>> {
    console.log("S3Peer begin called, generated tmpUrl pre genId:");
    const tmpUrl = `s3://temp/${this.s3.genId()}.tmp`;
    console.log("S3Peer begin called, generated tmpUrl:", tmpUrl);
    const writer = await this.s3.put(tmpUrl).then((stream) => stream.getWriter());
    return Result.Ok(new S3PeerStream(this, tmpUrl, writer));
  }
}

export class S3PeerFetch {
  readonly s3: S3Api;
  constructor(s3: S3Api) {
    this.s3 = s3;
  }
  async fetch(url: URI): Promise<Option<FetchResult>> {
    if (url.protocol !== S3_PEER_PROTOCOL) {
      return Promise.resolve(Option.None());
    }
    // table name in sql
    const assetId = url.pathname.slice("-/".length);
    return Option.Some(await this.s3.get(assetId));
  }
}
