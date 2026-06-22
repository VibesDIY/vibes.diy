import React from "react";
import { describe, it, expect } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { VibeContextProvider, useVibeContext, type Vibe } from "@vibes.diy/vibe-runtime";

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
});
