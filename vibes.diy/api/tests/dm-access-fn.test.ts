import { describe, it, expect } from "vitest";
import { localInvokeAccessFn } from "../svc/cf-serve.js";
import { DM_BUILTIN_SOURCE, DM_BUILTIN_CID } from "../svc/public/dm-access-fn.js";
import { directChannelUserSlug } from "@vibes.diy/api-types";

// Exercises the built-in DM access function through the REAL QuickJS invoker
// (localInvokeAccessFn), so it doubles as the `ctx.ownerHandle` marshalling test
// (#2290): the fn can only derive the two participants from the channel slug it
// receives as ctx.ownerHandle.
describe("built-in DM access fn", () => {
  const ref = { module: null };
  const slug = directChannelUserSlug("alice", "bob"); // "_d.alice.bob"

  function invoke(params: { user: { userHandle: string; isOwner: boolean } | null; ownerHandle?: string }) {
    return localInvokeAccessFn(ref, {
      cid: DM_BUILTIN_CID,
      doc: { _id: "m1", body: "hi" },
      oldDoc: null,
      source: DM_BUILTIN_SOURCE,
      ...params,
    });
  }

  it("ctx.ownerHandle drives the channel + grants both participants", async () => {
    const res = await invoke({ user: { userHandle: "alice", isOwner: false }, ownerHandle: slug });
    expect(res).toEqual({
      channels: [slug],
      grant: { users: { alice: [slug], bob: [slug] } },
    });
  });

  it("works for the other participant too", async () => {
    const res = await invoke({ user: { userHandle: "bob", isOwner: false }, ownerHandle: slug });
    expect("forbidden" in res).toBe(false);
    expect((res as { channels: string[] }).channels).toEqual([slug]);
  });

  it("forbids a non-participant writer", async () => {
    const res = await invoke({ user: { userHandle: "mallory", isOwner: false }, ownerHandle: slug });
    expect(res).toEqual({ forbidden: "not a participant" });
  });

  it("forbids an anonymous writer", async () => {
    const res = await invoke({ user: null, ownerHandle: slug });
    expect(res).toEqual({ forbidden: "authentication required" });
  });

  it("forbids when ctx.ownerHandle is missing / not a DM slug", async () => {
    const res = await invoke({ user: { userHandle: "alice", isOwner: false }, ownerHandle: "not-a-dm" });
    expect(res).toEqual({ forbidden: "not a direct channel" });
  });

  it("never grants the app owner (isOwner is ignored for participation)", async () => {
    // An owner who is NOT a participant must still be forbidden — the owner
    // override boundary the old special case enforced by branch shape.
    const res = await invoke({ user: { userHandle: "carol", isOwner: true }, ownerHandle: slug });
    expect(res).toEqual({ forbidden: "not a participant" });
  });
});
