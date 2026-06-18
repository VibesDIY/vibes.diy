import { describe, it, expect } from "vitest";
import { avatarConfirmController } from "~/vibes.diy/app/lib/avatar-confirm.js";

// The controller is a module-level singleton bridging the imperative
// confirm-before-write call (srv-sandbox bridge + Settings) to the React modal.

describe("avatarConfirmController", () => {
  it("notifies subscribers and resolves true on confirm", async () => {
    const seen: (string | undefined)[] = [];
    const unsub = avatarConfirmController.onChange((p) => seen.push(p?.cid)) as () => void;

    const decision = avatarConfirmController.request({ cid: "cidA", previewUrl: "u" });
    expect(avatarConfirmController.current?.cid).toBe("cidA");
    avatarConfirmController.current?.resolve(true);

    await expect(decision).resolves.toBe(true);
    expect(avatarConfirmController.current).toBeUndefined();
    expect(seen).toEqual(["cidA", undefined]);
    unsub();
  });

  it("resolves false on cancel", async () => {
    const decision = avatarConfirmController.request({ cid: "cidB" });
    avatarConfirmController.current?.resolve(false);
    await expect(decision).resolves.toBe(false);
  });

  it("auto-cancels a prior request when a new one supersedes it", async () => {
    const first = avatarConfirmController.request({ cid: "first" });
    const second = avatarConfirmController.request({ cid: "second" });

    // The first promise settles false without anyone touching it.
    await expect(first).resolves.toBe(false);
    expect(avatarConfirmController.current?.cid).toBe("second");

    avatarConfirmController.current?.resolve(true);
    await expect(second).resolves.toBe(true);
  });

  it("ignores a second resolve on the same request (idempotent)", async () => {
    const decision = avatarConfirmController.request({ cid: "cidC" });
    const pending = avatarConfirmController.current;
    expect(pending).toBeDefined();
    pending?.resolve(true);
    pending?.resolve(false); // no-op
    await expect(decision).resolves.toBe(true);
  });
});
