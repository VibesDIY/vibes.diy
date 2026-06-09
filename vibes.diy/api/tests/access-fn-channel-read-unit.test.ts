import { describe, expect, it } from "vitest";
import { filterDocsByChannel } from "../svc/public/channel-read-filter.js";

const mkOutput = (docId: string, output: Record<string, unknown>) => ({
  docId,
  output: JSON.stringify(output),
});

describe("filterDocsByChannel (unit)", () => {
  it("returns all docs when no access fn outputs exist (empty outputs array)", () => {
    const docs = [
      { _id: "d1", title: "hello" },
      { _id: "d2", title: "world" },
    ];
    const result = filterDocsByChannel(docs, [], null, new Set(), new Set());
    expect(result).toEqual(docs);
  });

  it("filters docs to user's effective channels", () => {
    const docs = [
      { _id: "d1", title: "in-channel" },
      { _id: "d2", title: "not-in-channel" },
    ];
    const outputs = [mkOutput("d1", { channels: ["general"] }), mkOutput("d2", { channels: ["secret"] })];
    const effectiveChannels = new Set(["general"]);
    const publicChannels = new Set<string>();
    const result = filterDocsByChannel(docs, outputs, "user-a", effectiveChannels, publicChannels);
    expect(result.length).toBe(1);
    expect(result[0]?._id).toBe("d1");
  });

  it("includes docs in public channels for anonymous users", () => {
    const docs = [
      { _id: "d1", title: "public-doc" },
      { _id: "d2", title: "private-doc" },
    ];
    const outputs = [mkOutput("d1", { channels: ["announcements"] }), mkOutput("d2", { channels: ["secret"] })];
    const effectiveChannels = new Set<string>();
    const publicChannels = new Set(["announcements"]);
    const result = filterDocsByChannel(docs, outputs, null, effectiveChannels, publicChannels);
    expect(result.length).toBe(1);
    expect(result[0]?._id).toBe("d1");
  });

  it("excludes docs with no channels in output", () => {
    const docs = [
      { _id: "d1", title: "has-channel" },
      { _id: "d2", title: "no-channel" },
    ];
    const outputs = [mkOutput("d1", { channels: ["general"] }), mkOutput("d2", { allowAnonymous: true })];
    const effectiveChannels = new Set(["general"]);
    const result = filterDocsByChannel(docs, outputs, "user-a", effectiveChannels, new Set());
    expect(result.length).toBe(1);
    expect(result[0]?._id).toBe("d1");
  });

  it("excludes docs with no stored output", () => {
    const docs = [
      { _id: "d1", title: "has-output" },
      { _id: "d2", title: "no-output" },
    ];
    const outputs = [mkOutput("d1", { channels: ["general"] })];
    const effectiveChannels = new Set(["general"]);
    const result = filterDocsByChannel(docs, outputs, "user-a", effectiveChannels, new Set());
    expect(result.length).toBe(1);
    expect(result[0]?._id).toBe("d1");
  });

  it("doc in multiple channels passes if user has any one", () => {
    const docs = [{ _id: "d1", title: "multi-channel" }];
    const outputs = [mkOutput("d1", { channels: ["alpha", "beta"] })];
    const effectiveChannels = new Set(["beta"]);
    const result = filterDocsByChannel(docs, outputs, "user-a", effectiveChannels, new Set());
    expect(result.length).toBe(1);
  });

  it("returns all docs unfiltered when adminOverride is true", () => {
    const docs = [
      { _id: "d1", title: "in-channel" },
      { _id: "d2", title: "secret-channel" },
    ];
    const outputs = [mkOutput("d1", { channels: ["general"] }), mkOutput("d2", { channels: ["secret"] })];
    const effectiveChannels = new Set(["general"]); // user only in "general"
    const result = filterDocsByChannel(docs, outputs, "user-a", effectiveChannels, new Set(), true);
    expect(result).toEqual(docs); // both returned despite "secret" not in effectiveChannels
  });
});
