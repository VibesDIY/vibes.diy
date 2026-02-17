import { describe, expect, it } from "vitest";
import { AssetProvider } from "@vibes.diy/api-svc/intern/asset-provider.js";
import { InMemoryTestBackend, stream2string, string2stream } from "./asset-provider.test-utils.js";

describe("AssetProvider bad-url handling", () => {
  it("returns per-item error for invalid URL without failing the batch", async () => {
    const backend = new InMemoryTestBackend("small:");
    const ap = new AssetProvider([backend]);

    const rPuts = await ap.puts([{ stream: string2stream("hello") }]);
    expect(rPuts.isOk()).toBe(true);
    const goodUrl = rPuts.Ok()[0].Ok().url;

    const rGets = await ap.gets([goodUrl, "not a valid url"]);
    expect(rGets.isOk()).toBe(true);
    const gets = rGets.Ok();
    expect(gets[0].isOk()).toBe(true);
    expect(gets[1].isErr()).toBe(true);

    const got = gets[0].Ok().Unwrap();
    expect(await stream2string(got.stream)).toBe("hello");
  });
});
