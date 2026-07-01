import { describe, it, expect } from "vitest";
import {
  reqBroadcastEphemeral,
  isReqBroadcastEphemeral,
  evtDocEphemeral,
  isEvtDocEphemeral,
  evtDocEphemeralDrop,
  isEvtDocEphemeralDrop,
} from "@vibes.diy/api-types";
import { type } from "arktype";

describe("ephemeral wire types", () => {
  it("reqBroadcastEphemeral validates a well-formed request", () => {
    const ok = {
      type: "vibes.diy.req-broadcast-ephemeral",
      ownerHandle: "alice",
      appSlug: "app1",
      dbName: "default",
      docId: "cursor-alice",
      doc: { _id: "cursor-alice", type: "cursor", curX: 1, curY: 2 },
    };
    expect(reqBroadcastEphemeral(ok) instanceof type.errors).toBe(false);
    expect(isReqBroadcastEphemeral(ok)).toBe(true);
    expect(isReqBroadcastEphemeral({ type: "vibes.diy.req-broadcast-ephemeral" })).toBe(false);
  });

  it("evtDocEphemeral validates and carries originPeer + doc", () => {
    const ok = {
      type: "vibes.diy.evt-doc-ephemeral",
      ownerHandle: "alice",
      appSlug: "app1",
      dbName: "default",
      docId: "cursor-alice",
      originPeer: "conn-1",
      doc: { _id: "cursor-alice", type: "cursor", curX: 1 },
      channel: "notes",
    };
    expect(evtDocEphemeral(ok) instanceof type.errors).toBe(false);
    expect(isEvtDocEphemeral(ok)).toBe(true);
    // channel is optional
    const noChannel = { ...ok, channel: undefined };
    expect(isEvtDocEphemeral(noChannel)).toBe(true);
  });

  it("evtDocEphemeralDrop validates with only originPeer", () => {
    const ok = { type: "vibes.diy.evt-doc-ephemeral-drop", originPeer: "conn-1" };
    expect(evtDocEphemeralDrop(ok) instanceof type.errors).toBe(false);
    expect(isEvtDocEphemeralDrop(ok)).toBe(true);
    expect(isEvtDocEphemeralDrop({ type: "vibes.diy.evt-doc-ephemeral-drop" })).toBe(false);
  });
});
