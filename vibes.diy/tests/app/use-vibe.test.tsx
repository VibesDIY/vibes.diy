import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import {
  VibeContextProvider,
  useVibe,
  setGraceMsForTest,
  __resetGraceForTest,
  __resetRegisteredAccessFnSourcesForTests,
} from "@vibes.diy/vibe-runtime";

// Membership-only access fn: requires channel "team", readable on ["team"].
const TEAM_SRC = `export function aestheticBoard(doc, oldDoc, user, ctx) {
  ctx.requireAccess("team");
  return { channels: ["team"] };
}`;

const CID = "cid-team";

// Sources reach VibeContext via vibe.evt.accessFnSource events (slice 2c). The
// type has no Base/tid: { type, cid, source }. Dispatch AFTER render so the
// provider's message listener is attached; waitFor() absorbs the state update.
function seedSource(cid: string, source: string | null) {
  window.dispatchEvent(
    new MessageEvent("message", { data: { type: "vibe.evt.accessFnSource", cid, source } })
  );
}

function Probe({ dbName, onResult }: { dbName: string; onResult: (r: ReturnType<typeof useVibe>) => void }) {
  const r = useVibe(dbName);
  onResult(r);
  return null;
}

function mount(viewerEnv: unknown, bindings?: { dbName: string; accessFnCid: string }[]) {
  let last: ReturnType<typeof useVibe> | undefined;
  render(
    <VibeContextProvider
      mountParams={{ usrEnv: {}, viewerEnv: viewerEnv as never, accessFnBindings: bindings }}
    >
      <Probe dbName="aestheticBoard" onResult={(r) => (last = r)} />
    </VibeContextProvider>
  );
  return () => last!;
}

beforeEach(() => {
  __resetGraceForTest();
  __resetRegisteredAccessFnSourcesForTests();
});
afterEach(() => __resetGraceForTest());

describe("useVibe", () => {
  it("owner+member → can.create allowed", async () => {
    const get = mount(
      { viewer: { userHandle: "owner" }, access: "override", isOwner: true, grants: { aestheticBoard: { channels: ["team"], publicChannels: [], roles: [] } } },
      [{ dbName: "aestheticBoard", accessFnCid: CID }]
    );
    seedSource(CID, TEAM_SRC);
    await waitFor(() => expect(get().ready).toBe(true));
    expect(get().me?.userHandle).toBe("owner");
    expect(get().me?.isOwner).toBe(true);
    expect(get().can.create({ type: "tile" })).toEqual({ ok: true });
  });

  it("anonymous → can.create denied with reason (garden-gnome case)", async () => {
    const get = mount({ viewer: null, access: "none" }, [{ dbName: "aestheticBoard", accessFnCid: CID }]);
    seedSource(CID, TEAM_SRC);
    await waitFor(() => expect(get().ready).toBe(true));
    expect(get().me).toBeNull();
    expect(get().can.create({ type: "tile" })).toEqual({ ok: false, reason: "authentication required" });
  });

  it("non-member signed-in → denied with channel reason", async () => {
    const get = mount(
      { viewer: { userHandle: "bob" }, access: "viewer", grants: { aestheticBoard: { channels: [], publicChannels: [], roles: [] } } },
      [{ dbName: "aestheticBoard", accessFnCid: CID }]
    );
    seedSource(CID, TEAM_SRC);
    await waitFor(() => expect(get().ready).toBe(true));
    const v = get().can.create({ type: "tile" });
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("team");
  });

  it("adminMode bypasses the gate for a non-member owner", async () => {
    const get = mount(
      { viewer: { userHandle: "owner" }, access: "override", isOwner: true, adminMode: true, grants: { aestheticBoard: { channels: [], publicChannels: [], roles: [] } } },
      [{ dbName: "aestheticBoard", accessFnCid: CID }]
    );
    seedSource(CID, TEAM_SRC);
    await waitFor(() => expect(get().ready).toBe(true));
    expect(get().can.create({ type: "tile" })).toEqual({ ok: true });
  });

  it("resolved-unknown (source null) → ready + optimistic", async () => {
    const get = mount({ viewer: { userHandle: "x" }, access: "viewer" }, [{ dbName: "aestheticBoard", accessFnCid: CID }]);
    seedSource(CID, null);
    await waitFor(() => expect(get().ready).toBe(true));
    expect(get().can.create({ type: "tile" })).toEqual({ ok: true });
  });

  it("no binding for dbName → ready + optimistic", async () => {
    const get = mount({ viewer: { userHandle: "x" }, access: "viewer" }, []);
    await waitFor(() => expect(get().ready).toBe(true));
    expect(get().can.edit({ _id: "1" })).toEqual({ ok: true });
  });

  it("pending source → not ready, then grace-degrades to interactive", async () => {
    setGraceMsForTest(20);
    // Never seed cid-never → it stays absent in accessFnSources (pending).
    const get = mount({ viewer: { userHandle: "x" }, access: "viewer" }, [{ dbName: "aestheticBoard", accessFnCid: "cid-never" }]);
    expect(get().ready).toBe(false);
    expect(get().can.create({ type: "tile" })).toEqual({ ok: false, reason: "pending" });
    await waitFor(() => expect(get().ready).toBe(true), { timeout: 500 });
    expect(get().can.create({ type: "tile" })).toEqual({ ok: true });
  });

  it("two hooks on the same db flip to interactive together (shared grace)", async () => {
    setGraceMsForTest(20);
    let a: ReturnType<typeof useVibe> | undefined;
    let b: ReturnType<typeof useVibe> | undefined;
    render(
      <VibeContextProvider
        mountParams={{
          usrEnv: {},
          viewerEnv: { viewer: { userHandle: "x" }, access: "viewer" },
          accessFnBindings: [{ dbName: "aestheticBoard", accessFnCid: "cid-shared-never" }],
        }}
      >
        <Probe dbName="aestheticBoard" onResult={(r) => (a = r)} />
        <Probe dbName="aestheticBoard" onResult={(r) => (b = r)} />
      </VibeContextProvider>
    );
    expect(a!.ready).toBe(false);
    expect(b!.ready).toBe(false);
    await waitFor(
      () => {
        expect(a!.ready).toBe(true);
        expect(b!.ready).toBe(true);
      },
      { timeout: 500 }
    );
  });

  it("adminMode flip via viewerChanged flips can.* without remount", async () => {
    const get = mount(
      { viewer: { userHandle: "owner" }, access: "override", isOwner: true, grants: { aestheticBoard: { channels: [], publicChannels: [], roles: [] } } },
      [{ dbName: "aestheticBoard", accessFnCid: CID }]
    );
    seedSource(CID, TEAM_SRC);
    await waitFor(() => expect(get().ready).toBe(true));
    expect(get().can.create({ type: "tile" }).ok).toBe(false); // non-member, not admin

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "vibe.evt.viewerChanged",
          viewer: { userHandle: "owner" },
          access: "override",
          isOwner: true,
          adminMode: true,
          grants: { aestheticBoard: { channels: [], publicChannels: [], roles: [] } },
        },
      })
    );

    await waitFor(() => expect(get().can.create({ type: "tile" })).toEqual({ ok: true }));
  });
});
