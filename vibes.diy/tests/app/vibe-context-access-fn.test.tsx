import React from "react";
import { describe, it, expect } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { VibeContextProvider, useVibeContext, VibeSandboxApi, bootstrapAccessFnSources, type Vibe } from "@vibes.diy/vibe-runtime";

function Probe({ onCtx }: { onCtx: (ctx: ReturnType<typeof useVibeContext>) => void }) {
  const ctx = useVibeContext();
  onCtx(ctx);
  return null;
}

describe("VibeContextProvider — accessFnSources cache", () => {
  it("exposes mountParams.accessFnBindings on the context", () => {
    let captured: Vibe | undefined;
    render(
      <VibeContextProvider
        mountParams={{
          usrEnv: {},
          accessFnBindings: [{ dbName: "*", accessFnCid: "bafy1" }],
        }}
      >
        <Probe onCtx={(c) => (captured = c)} />
      </VibeContextProvider>
    );
    expect(captured?.mountParams.accessFnBindings).toEqual([{ dbName: "*", accessFnCid: "bafy1" }]);
  });

  it("starts with an empty accessFnSources map", () => {
    let captured: Vibe | undefined;
    render(
      <VibeContextProvider
        mountParams={{
          usrEnv: {},
          accessFnBindings: [{ dbName: "*", accessFnCid: "bafy1" }],
        }}
      >
        <Probe onCtx={(c) => (captured = c)} />
      </VibeContextProvider>
    );
    expect(captured?.accessFnSources.size).toBe(0);
    expect(captured?.accessFnSources.has("bafy1")).toBe(false);
  });

  it("caches source string when vibe.evt.accessFnSource fires", async () => {
    let captured: Vibe | undefined;
    render(
      <VibeContextProvider
        mountParams={{
          usrEnv: {},
          accessFnBindings: [{ dbName: "*", accessFnCid: "bafy1" }],
        }}
      >
        <Probe onCtx={(c) => (captured = c)} />
      </VibeContextProvider>
    );

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "vibe.evt.accessFnSource",
          cid: "bafy1",
          source: "export function x(){}",
        },
      })
    );

    await waitFor(() => {
      expect(captured?.accessFnSources.get("bafy1")).toBe("export function x(){}");
    });
  });

  it("caches null source — null (resolved-unknown) is distinct from absent (pending)", async () => {
    let captured: Vibe | undefined;
    render(
      <VibeContextProvider
        mountParams={{
          usrEnv: {},
          accessFnBindings: [{ dbName: "*", accessFnCid: "bafy2" }],
        }}
      >
        <Probe onCtx={(c) => (captured = c)} />
      </VibeContextProvider>
    );

    // Before dispatch — CID is absent (pending).
    expect(captured?.accessFnSources.has("bafy2")).toBe(false);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "vibe.evt.accessFnSource",
          cid: "bafy2",
          source: null,
        },
      })
    );

    await waitFor(() => {
      // After dispatch — CID is present with null (resolved-unknown).
      expect(captured?.accessFnSources.has("bafy2")).toBe(true);
      expect(captured?.accessFnSources.get("bafy2")).toBeNull();
    });
  });

  // Must run last: it seeds the module-level baseline, which a freshly-mounted
  // provider reads. Sources already in the baseline at mount (or arriving in the
  // render→effect gap, resynced by the effect) must reach the context even
  // though no live event is dispatched to this provider.
  it("delivers a source already present in the module baseline at mount (no live event)", async () => {
    const posts: unknown[] = [];
    const listeners: ((e: MessageEvent) => void)[] = [];
    const api = new VibeSandboxApi({
      vibeApp: { appSlug: "myapp", ownerHandle: "alice", fsId: "fs1" },
      addEventListener: ((_t: string, h: (e: MessageEvent) => void) => listeners.push(h)) as typeof window.addEventListener,
      postMessage: ((msg: unknown) => posts.push(msg)) as typeof window.postMessage,
    });
    listeners.forEach((h) => h({ data: { type: "vibe.evt.runtime.ack" } } as MessageEvent));

    const bootstrapPromise = bootstrapAccessFnSources(api, [{ dbName: "*", accessFnCid: "baseline-cid-xyz" }]);
    await Promise.resolve();
    await Promise.resolve();
    const sentTid = (posts[0] as { tid: string }).tid;
    listeners.forEach((h) =>
      h({
        data: { type: "vibe.res.accessFnSource", tid: sentTid, cid: "baseline-cid-xyz", source: "export function base(){}" },
      } as MessageEvent)
    );
    await bootstrapPromise;

    // Now the baseline holds baseline-cid-xyz. A provider mounting afterward must
    // expose it without any vibe.evt.accessFnSource being dispatched to it.
    let captured: Vibe | undefined;
    render(
      <VibeContextProvider mountParams={{ usrEnv: {}, accessFnBindings: [{ dbName: "*", accessFnCid: "baseline-cid-xyz" }] }}>
        <Probe onCtx={(c) => (captured = c)} />
      </VibeContextProvider>
    );

    await waitFor(() => {
      expect(captured?.accessFnSources.get("baseline-cid-xyz")).toBe("export function base(){}");
    });
  });
});
