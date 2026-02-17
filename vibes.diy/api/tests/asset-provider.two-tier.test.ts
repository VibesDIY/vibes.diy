import { BuildURI, Option, Result, URI } from "@adviser/cement";
import { describe, expect, it } from "vitest";
import { AssetProvider } from "@vibes.diy/api-svc/intern/asset-provider.js";
import { InMemoryTestBackend, stream2string, string2stream } from "./asset-provider.test-utils.js";

describe("AssetProvider two-tier", () => {
  it("prefers primary backend when both puts succeed", async () => {
    const small = new InMemoryTestBackend("small:");
    const big = new InMemoryTestBackend("big:");
    const ap = new AssetProvider([small, big]);

    const rPuts = await ap.puts([
      { stream: string2stream("smallString") },
      { stream: string2stream("longString.........") },
    ]);
    expect(rPuts.isOk()).toBe(true);
    const puts = rPuts.Ok();
    expect(puts).toHaveLength(2);
    expect(puts[0].isOk()).toBe(true);
    expect(puts[1].isOk()).toBe(true);

    const smallPut = puts[0].Ok();
    const bigPut = puts[1].Ok();
    expect(URI.from(smallPut.url).protocol).toBe("small:");
    expect(URI.from(bigPut.url).protocol).toBe("small:");

    const rGets = await ap.gets([smallPut.url, bigPut.url]);
    expect(rGets.isOk()).toBe(true);
    const gets = rGets.Ok();
    expect(gets).toHaveLength(2);
    expect(gets[0].isOk()).toBe(true);
    expect(gets[1].isOk()).toBe(true);

    const smallGet = gets[0].Ok().Unwrap();
    const bigGet = gets[1].Ok().Unwrap();
    expect(await stream2string(smallGet.stream)).toBe("smallString");
    expect(await stream2string(bigGet.stream)).toBe("longString.........");
  });

  it("uses overflow backend when primary put fails", async () => {
    class FailingPrimaryBackend {
      readonly protocol = "small:";

      async put(_stream: ReadableStream<Uint8Array>) {
        return Promise.resolve(Result.Err(new Error("primary put failed")));
      }

      async get(_url: string) {
        return Promise.resolve(Result.Ok(Option.None()));
      }
    }

    const primary = new FailingPrimaryBackend();
    const overflow = new InMemoryTestBackend("big:");
    const ap = new AssetProvider([primary, overflow]);

    const rPuts = await ap.puts([{ stream: string2stream("longString.........") }]);
    expect(rPuts.isOk()).toBe(true);
    const puts = rPuts.Ok();
    expect(puts[0].isOk()).toBe(true);
    expect(URI.from(puts[0].Ok().url).protocol).toBe("big:");
  });

  it("returns top-level errors when backend and overflow share protocol", async () => {
    const first = new InMemoryTestBackend("same:");
    const second = new InMemoryTestBackend("same:");
    const ap = new AssetProvider([first, second]);

    const rPuts = await ap.puts([{ stream: string2stream("smallString") }]);
    expect(rPuts.isErr()).toBe(true);

    const url = BuildURI.from("same://").setParam("cid", "missing").toString();
    const rGets = await ap.gets([url]);
    expect(rGets.isErr()).toBe(true);
  });

  it("returns top-level errors when backend protocol is missing ':'", async () => {
    const invalid = new InMemoryTestBackend("same");
    const ap = new AssetProvider([invalid]);

    const rPuts = await ap.puts([{ stream: string2stream("smallString") }]);
    expect(rPuts.isErr()).toBe(true);

    const url = BuildURI.from("same://").setParam("cid", "missing").toString();
    const rGets = await ap.gets([url]);
    expect(rGets.isErr()).toBe(true);
  });

  it("aggregates all backend put errors when every backend fails", async () => {
    class AlwaysFailBackend {
      readonly protocol: string;
      private readonly errorMessage: string;

      constructor(protocol: string, errorMessage: string) {
        this.protocol = protocol;
        this.errorMessage = errorMessage;
      }

      async put(_stream: ReadableStream<Uint8Array>) {
        return Promise.resolve(Result.Err(new Error(this.errorMessage)));
      }

      async get(_url: string) {
        return Promise.resolve(Result.Ok(Option.None()));
      }
    }

    const first = new AlwaysFailBackend("small:", "small failed");
    const second = new AlwaysFailBackend("big:", "big failed");
    const ap = new AssetProvider([first, second]);

    const rPuts = await ap.puts([{ stream: string2stream("payload") }]);
    expect(rPuts.isOk()).toBe(true);
    const putResult = rPuts.Ok()[0];
    expect(putResult.isErr()).toBe(true);
    const message = putResult.Err().message;
    expect(message).toContain("all backends failed");
    expect(message).toContain("protocol=small:");
    expect(message).toContain("small failed");
    expect(message).toContain("protocol=big:");
    expect(message).toContain("big failed");
  });
});
