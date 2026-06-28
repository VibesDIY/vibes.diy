import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useShareModal } from "~/vibes.diy/app/components/ResultPreview/useShareModal.js";
import type { VibesDiyApiIface } from "@vibes.diy/api-types";

// Minimal Result-like helpers matching the shape useShareModal consumes.
const ok = <T,>(val: T) => Promise.resolve({ isOk: () => true, isErr: () => false, Ok: () => val });
const err = (message: string) => Promise.resolve({ isOk: () => false, isErr: () => true, Err: () => ({ message }) });

function makeApi(opts: { publicAccess?: boolean; ensureAppSettings?: ReturnType<typeof vi.fn> }): {
  api: VibesDiyApiIface;
  ensureAppSettings: ReturnType<typeof vi.fn>;
} {
  // getAppByFsId: a non-production app keeps the publish/embed branches quiet.
  const getAppByFsId = vi.fn(() => ok({ mode: "draft", fsId: undefined }));
  const ensureAppSettings =
    opts.ensureAppSettings ?? vi.fn(() => ok({ settings: { entry: { publicAccess: { enable: opts.publicAccess ?? false } } } }));
  const api = { getAppByFsId, ensureAppSettings } as unknown as VibesDiyApiIface;
  return { api, ensureAppSettings };
}

const baseParams = (api: VibesDiyApiIface) => ({
  ownerHandle: "meghan",
  appSlug: "bloom",
  fsId: "fs1",
  chatApi: {} as unknown as VibesDiyApiIface,
  sharedApi: api,
  hostnameBase: "vibes.diy",
});

beforeEach(() => {
  globalThis.document.body.innerHTML = "";
});

describe("useShareModal — public-access toggle (#2680/#2679)", () => {
  it("loads publicAccessEnabled when the Share view is active, without opening the modal", async () => {
    const { api } = makeApi({ publicAccess: true });
    const { result } = renderHook(() => useShareModal({ ...baseParams(api), shareViewActive: true }));

    await waitFor(() => expect(result.current.settingsLoaded).toBe(true));
    expect(result.current.publicAccessEnabled).toBe(true);
    expect(result.current.isOpen).toBe(false); // never opened the legacy modal
  });

  it("does NOT load settings when neither modal nor share view is active", async () => {
    const { ensureAppSettings, api } = makeApi({ publicAccess: true });
    renderHook(() => useShareModal({ ...baseParams(api) }));
    // Give effects a tick; the eager mount effect only calls getAppByFsId, never settings.
    await new Promise((r) => setTimeout(r, 20));
    expect(ensureAppSettings).not.toHaveBeenCalled();
  });

  it("persists the chosen access and optimistically updates", async () => {
    const ensureAppSettings = vi
      .fn()
      .mockReturnValueOnce(ok({ settings: { entry: { publicAccess: { enable: true } } } })) // initial load
      .mockReturnValue(ok({ settings: { entry: { publicAccess: { enable: false } } } })); // the write
    const { api } = makeApi({ ensureAppSettings });
    const { result } = renderHook(() => useShareModal({ ...baseParams(api), shareViewActive: true }));
    await waitFor(() => expect(result.current.publicAccessEnabled).toBe(true));

    await act(async () => {
      await result.current.handleSetPublicAccess(false);
    });

    expect(ensureAppSettings).toHaveBeenLastCalledWith({
      appSlug: "bloom",
      ownerHandle: "meghan",
      publicAccess: { enable: false },
    });
    expect(result.current.publicAccessEnabled).toBe(false);
  });

  it("rolls back the optimistic update when the write fails", async () => {
    const ensureAppSettings = vi
      .fn()
      .mockReturnValueOnce(ok({ settings: { entry: { publicAccess: { enable: true } } } })) // initial load
      .mockReturnValueOnce(err("nope")); // the write fails
    const { api } = makeApi({ ensureAppSettings });
    const { result } = renderHook(() => useShareModal({ ...baseParams(api), shareViewActive: true }));
    await waitFor(() => expect(result.current.publicAccessEnabled).toBe(true));

    await act(async () => {
      await result.current.handleSetPublicAccess(false);
    });

    expect(result.current.publicAccessEnabled).toBe(true); // rolled back
  });

  it("no-ops when the value is unchanged", async () => {
    const ensureAppSettings = vi.fn(() => ok({ settings: { entry: { publicAccess: { enable: true } } } }));
    const { api } = makeApi({ ensureAppSettings });
    const { result } = renderHook(() => useShareModal({ ...baseParams(api), shareViewActive: true }));
    await waitFor(() => expect(result.current.publicAccessEnabled).toBe(true));
    const callsAfterLoad = ensureAppSettings.mock.calls.length;

    await act(async () => {
      await result.current.handleSetPublicAccess(true); // already public
    });
    expect(ensureAppSettings.mock.calls.length).toBe(callsAfterLoad); // no extra write
  });
});
