import { describe, it, expect, vi, beforeEach } from "vitest";
import { switchActiveHandle, createAndUseHandle, handleAvatarUrl } from "~/vibes.diy/app/routes/handle-picker-actions.js";
import type { HandleOption } from "@vibes.diy/base";
import type { VibesDiyApiIface } from "@vibes.diy/api-types";

const ok = <T>(val: T) => Promise.resolve({ isOk: () => true, isErr: () => false, Ok: () => val });
const err = (message: string) => Promise.resolve({ isOk: () => false, isErr: () => true, Err: () => ({ message }) });

function deps(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    setBusy: vi.fn(),
    setActiveHandle: vi.fn(),
    setHandles: vi.fn(),
    refreshViewer: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  globalThis.document.body.innerHTML = "";
});

describe("switchActiveHandle", () => {
  it("no-ops when the slug is already active (no write)", async () => {
    const ensureUserSettings = vi.fn(() => ok({}));
    const d = deps();
    await switchActiveHandle({
      slug: "meghan",
      currentSlug: "meghan",
      sharedApi: { ensureUserSettings } as unknown as VibesDiyApiIface,
      setBusy: d.setBusy,
      setActiveHandle: d.setActiveHandle,
      refreshViewer: d.refreshViewer,
    });
    expect(ensureUserSettings).not.toHaveBeenCalled();
    expect(d.setActiveHandle).not.toHaveBeenCalled();
  });

  it("persists, advances the active handle, and refreshes the viewer on success", async () => {
    const ensureUserSettings = vi.fn(() => ok({}));
    const d = deps();
    await switchActiveHandle({
      slug: "meghan_work",
      currentSlug: "meghan",
      sharedApi: { ensureUserSettings } as unknown as VibesDiyApiIface,
      setBusy: d.setBusy,
      setActiveHandle: d.setActiveHandle,
      refreshViewer: d.refreshViewer,
    });
    expect(ensureUserSettings).toHaveBeenCalledWith({ settings: [{ type: "defaultHandle", ownerHandle: "meghan_work" }] });
    expect(d.setActiveHandle).toHaveBeenCalledWith("meghan_work");
    expect(d.refreshViewer).toHaveBeenCalledOnce();
    expect(d.setBusy).toHaveBeenLastCalledWith(false);
  });

  it("does not advance or refresh when the write fails", async () => {
    const ensureUserSettings = vi.fn(() => err("nope"));
    const d = deps();
    await switchActiveHandle({
      slug: "meghan_work",
      currentSlug: "meghan",
      sharedApi: { ensureUserSettings } as unknown as VibesDiyApiIface,
      setBusy: d.setBusy,
      setActiveHandle: d.setActiveHandle,
      refreshViewer: d.refreshViewer,
    });
    expect(d.setActiveHandle).not.toHaveBeenCalled();
    expect(d.refreshViewer).not.toHaveBeenCalled();
    expect(d.setBusy).toHaveBeenLastCalledWith(false);
  });
});

describe("createAndUseHandle", () => {
  it("creates, surfaces, switches to, and refreshes for the new handle on success", async () => {
    const createHandleBinding = vi.fn(() => ok({ ownerHandle: "fresh-blue-otter" }));
    const ensureUserSettings = vi.fn(() => ok({}));
    const d = deps();
    await createAndUseHandle({
      sharedApi: { createHandleBinding, ensureUserSettings } as unknown as VibesDiyApiIface,
      setBusy: d.setBusy,
      setHandles: d.setHandles,
      setActiveHandle: d.setActiveHandle,
      refreshViewer: d.refreshViewer,
    });
    // setHandles is called with an updater; apply it to verify it appends the new handle.
    const updater = d.setHandles.mock.calls[0][0] as (prev: HandleOption[]) => HandleOption[];
    expect(updater([])).toEqual([{ slug: "fresh-blue-otter", avatarUrl: handleAvatarUrl("fresh-blue-otter") }]);
    expect(d.setActiveHandle).toHaveBeenCalledWith("fresh-blue-otter");
    expect(d.refreshViewer).toHaveBeenCalledOnce();
  });

  it("does not touch the list or active handle when creation fails", async () => {
    const createHandleBinding = vi.fn(() => err("create boom"));
    const ensureUserSettings = vi.fn(() => ok({}));
    const d = deps();
    await createAndUseHandle({
      sharedApi: { createHandleBinding, ensureUserSettings } as unknown as VibesDiyApiIface,
      setBusy: d.setBusy,
      setHandles: d.setHandles,
      setActiveHandle: d.setActiveHandle,
      refreshViewer: d.refreshViewer,
    });
    expect(d.setHandles).not.toHaveBeenCalled();
    expect(d.setActiveHandle).not.toHaveBeenCalled();
    expect(ensureUserSettings).not.toHaveBeenCalled();
  });

  it("surfaces the created handle but does NOT switch when persisting the default fails (#2720)", async () => {
    const createHandleBinding = vi.fn(() => ok({ ownerHandle: "fresh-blue-otter" }));
    const ensureUserSettings = vi.fn(() => err("persist boom"));
    const d = deps();
    await createAndUseHandle({
      sharedApi: { createHandleBinding, ensureUserSettings } as unknown as VibesDiyApiIface,
      setBusy: d.setBusy,
      setHandles: d.setHandles,
      setActiveHandle: d.setActiveHandle,
      refreshViewer: d.refreshViewer,
    });
    // The binding was created, so it IS surfaced in the list...
    expect(d.setHandles).toHaveBeenCalledOnce();
    // ...but the active handle does not advance and the viewer is not refreshed.
    expect(d.setActiveHandle).not.toHaveBeenCalled();
    expect(d.refreshViewer).not.toHaveBeenCalled();
    expect(d.setBusy).toHaveBeenLastCalledWith(false);
  });
});
